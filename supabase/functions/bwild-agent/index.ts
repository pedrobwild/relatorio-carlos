/**
 * Edge Function: bwild-agent
 *
 * Orquestrador stateful da inteligência BWild para reformas turnkey.
 * Recebe um evento (event_type + content + project_id), roteia para o
 * agente especialista correto, chama o LLM com a memória atual do projeto
 * como contexto, persiste resposta + diff de memória + log do evento.
 *
 * Spec: docs/BWILD_AI_AGENTS_SPEC.yaml
 *
 * Auth: JWT obrigatório. Apenas staff pode invocar.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { buildSystemPrompt, type RoutedAgent } from './_lib/agentPrompts.ts';
import { routeRequest, type AgentEventType } from './_lib/orchestrator.ts';
import {
  applyStatePatch,
  emptyState,
  isPlainObject,
  renderStateForPrompt,
  type ProjectState,
} from './_lib/state.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const MODEL = Deno.env.get('BWILD_AGENT_MODEL') ?? 'google/gemini-3-flash-preview';

const VALID_EVENT_TYPES: AgentEventType[] = [
  'new_project',
  'project_update',
  'schedule_request',
  'budget_request',
  'field_problem',
  'client_message',
  'supplier_quote',
  'purchase_decision',
  'quality_inspection',
  'scope_change',
  'handover',
];

const VALID_SOURCES = ['cliente', 'equipe', 'fornecedor', 'gestor', 'vistoria', 'documento'];

interface AgentResponseShape {
  diagnostico?: string;
  premissas?: string[];
  impactos?: Record<string, string>;
  recomendacao?: string;
  plano_de_acao?: string[];
  riscos?: string[];
  decisoes_necessarias?: string[];
  memoria_atualizada?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!LOVABLE_API_KEY) {
    return jsonResponse({ error: 'LOVABLE_API_KEY não configurada' }, 500);
  }

  // ---- Parse body --------------------------------------------------------
  let body: {
    project_id?: string;
    event_type?: string;
    content?: string;
    source?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Body JSON inválido' }, 400);
  }

  const projectId = (body.project_id ?? '').toString().trim();
  const eventType = (body.event_type ?? '').toString().trim() as AgentEventType;
  const content = (body.content ?? '').toString().trim();
  const source = body.source ? body.source.toString().trim() : null;

  if (!projectId) return jsonResponse({ error: 'project_id obrigatório' }, 400);
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return jsonResponse({ error: 'event_type inválido' }, 400);
  }
  if (!content) return jsonResponse({ error: 'content vazio' }, 400);
  if (source && !VALID_SOURCES.includes(source)) {
    return jsonResponse({ error: 'source inválido' }, 400);
  }

  // ---- Auth (staff-only) -------------------------------------------------
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Authorization required' }, 401);

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData.user) return jsonResponse({ error: 'Não autenticado' }, 401);
  const userId = userData.user.id;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: isStaff } = await supabaseAdmin.rpc('is_staff', { _user_id: userId });
  if (!isStaff) return jsonResponse({ error: 'Staff access required' }, 403);

  // Verifica que o projeto existe (RLS já cobre staff via policies, mas
  // queremos uma 404 explícita aqui).
  const { data: project, error: projectErr } = await supabaseAdmin
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle();
  if (projectErr) return jsonResponse({ error: projectErr.message }, 500);
  if (!project) return jsonResponse({ error: 'Projeto não encontrado' }, 404);

  // ---- Routing -----------------------------------------------------------
  const routing = routeRequest({ event_type: eventType, content });
  const agent: RoutedAgent = routing.agent;

  // ---- Carrega memória atual --------------------------------------------
  let currentState: ProjectState = emptyState();
  let stateRowId: string | null = null;

  const { data: stateRow, error: stateErr } = await supabaseAdmin
    .from('project_state_memory')
    .select('id, state')
    .eq('project_id', projectId)
    .maybeSingle();
  if (stateErr) return jsonResponse({ error: stateErr.message }, 500);
  if (stateRow) {
    stateRowId = stateRow.id as string;
    currentState = (stateRow.state as ProjectState) ?? emptyState();
  }

  // ---- Chama o LLM -------------------------------------------------------
  const startedAt = Date.now();
  const systemPrompt = buildSystemPrompt(agent);

  const userMessage = [
    `Evento: ${eventType}` + (source ? ` (fonte: ${source})` : ''),
    `Projeto: ${project.name ?? projectId}`,
    '',
    'Memória atual do projeto:',
    renderStateForPrompt(currentState),
    '',
    'Input do usuário:',
    content,
    '',
    'Responda em JSON puro, sem markdown ou cercas de código, seguindo o schema do system prompt.',
  ].join('\n');

  let llmRespJson: unknown = null;
  let tokensIn = 0;
  let tokensOut = 0;
  let llmErrorMessage: string | null = null;

  try {
    const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!llmResp.ok) {
      const t = await llmResp.text();
      llmErrorMessage = `LLM ${llmResp.status}: ${t.slice(0, 200)}`;
    } else {
      const llmData = await llmResp.json();
      tokensIn = llmData?.usage?.prompt_tokens ?? 0;
      tokensOut = llmData?.usage?.completion_tokens ?? 0;
      const raw = llmData?.choices?.[0]?.message?.content ?? '';
      try {
        llmRespJson = JSON.parse(raw);
      } catch {
        llmErrorMessage = 'Resposta do modelo não é JSON válido';
      }
    }
  } catch (e) {
    llmErrorMessage = e instanceof Error ? e.message : String(e);
  }

  const latencyMs = Date.now() - startedAt;

  // ---- Aplica diff de memória -------------------------------------------
  let stateDiff: Record<string, unknown> = {};
  let stateVersion: number | null = null;
  let response: AgentResponseShape | null = null;

  if (llmRespJson && isPlainObject(llmRespJson)) {
    response = llmRespJson as AgentResponseShape;
    const patch = response.memoria_atualizada;
    if (patch && isPlainObject(patch)) {
      const { next, diff } = applyStatePatch(currentState, patch);
      stateDiff = diff;
      if (Object.keys(diff).length > 0) {
        const upsertPayload = stateRowId
          ? { id: stateRowId, project_id: projectId, state: next, updated_by: userId }
          : { project_id: projectId, state: next, updated_by: userId };
        const { data: upserted, error: upsertErr } = await supabaseAdmin
          .from('project_state_memory')
          .upsert(upsertPayload, { onConflict: 'project_id' })
          .select('version')
          .single();
        if (upsertErr) {
          // Não falha a request — registra como state_error mas devolve a resposta.
          llmErrorMessage = (llmErrorMessage ? llmErrorMessage + ' | ' : '') +
            `state_error: ${upsertErr.message}`;
        } else {
          stateVersion = (upserted?.version as number | undefined) ?? null;
        }
      }
    }
  }

  // ---- Log do evento -----------------------------------------------------
  const status: 'success' | 'llm_error' | 'state_error' | 'other' =
    !response ? 'llm_error' :
    llmErrorMessage?.includes('state_error') ? 'state_error' :
    'success';

  const { data: eventRow } = await supabaseAdmin
    .from('bwild_agent_events')
    .insert({
      project_id: projectId,
      user_id: userId,
      event_type: eventType,
      source,
      content,
      routed_agent: agent,
      response: response as unknown,
      state_diff: stateDiff,
      state_version: stateVersion,
      model: MODEL,
      tokens_input: tokensIn,
      tokens_output: tokensOut,
      latency_ms: latencyMs,
      status,
      error_message: llmErrorMessage,
    })
    .select('id')
    .single();

  return jsonResponse({
    event_id: eventRow?.id ?? null,
    project_id: projectId,
    routed_agent: agent,
    routing_reason: routing.reason,
    status,
    response,
    state_diff: stateDiff,
    state_version: stateVersion,
    latency_ms: latencyMs,
    error: llmErrorMessage,
  }, status === 'success' ? 200 : 502);
});
