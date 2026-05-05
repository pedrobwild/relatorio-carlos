import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { detectTruncation } from '../_shared/truncationDetector.ts';
import { corsHeaders, corsResponse, jsonResponse } from '../_shared/cors.ts';
import { renderCatalog } from './_lib/catalog.ts';
import {
  analyzeDataQuality,
  generateInsights,
  recommendVisualizations,
  scoreConfidence,
  suggestFollowUps,
} from './_lib/analysis.ts';
import {
  SYSTEM_PROMPT,
  FORMATTER_SYSTEM_PROMPT,
  PLANNER_EXTERNAL_DELTA,
  buildFormatterUserMessage,
  type FormatterEvidence,
  type FormatterStep,
} from './_lib/prompts.ts';
import {
  EXTERNAL_SOURCES,
  renderExternalSourcesCatalog,
} from './_lib/externalSources.ts';
import { dispatchExternalStep } from './_lib/dispatcher.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const MODEL = 'google/gemini-3-flash-preview';

const SCHEMA_CATALOG = renderCatalog();
const EXTERNAL_CATALOG = renderExternalSourcesCatalog();
const VALID_SOURCE_IDS = EXTERNAL_SOURCES.map((s) => s.id);

const PERPLEXITY_FN_URL = `${SUPABASE_URL}/functions/v1/perplexity-research`;

// Tool schema v4 multi-step: o Planner produz uma LISTA ordenada de steps.
// Cada step é internal (SQL) ou external (BCB/Receita/Perplexity). O orquestrador
// executa cada um e o Formatter cruza via final_calculation.
const PLAN_TOOL = {
  type: 'function',
  function: {
    name: 'plan_query',
    description:
      'Planeja a resolução da pergunta como lista ordenada de 1-3 steps. Cada step é internal (SQL no banco BWild) ou external (BCB/Receita/Perplexity). Limite hard de 2 steps externos. O Formatter cruza os resultados via final_calculation.',
    parameters: {
      type: 'object',
      properties: {
        question_type: {
          type: 'string',
          enum: ['factual', 'diagnostica', 'comparativa', 'decisoria', 'exploratoria'],
        },
        domain: {
          type: 'string',
          enum: ['financeiro', 'compras', 'cronograma', 'ncs', 'pendencias', 'cs', 'obras', 'fornecedores', 'outros'],
          description: 'Domínio do FATO principal da resposta.',
        },
        intent: {
          type: 'string',
          description: 'Resumo curto (até 140 chars) do que o plano entrega.',
        },
        steps: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer', minimum: 1, maximum: 3 },
              sub_question: {
                type: 'string',
                description: 'Sub-pergunta auto-contida que esse step responde.',
              },
              step_type: { type: 'string', enum: ['internal', 'external'] },
              sql: {
                type: 'string',
                description:
                  'PostgreSQL SELECT/WITH (mesmas regras do v3). Obrigatório se step_type=internal; ignorado em external.',
              },
              external_source_id: {
                type: 'string',
                description:
                  'id de EXTERNAL_SOURCES (ex: bcb_ipca, bcb_cambio_usd, cub_sp). Obrigatório se step_type=external.',
              },
              external_kind: {
                type: 'string',
                enum: ['fetch', 'web'],
                description:
                  'fetch=API estruturada (BCB/Receita) → use external_params. web=Perplexity → use external_query.',
              },
              external_params: {
                type: 'object',
                description:
                  'Parâmetros do endpoint para external_kind=fetch. BCB: { n: 12 }; CNPJ: { cnpj: "14digitos" }.',
              },
              external_query: {
                type: 'string',
                description:
                  'Pergunta natural PT-BR específica e datada para external_kind=web.',
              },
            },
            required: ['id', 'sub_question', 'step_type'],
            additionalProperties: false,
          },
        },
        final_calculation: {
          type: 'string',
          description:
            'Como cruzar os resultados dos steps para chegar à resposta final. Vazio se há 1 step só.',
        },
        assumptions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Decisões do Planner (ex: "este mês = mês corrente").',
        },
      },
      required: ['domain', 'intent', 'steps'],
      additionalProperties: false,
    },
  },
};

const sseHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildAnalysis(opts: {
  rows: Record<string, unknown>[];
  rowsReturned: number;
  domain: string;
  sql: string | null;
  status: string;
}) {
  const insights = generateInsights(opts.rows, opts.domain, opts.sql);
  const dataQuality = analyzeDataQuality(opts.rows);
  const visualizations = recommendVisualizations(opts.rows);
  const followUps = suggestFollowUps(opts.domain);
  const confidence = scoreConfidence({
    rowsReturned: opts.rowsReturned,
    hasSql: Boolean(opts.sql),
    domainKnown: opts.domain !== 'outros',
    dataQualityIssues: dataQuality.length,
  });
  const limitations: string[] = [];
  if (opts.rows.length === 0) limitations.push('Nenhum registro retornado.');
  if (opts.rows.length >= 200) limitations.push('Resultado truncado em 200 linhas.');
  if (dataQuality.length > 0) limitations.push('Inconsistências detectadas na qualidade dos dados.');
  return { insights, dataQuality, visualizations, followUps, confidence, limitations };
}

// ============================================================
// Plan validation (v4 multi-step)
// ============================================================
//
// Aceita o output bruto de plan_query e devolve uma lista normalizada de
// steps + warnings sobre tudo o que foi descartado (SQL ausente, fonte
// externa inválida, excesso de steps externos). O orquestrador trata os
// warnings como limitações da resposta — não derruba a sessão.

interface PlanStep {
  id: number;
  sub_question: string;
  step_type: 'internal' | 'external';
  sql?: string;
  external_source_id?: string;
  external_kind?: 'fetch' | 'web';
  external_params?: Record<string, unknown>;
  external_query?: string;
}

interface NormalizedPlan {
  steps: PlanStep[];
  warnings: string[];
  final_calculation: string;
  assumptions: string[];
  question_type: string | null;
}

function normalizePlan(args: Record<string, unknown>): NormalizedPlan {
  const warnings: string[] = [];
  const rawSteps = Array.isArray(args.steps) ? (args.steps as Record<string, unknown>[]) : [];
  const accepted: PlanStep[] = [];
  let externalCount = 0;

  for (const s of rawSteps) {
    if (accepted.length >= 3) {
      warnings.push('plan_truncado_em_3_steps');
      break;
    }
    if (!s || typeof s !== 'object') continue;

    const id = Number.isFinite(Number(s.id)) ? Number(s.id) : accepted.length + 1;
    const subQuestion = typeof s.sub_question === 'string' ? s.sub_question.trim() : '';
    const stepType = s.step_type === 'external' ? 'external' : 'internal';

    if (stepType === 'internal') {
      const sql = typeof s.sql === 'string' ? s.sql.trim() : '';
      if (!sql) {
        warnings.push(`step_${id}_internal_sem_sql`);
        continue;
      }
      accepted.push({ id, sub_question: subQuestion, step_type: 'internal', sql });
      continue;
    }

    const sourceId = typeof s.external_source_id === 'string' ? s.external_source_id : '';
    if (!VALID_SOURCE_IDS.includes(sourceId)) {
      warnings.push(`step_${id}_source_invalida:${sourceId || 'vazio'}`);
      continue;
    }
    if (externalCount >= 2) {
      warnings.push(`step_${id}_descartado_max_2_externos`);
      continue;
    }
    externalCount += 1;

    const params = s.external_params && typeof s.external_params === 'object' && !Array.isArray(s.external_params)
      ? (s.external_params as Record<string, unknown>)
      : {};
    const query = typeof s.external_query === 'string' && s.external_query.trim()
      ? s.external_query.trim()
      : undefined;
    const kind: 'fetch' | 'web' | undefined =
      s.external_kind === 'fetch' || s.external_kind === 'web' ? s.external_kind : undefined;

    accepted.push({
      id,
      sub_question: subQuestion,
      step_type: 'external',
      external_source_id: sourceId,
      external_kind: kind,
      external_params: params,
      external_query: query,
    });
  }

  const finalCalculation = typeof args.final_calculation === 'string' ? args.final_calculation : '';
  const assumptions = Array.isArray(args.assumptions)
    ? (args.assumptions as unknown[]).filter((a): a is string => typeof a === 'string')
    : [];
  const questionType = typeof args.question_type === 'string' ? args.question_type : null;

  return { steps: accepted, warnings, final_calculation: finalCalculation, assumptions, question_type: questionType };
}

/** Decide entre fetch/web quando o LLM esquece external_kind. */
function inferExternalKind(step: PlanStep): 'fetch' | 'web' {
  if (step.external_kind) return step.external_kind;
  // CNPJ ou n=BCB → fetch; query string → web.
  const params = step.external_params ?? {};
  if ('cnpj' in params || 'n' in params) return 'fetch';
  if (step.external_query) return 'web';
  // Fallback pela id da fonte (bcb_*, cnpj_* são fetch).
  const id = step.external_source_id ?? '';
  if (id.startsWith('bcb_') || id === 'cnpj_receita') return 'fetch';
  return 'web';
}

Deno.serve(async (req) => {
  // Correlação por requisição. Aceita X-Request-Id do cliente; senão gera um.
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  if (req.method === 'OPTIONS') return corsResponse();

  let body: { question?: string; conversation_id?: string | null; stream?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Body JSON inválido' }, 400);
  }

  const wantsStream = body.stream !== false; // default ON
  const question = (body.question ?? '').toString().trim();
  let conversationId: string | null = body.conversation_id ?? null;

  if (!question) return jsonResponse({ error: 'Pergunta vazia' }, 400);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  if (!LOVABLE_API_KEY) {
    return jsonResponse({ error: 'LOVABLE_API_KEY não configurada' }, 500);
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return jsonResponse({ error: 'Não autenticado' }, 401);
  }
  const userId = userData.user.id;

  if (!wantsStream) {
    return await runNonStreaming({ supabase, userId, question, conversationId, authHeader });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(sseEvent(event, data)));
        } catch (_) { /* connection closed */ }
      };

      const startedAt = Date.now();
      let generatedSql: string | null = null;
      let domain: string = 'outros';
      let intent: string | null = null;
      let status: 'success' | 'sql_blocked' | 'sql_error' | 'llm_error' | 'timeout' | 'other' = 'success';
      let errorMessage: string | null = null;
      let rowsReturned = 0;
      let tokensIn = 0;
      let tokensOut = 0;
      let finalAnswer = '';
      let finishReason: string | null = null;
      let rows: Record<string, unknown>[] = [];
      let logId: string | null = null;
      let analysis: ReturnType<typeof buildAnalysis> | null = null;
      const evidences: FormatterEvidence[] = [];
      const formatterSteps: FormatterStep[] = [];
      let plan: NormalizedPlan | null = null;
      let questionType: string | null = null;
      let externalCalls = 0;
      let externalCacheHits = 0;
      let externalCostCents = 0;
      const externalSourcesUsed: string[] = [];
      const planLimitations: string[] = [];
      // Marca quando o PRIMEIRO step internal já produziu resultado (mesmo
      // que zero linhas). Sem essa flag, um first-step com 0 linhas seguido
      // de um segundo step que falha seria tratado erroneamente como falha
      // de primeiro step (e abortaria a resposta).
      let mainInternalRecorded = false;

      try {
        if (!conversationId) {
          const { data: conv, error: convErr } = await supabase
            .from('assistant_conversations')
            .insert({ user_id: userId, title: question.slice(0, 60) })
            .select('id')
            .single();
          if (convErr) throw new Error('Falha ao criar conversa: ' + convErr.message);
          conversationId = conv.id;
        }
        send('conversation', { conversation_id: conversationId, request_id: requestId });

        await supabase.from('assistant_messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: question,
        });

        send('status', { phase: 'thinking', message: 'Interpretando pergunta...' });

        const { data: history } = await supabase
          .from('assistant_messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(10);

        const llmMessages = [
          {
            role: 'system',
            content:
              SYSTEM_PROMPT + '\n\n' + SCHEMA_CATALOG +
              '\n\n' + PLANNER_EXTERNAL_DELTA + '\n\n' + EXTERNAL_CATALOG,
          },
          ...(history ?? []).map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        ];

        const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: MODEL,
            messages: llmMessages,
            tools: [PLAN_TOOL],
            tool_choice: { type: 'function', function: { name: 'plan_query' } },
          }),
        });

        if (llmResp.status === 429) {
          status = 'llm_error';
          errorMessage = 'Limite de requisições atingido';
          send('error', { message: 'Muitas requisições. Tente novamente em instantes.', status });
          return;
        }
        if (llmResp.status === 402) {
          status = 'llm_error';
          errorMessage = 'Créditos esgotados';
          send('error', { message: 'Créditos do assistente esgotados. Adicione créditos na sua workspace.', status });
          return;
        }
        if (!llmResp.ok) {
          status = 'llm_error';
          const t = await llmResp.text();
          errorMessage = `LLM ${llmResp.status}: ${t.slice(0, 200)}`;
          send('error', { message: errorMessage, status });
          return;
        }

        const llmData = await llmResp.json();
        tokensIn += llmData?.usage?.prompt_tokens ?? 0;
        tokensOut += llmData?.usage?.completion_tokens ?? 0;

        const toolCall = llmData?.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          status = 'llm_error';
          errorMessage = 'Modelo não retornou plano';
          send('error', { message: errorMessage, status });
          return;
        }
        const args = JSON.parse(toolCall.function.arguments);
        domain = typeof args.domain === 'string' ? args.domain : 'outros';
        intent = typeof args.intent === 'string' ? args.intent : null;
        plan = normalizePlan(args);
        questionType = plan.question_type;

        if (plan.steps.length === 0) {
          status = 'llm_error';
          errorMessage = 'Plano sem steps válidos';
          send('error', { message: errorMessage, status, plan_warnings: plan.warnings });
          return;
        }

        const internalSteps = plan.steps.filter((s) => s.step_type === 'internal');

        // SQL "principal" usado em logs/insights = primeiro step internal (compat v3).
        // Se há vários, concatenamos com comentário para visibilidade no log.
        generatedSql = internalSteps.length
          ? internalSteps.map((s) => `-- step ${s.id}: ${s.sub_question}\n${s.sql}`).join('\n\n;\n\n')
          : null;

        send('plan', {
          domain,
          intent,
          question_type: questionType,
          final_calculation: plan.final_calculation,
          assumptions: plan.assumptions,
          warnings: plan.warnings,
          steps: plan.steps.map((s) => ({
            id: s.id,
            sub_question: s.sub_question,
            step_type: s.step_type,
            sql: s.sql ?? null,
            external_source_id: s.external_source_id ?? null,
          })),
        });

        // Compat: emit `sql` event como antes para clientes legados.
        if (generatedSql) {
          send('sql', { sql: generatedSql, domain, intent });
        }

        if (plan.warnings.length) {
          for (const w of plan.warnings) planLimitations.push(`Plano ajustado: ${w}`);
        }

        // ---- Loop dos steps -------------------------------------------------
        for (const step of plan.steps) {
          send('step_start', {
            id: step.id,
            sub_question: step.sub_question,
            step_type: step.step_type,
          });

          if (step.step_type === 'internal' && step.sql) {
            send('status', { phase: 'querying', message: `Consultando banco (step ${step.id})...` });
            const { data: rpcData, error: rpcErr } = await supabase.rpc('execute_assistant_query', {
              p_sql: step.sql,
            });

            if (rpcErr) {
              const msg = (rpcErr.message || '').toLowerCase();
              const stepStatus: typeof status =
                msg.includes('proibido') || msg.includes('apenas') || msg.includes('multiplas') || msg.includes('blocos') || msg.includes('esquemas')
                  ? 'sql_blocked'
                  : msg.includes('timeout') || msg.includes('canceling statement')
                  ? 'timeout'
                  : 'sql_error';

              formatterSteps.push({
                id: step.id,
                sub_question: step.sub_question,
                step_type: 'internal',
                rows: [],
                rows_returned: 0,
                error: rpcErr.message,
              });
              send('step_result', {
                id: step.id,
                step_type: 'internal',
                error: rpcErr.message,
                status: stepStatus,
              });

              // Falha do PRIMEIRO step internal = falha da resposta. Falha de
              // step subsequente = degradação (Formatter informa "step X falhou").
              if (!mainInternalRecorded && status === 'success') {
                status = stepStatus;
                errorMessage = rpcErr.message;
                break;
              }
              continue;
            }

            const stepRows = Array.isArray(rpcData) ? (rpcData as Record<string, unknown>[]) : [];
            formatterSteps.push({
              id: step.id,
              sub_question: step.sub_question,
              step_type: 'internal',
              rows: stepRows,
              rows_returned: stepRows.length,
            });
            // Linhas "principais" para insights/analysis = primeiro internal step
            // que executou (mesmo que tenha vindo vazio).
            if (!mainInternalRecorded) {
              rows = stepRows;
              rowsReturned = stepRows.length;
              mainInternalRecorded = true;
            }
            send('step_result', {
              id: step.id,
              step_type: 'internal',
              rows_returned: stepRows.length,
              preview: stepRows.slice(0, 30),
            });
            continue;
          }

          if (step.step_type === 'external' && step.external_source_id) {
            send('status', { phase: 'researching', message: `Buscando dado externo (step ${step.id})...` });
            externalCalls += 1;
            externalSourcesUsed.push(step.external_source_id);

            const isWeb = inferExternalKind(step) === 'web';
            const result = await dispatchExternalStep(
              {
                source_id: step.external_source_id,
                params: step.external_params,
                query: step.external_query,
              },
              isWeb
                ? { perplexityFnUrl: PERPLEXITY_FN_URL, authHeader }
                : {},
            );

            if (result.cached) externalCacheHits += 1;
            externalCostCents += result.cost_cents;

            if (result.evidence) {
              const ev = result.evidence;
              evidences.push({
                source_id: ev.source_id,
                publisher: ev.publisher,
                claim: ev.claim,
                url: ev.url,
                access_date: ev.access_date,
                published_at: ev.published_at,
                numeric_value: ev.numeric_value,
                numeric_unit: ev.numeric_unit,
                tier: ev.tier,
                warnings: ev.warnings,
              });
              formatterSteps.push({
                id: step.id,
                sub_question: step.sub_question,
                step_type: 'external',
                external_source_id: step.external_source_id,
              });
              send('step_result', {
                id: step.id,
                step_type: 'external',
                external_source_id: ev.source_id,
                publisher: ev.publisher,
                claim: ev.claim,
                url: ev.url,
                tier: ev.tier,
                cached: result.cached,
              });
              // Compat: também emite o evento `evidence` legado.
              send('evidence', {
                source_id: ev.source_id,
                publisher: ev.publisher,
                claim: ev.claim,
                url: ev.url,
                tier: ev.tier,
                cached: result.cached,
              });
            } else {
              const errMsg = result.error ?? 'fonte externa indisponível';
              formatterSteps.push({
                id: step.id,
                sub_question: step.sub_question,
                step_type: 'external',
                external_source_id: step.external_source_id,
                error: errMsg,
              });
              send('step_result', {
                id: step.id,
                step_type: 'external',
                external_source_id: step.external_source_id,
                error: errMsg,
              });
              send('evidence_error', {
                source_id: step.external_source_id,
                error: errMsg,
              });
              planLimitations.push(`Step ${step.id} (externo): ${errMsg}`);
            }
          }
        }

        // Compat: emit `rows` agregado depois dos steps internos.
        send('rows', { rows_returned: rowsReturned, preview: rows.slice(0, 50) });

        if (status === 'success') {
          analysis = buildAnalysis({ rows, rowsReturned, domain, sql: generatedSql, status });
          if (planLimitations.length) analysis.limitations.push(...planLimitations);
          send('analysis', {
            insights: analysis.insights,
            data_quality: analysis.dataQuality,
            visualizations: analysis.visualizations,
            suggested_questions: analysis.followUps,
            confidence: analysis.confidence,
            limitations: analysis.limitations,
          });
        }

        if (status !== 'success') {
          finalAnswer = `Não consegui executar a consulta. ${
            status === 'sql_blocked'
              ? 'A pergunta foi traduzida em uma operação não permitida.'
              : status === 'timeout'
              ? 'A consulta demorou demais. Tente refinar com filtros (ex: período).'
              : 'Tente reformular a pergunta de outra maneira.'
          }`;
          send('delta', { content: finalAnswer });
        } else {
          send('status', { phase: 'formatting', message: 'Formatando resposta...' });

          const formatterUserMessage = buildFormatterUserMessage({
            question,
            domain,
            intent,
            rows,
            rowsReturned,
            analysis: analysis
              ? {
                  confidence: analysis.confidence,
                  insights: analysis.insights,
                  dataQuality: analysis.dataQuality,
                  limitations: analysis.limitations,
                  visualizations: analysis.visualizations,
                }
              : null,
            evidences: evidences.length ? evidences : null,
            steps: formatterSteps.length ? formatterSteps : null,
            finalCalculation: plan?.final_calculation ?? null,
            assumptions: plan?.assumptions ?? null,
          });

          const formatResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: MODEL,
              stream: true,
              messages: [
                { role: 'system', content: FORMATTER_SYSTEM_PROMPT },
                { role: 'user', content: formatterUserMessage },
              ],
            }),
          });

          if (!formatResp.ok || !formatResp.body) {
            const t = await formatResp.text().catch(() => '');
            finalAnswer = `Encontrei ${rowsReturned} resultado(s), mas falhei ao formatar: ${t.slice(0, 100)}`;
            send('delta', { content: finalAnswer });
          } else {
            const reader = formatResp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            // finishReason é hoisted no escopo externo
            const processLine = (line: string) => {
              let trimmed = line;
              if (trimmed.endsWith('\r')) trimmed = trimmed.slice(0, -1);
              trimmed = trimmed.trim();
              if (!trimmed || trimmed.startsWith(':')) return;
              if (!trimmed.startsWith('data:')) return;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === '[DONE]') return;
              try {
                const json = JSON.parse(payload);
                const delta = json?.choices?.[0]?.delta?.content;
                if (delta) {
                  finalAnswer += delta;
                  send('delta', { content: delta });
                }
                const fr = json?.choices?.[0]?.finish_reason;
                if (fr) finishReason = fr;
                const usage = json?.usage;
                if (usage) {
                  tokensIn += usage.prompt_tokens ?? 0;
                  tokensOut += usage.completion_tokens ?? 0;
                }
              } catch (_) { /* ignore parse errors mid-buffer */ }
            };
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              let nlIdx: number;
              while ((nlIdx = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, nlIdx);
                buffer = buffer.slice(nlIdx + 1);
                processLine(line);
              }
            }
            // Final flush: o último data: pode chegar sem \n e seria descartado
            buffer += decoder.decode();
            if (buffer.length > 0) {
              const trimmedTail = buffer.trim();
              const hasSseData = trimmedTail.startsWith('data:') || trimmedTail.includes('\ndata:');
              if (hasSseData) {
                console.log(
                  `[assistant-chat] [req=${requestId}] SSE final flush: processing ${buffer.length} bytes leftover (would be dropped without flush)`,
                );
                for (const line of buffer.split('\n')) processLine(line);
              } else {
                console.warn(
                  `[assistant-chat] [req=${requestId}] SSE final flush: discarding ${buffer.length} bytes leftover sem 'data:' (preview=${JSON.stringify(buffer.slice(0, 80))})`,
                );
              }
              buffer = '';
            }
            if (!finalAnswer) finalAnswer = `Consulta retornou ${rowsReturned} linha(s).`;
          }
        }

        // Heurística de detecção de truncamento da resposta final
        const { truncated: looksTruncated, truncationReason, answerLength: answerLen } =
          detectTruncation({ status, finalAnswer, finishReason });
        if (looksTruncated) {
          console.warn(
            `[assistant-chat] [req=${requestId}] resposta possivelmente truncada (len=${answerLen}, reason=${truncationReason}, finish=${finishReason})`,
          );
        }

        const { data: logRow } = await supabase
          .from('assistant_logs')
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            question,
            generated_sql: generatedSql,
            domain,
            rows_returned: rowsReturned,
            latency_ms: Date.now() - startedAt,
            tokens_input: tokensIn,
            tokens_output: tokensOut,
            model: MODEL,
            status,
            error_message: errorMessage,
            answer_summary: finalAnswer.slice(0, 280),
            answer_length: answerLen,
            finish_reason: finishReason,
            truncated: looksTruncated,
            truncation_reason: truncationReason,
            external_calls_count: externalCalls,
            external_cache_hits: externalCacheHits,
            external_cost_cents: externalCostCents,
            external_sources_used: externalSourcesUsed.length ? externalSourcesUsed : null,
          })
          .select('id')
          .single();
        logId = logRow?.id ?? null;

        await supabase.from('assistant_messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: finalAnswer,
          result_data: {
            rows: rows.slice(0, 50),
            rows_returned: rowsReturned,
            sql: generatedSql,
            domain,
            status,
            question_type: questionType,
            steps: formatterSteps.length
              ? formatterSteps.map((s) => ({
                  ...s,
                  rows: s.rows ? s.rows.slice(0, 30) : s.rows,
                }))
              : null,
            final_calculation: plan?.final_calculation ?? null,
            assumptions: plan?.assumptions ?? null,
            insights: analysis?.insights ?? null,
            data_quality: analysis?.dataQuality ?? null,
            visualizations: analysis?.visualizations ?? null,
            suggested_questions: analysis?.followUps ?? null,
            confidence: analysis?.confidence ?? null,
            limitations: analysis?.limitations ?? null,
            evidences: evidences.length ? evidences : null,
          },
          log_id: logId,
        });

        await supabase
          .from('assistant_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);

        send('done', {
          conversation_id: conversationId,
          answer: finalAnswer,
          rows: rows.slice(0, 50),
          rows_returned: rowsReturned,
          sql: generatedSql,
          domain,
          intent,
          status,
          question_type: questionType,
          steps: formatterSteps.length
            ? formatterSteps.map((s) => ({
                ...s,
                rows: s.rows ? s.rows.slice(0, 30) : s.rows,
              }))
            : null,
          final_calculation: plan?.final_calculation ?? null,
          assumptions: plan?.assumptions ?? null,
          log_id: logId,
          latency_ms: Date.now() - startedAt,
          insights: analysis?.insights ?? null,
          data_quality: analysis?.dataQuality ?? null,
          visualizations: analysis?.visualizations ?? null,
          suggested_questions: analysis?.followUps ?? null,
          confidence: analysis?.confidence ?? null,
          limitations: analysis?.limitations ?? null,
          evidences: evidences.length ? evidences : null,
        });
      } catch (e) {
        console.error('[assistant-chat stream] error:', e);
        const message = e instanceof Error ? e.message : String(e);
        send('error', { message, status: 'other' });
        try {
          await supabase.from('assistant_logs').insert({
            user_id: userId,
            conversation_id: conversationId,
            question,
            generated_sql: generatedSql,
            domain,
            rows_returned: 0,
            latency_ms: Date.now() - startedAt,
            tokens_input: tokensIn,
            tokens_output: tokensOut,
            model: MODEL,
            status: 'other',
            error_message: message,
          });
        } catch (_) { /* swallow */ }
      } finally {
        try { controller.close(); } catch (_) { /* ignore */ }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
});

// ============================================================
// Modo legado não-streaming (mantém compatibilidade com testes)
// ============================================================
async function runNonStreaming(opts: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  question: string;
  conversationId: string | null;
  authHeader: string;
}): Promise<Response> {
  const { supabase, userId, question, authHeader } = opts;
  let { conversationId } = opts;
  const startedAt = Date.now();
  let generatedSql: string | null = null;
  let domain: string = 'outros';
  let intent: string | null = null;
  let status: 'success' | 'sql_blocked' | 'sql_error' | 'llm_error' | 'timeout' | 'other' = 'success';
  let errorMessage: string | null = null;
  let rowsReturned = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let finalAnswer = '';
  let rows: Record<string, unknown>[] = [];
  let plan: NormalizedPlan | null = null;
  let questionType: string | null = null;
  const evidences: FormatterEvidence[] = [];
  const formatterSteps: FormatterStep[] = [];
  let externalCalls = 0;
  let externalCacheHits = 0;
  let externalCostCents = 0;
  const externalSourcesUsed: string[] = [];
  const planLimitations: string[] = [];
  // Mesma flag explicitada do handler streaming — distingue "primeiro step
  // ainda não rodou" de "primeiro step rodou e retornou zero linhas".
  let mainInternalRecorded = false;

  try {
    if (!conversationId) {
      const { data: conv, error: convErr } = await supabase
        .from('assistant_conversations')
        .insert({ user_id: userId, title: question.slice(0, 60) })
        .select('id')
        .single();
      if (convErr) throw new Error('Falha ao criar conversa: ' + convErr.message);
      conversationId = conv.id;
    }

    await supabase.from('assistant_messages').insert({
      conversation_id: conversationId, user_id: userId, role: 'user', content: question,
    });

    const { data: history } = await supabase
      .from('assistant_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              SYSTEM_PROMPT + '\n\n' + SCHEMA_CATALOG +
              '\n\n' + PLANNER_EXTERNAL_DELTA + '\n\n' + EXTERNAL_CATALOG,
          },
          ...(history ?? []).map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content,
          })),
        ],
        tools: [PLAN_TOOL],
        tool_choice: { type: 'function', function: { name: 'plan_query' } },
      }),
    });

    if (!llmResp.ok) {
      const t = await llmResp.text();
      return jsonResponse({ error: `LLM ${llmResp.status}: ${t.slice(0, 200)}`, status: 'llm_error' }, 502);
    }
    const llmData = await llmResp.json();
    tokensIn += llmData?.usage?.prompt_tokens ?? 0;
    tokensOut += llmData?.usage?.completion_tokens ?? 0;
    const toolCall = llmData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error('Modelo não retornou plano');
    const args = JSON.parse(toolCall.function.arguments);
    domain = typeof args.domain === 'string' ? args.domain : 'outros';
    intent = typeof args.intent === 'string' ? args.intent : null;
    plan = normalizePlan(args);
    questionType = plan.question_type;

    if (plan.steps.length === 0) {
      return jsonResponse(
        { error: 'Plano sem steps válidos', status: 'llm_error', plan_warnings: plan.warnings },
        502,
      );
    }

    if (plan.warnings.length) {
      for (const w of plan.warnings) planLimitations.push(`Plano ajustado: ${w}`);
    }

    const internalSteps = plan.steps.filter((s) => s.step_type === 'internal');
    generatedSql = internalSteps.length
      ? internalSteps.map((s) => `-- step ${s.id}: ${s.sub_question}\n${s.sql}`).join('\n\n;\n\n')
      : null;

    for (const step of plan.steps) {
      if (step.step_type === 'internal' && step.sql) {
        const r = await supabase.rpc('execute_assistant_query', { p_sql: step.sql });
        if (r.error) {
          const msg = (r.error.message || '').toLowerCase();
          const stepStatus: typeof status =
            msg.includes('proibido') || msg.includes('apenas')
              ? 'sql_blocked'
              : msg.includes('timeout')
              ? 'timeout'
              : 'sql_error';

          formatterSteps.push({
            id: step.id,
            sub_question: step.sub_question,
            step_type: 'internal',
            rows: [],
            rows_returned: 0,
            error: r.error.message,
          });
          if (!mainInternalRecorded && status === 'success') {
            status = stepStatus;
            errorMessage = r.error.message;
            break;
          }
          continue;
        }
        const stepRows = Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : [];
        formatterSteps.push({
          id: step.id,
          sub_question: step.sub_question,
          step_type: 'internal',
          rows: stepRows,
          rows_returned: stepRows.length,
        });
        if (!mainInternalRecorded) {
          rows = stepRows;
          rowsReturned = stepRows.length;
          mainInternalRecorded = true;
        }
        continue;
      }

      if (step.step_type === 'external' && step.external_source_id) {
        externalCalls += 1;
        externalSourcesUsed.push(step.external_source_id);
        const isWeb = inferExternalKind(step) === 'web';
        const result = await dispatchExternalStep(
          {
            source_id: step.external_source_id,
            params: step.external_params,
            query: step.external_query,
          },
          isWeb ? { perplexityFnUrl: PERPLEXITY_FN_URL, authHeader } : {},
        );

        if (result.cached) externalCacheHits += 1;
        externalCostCents += result.cost_cents;

        if (result.evidence) {
          const ev = result.evidence;
          evidences.push({
            source_id: ev.source_id,
            publisher: ev.publisher,
            claim: ev.claim,
            url: ev.url,
            access_date: ev.access_date,
            published_at: ev.published_at,
            numeric_value: ev.numeric_value,
            numeric_unit: ev.numeric_unit,
            tier: ev.tier,
            warnings: ev.warnings,
          });
          formatterSteps.push({
            id: step.id,
            sub_question: step.sub_question,
            step_type: 'external',
            external_source_id: step.external_source_id,
          });
        } else {
          const errMsg = result.error ?? 'fonte externa indisponível';
          formatterSteps.push({
            id: step.id,
            sub_question: step.sub_question,
            step_type: 'external',
            external_source_id: step.external_source_id,
            error: errMsg,
          });
          planLimitations.push(`Step ${step.id} (externo): ${errMsg}`);
        }
      }
    }

    let analysis: ReturnType<typeof buildAnalysis> | null = null;
    if (status === 'success') {
      analysis = buildAnalysis({ rows, rowsReturned, domain, sql: generatedSql, status });
      if (planLimitations.length) analysis.limitations.push(...planLimitations);
    }

    if (status !== 'success') {
      finalAnswer = 'Não consegui executar a consulta. Tente reformular.';
    } else {
      const formatterUserMessage = buildFormatterUserMessage({
        question,
        domain,
        intent,
        rows,
        rowsReturned,
        analysis: analysis
          ? {
              confidence: analysis.confidence,
              insights: analysis.insights,
              dataQuality: analysis.dataQuality,
              limitations: analysis.limitations,
              visualizations: analysis.visualizations,
            }
          : null,
        evidences: evidences.length ? evidences : null,
        steps: formatterSteps.length ? formatterSteps : null,
        finalCalculation: plan?.final_calculation ?? null,
        assumptions: plan?.assumptions ?? null,
      });

      const formatResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: FORMATTER_SYSTEM_PROMPT },
            { role: 'user', content: formatterUserMessage },
          ],
        }),
      });
      const fd = await formatResp.json();
      tokensIn += fd?.usage?.prompt_tokens ?? 0;
      tokensOut += fd?.usage?.completion_tokens ?? 0;
      finalAnswer = fd?.choices?.[0]?.message?.content ?? `Consulta retornou ${rowsReturned} linha(s).`;
    }

    const { data: logRow } = await supabase
      .from('assistant_logs')
      .insert({
        user_id: userId, conversation_id: conversationId, question,
        generated_sql: generatedSql, domain, rows_returned: rowsReturned,
        latency_ms: Date.now() - startedAt, tokens_input: tokensIn, tokens_output: tokensOut,
        model: MODEL, status, error_message: errorMessage, answer_summary: finalAnswer.slice(0, 280),
        external_calls_count: externalCalls,
        external_cache_hits: externalCacheHits,
        external_cost_cents: externalCostCents,
        external_sources_used: externalSourcesUsed.length ? externalSourcesUsed : null,
      })
      .select('id')
      .single();

    await supabase.from('assistant_messages').insert({
      conversation_id: conversationId, user_id: userId, role: 'assistant',
      content: finalAnswer,
      result_data: {
        rows: rows.slice(0, 50),
        rows_returned: rowsReturned,
        sql: generatedSql,
        domain,
        status,
        question_type: questionType,
        steps: formatterSteps.length
          ? formatterSteps.map((s) => ({
              ...s,
              rows: s.rows ? s.rows.slice(0, 30) : s.rows,
            }))
          : null,
        final_calculation: plan?.final_calculation ?? null,
        assumptions: plan?.assumptions ?? null,
        insights: analysis?.insights ?? null,
        data_quality: analysis?.dataQuality ?? null,
        visualizations: analysis?.visualizations ?? null,
        suggested_questions: analysis?.followUps ?? null,
        confidence: analysis?.confidence ?? null,
        limitations: analysis?.limitations ?? null,
        evidences: evidences.length ? evidences : null,
      },
      log_id: logRow?.id ?? null,
    });

    await supabase.from('assistant_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);

    return jsonResponse({
      conversation_id: conversationId, answer: finalAnswer,
      rows: rows.slice(0, 50), rows_returned: rowsReturned,
      sql: generatedSql, domain, intent, status, log_id: logRow?.id ?? null,
      latency_ms: Date.now() - startedAt,
      question_type: questionType,
      steps: formatterSteps.length
        ? formatterSteps.map((s) => ({
            ...s,
            rows: s.rows ? s.rows.slice(0, 30) : s.rows,
          }))
        : null,
      final_calculation: plan?.final_calculation ?? null,
      assumptions: plan?.assumptions ?? null,
      insights: analysis?.insights ?? null,
      data_quality: analysis?.dataQuality ?? null,
      visualizations: analysis?.visualizations ?? null,
      suggested_questions: analysis?.followUps ?? null,
      confidence: analysis?.confidence ?? null,
      limitations: analysis?.limitations ?? null,
      evidences: evidences.length ? evidences : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: message, status: 'other' }, 500);
  }
}
