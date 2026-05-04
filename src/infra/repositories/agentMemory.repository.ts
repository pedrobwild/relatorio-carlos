/**
 * BWild Agent Memory Repository
 *
 * Acesso à memória stateful por projeto (`project_state_memory`) e ao log
 * de eventos do agente (`bwild_agent_events`). Spec autoritativa em
 * docs/BWILD_AI_AGENTS_SPEC.yaml — manter sincronizado.
 *
 * As tabelas ainda não estão no Database type gerado; usamos casts pontuais
 * aqui até a regeneração de tipos.
 */

import {
  supabase,
  executeQuery,
  executeListQuery,
  type RepositoryResult,
  type RepositoryListResult,
} from './base.repository';
import type { Json } from '@/integrations/supabase/types';

// ============================================================================
// Types — espelham a seção `state_memory` da spec
// ============================================================================

export type AgentEventType =
  | 'new_project'
  | 'project_update'
  | 'schedule_request'
  | 'budget_request'
  | 'field_problem'
  | 'client_message'
  | 'supplier_quote'
  | 'purchase_decision'
  | 'quality_inspection'
  | 'scope_change'
  | 'handover';

export type AgentEventSource =
  | 'cliente'
  | 'equipe'
  | 'fornecedor'
  | 'gestor'
  | 'vistoria'
  | 'documento';

export type AgentEventStatus =
  | 'success'
  | 'llm_error'
  | 'state_error'
  | 'auth_error'
  | 'other';

export type RoutedAgent =
  | 'master_bwild'
  | 'schedule_planner'
  | 'cost_engineer'
  | 'procurement_manager'
  | 'field_engineer'
  | 'root_cause_engineer'
  | 'coordination_engineer'
  | 'risk_manager'
  | 'quality_controller'
  | 'client_communication'
  | 'supplier_evaluator'
  | 'millwork_agent'
  | 'stonework_agent'
  | 'delay_recovery'
  | 'handover_postwork';

export interface ProjectStateMemory {
  id: string;
  project_id: string;
  state: ProjectState;
  version: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Snapshot da memória do projeto. Todas as chaves são opcionais para
 * permitir adoção incremental — o agente pode preencher conforme aprende.
 */
export interface ProjectState {
  project_context?: Record<string, Json>;
  technical_scope?: Record<string, Json>;
  design_status?: Record<string, Json>;
  schedule_state?: Record<string, Json>;
  financial_state?: Record<string, Json>;
  procurement_state?: Record<string, Json>;
  execution_state?: Record<string, Json>;
  quality_state?: Record<string, Json>;
  communication_state?: Record<string, Json>;
}

export interface BwildAgentEvent {
  id: string;
  project_id: string;
  user_id: string | null;
  event_type: AgentEventType;
  source: AgentEventSource | null;
  content: string;
  routed_agent: RoutedAgent | null;
  response: Json | null;
  state_diff: Json | null;
  state_version: number | null;
  model: string | null;
  tokens_input: number;
  tokens_output: number;
  latency_ms: number | null;
  status: AgentEventStatus;
  error_message: string | null;
  created_at: string;
}

export interface CreateAgentEventInput {
  project_id: string;
  user_id?: string | null;
  event_type: AgentEventType;
  source?: AgentEventSource | null;
  content: string;
  routed_agent?: RoutedAgent | null;
  response?: Json | null;
  state_diff?: Json | null;
  state_version?: number | null;
  model?: string | null;
  tokens_input?: number;
  tokens_output?: number;
  latency_ms?: number | null;
  status?: AgentEventStatus;
  error_message?: string | null;
}

// ============================================================================
// Repository functions
// ============================================================================

const STATE_TABLE = 'project_state_memory';
const EVENTS_TABLE = 'bwild_agent_events';

// Cast para contornar tipos não regenerados. Substituir ao regenerar Database types.
const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
};

/**
 * Busca a memória do projeto. Retorna null se ainda não existir.
 */
export async function getProjectState(
  projectId: string,
): Promise<RepositoryResult<ProjectStateMemory | null>> {
  return executeQuery(async () => {
    const { data, error } = await db
      .from(STATE_TABLE)
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    return {
      data: (data as unknown as ProjectStateMemory | null) ?? null,
      error,
    };
  });
}

/**
 * Cria a linha de memória inicial (vazia) para um projeto.
 * Idempotente via UNIQUE(project_id) — se já existir, retorna a existente.
 */
export async function ensureProjectState(
  projectId: string,
): Promise<RepositoryResult<ProjectStateMemory>> {
  const existing = await getProjectState(projectId);
  if (existing.data) {
    return { data: existing.data, error: existing.error };
  }
  if (existing.error) {
    return { data: null, error: existing.error };
  }

  return executeQuery(async () => {
    const { data, error } = await db
      .from(STATE_TABLE)
      .insert({ project_id: projectId, state: {} })
      .select('*')
      .single();
    return { data: data as unknown as ProjectStateMemory, error };
  });
}

/**
 * Substitui o JSON `state` inteiro. O merge fica responsabilidade do caller
 * (normalmente a Edge Function), que conhece o diff produzido pelo agente.
 */
export async function replaceProjectState(
  projectId: string,
  state: ProjectState,
): Promise<RepositoryResult<ProjectStateMemory>> {
  return executeQuery(async () => {
    const { data, error } = await db
      .from(STATE_TABLE)
      .upsert(
        { project_id: projectId, state: state as unknown as Json },
        { onConflict: 'project_id' },
      )
      .select('*')
      .single();
    return { data: data as unknown as ProjectStateMemory, error };
  });
}

/**
 * Lista os eventos do agente para um projeto, mais recentes primeiro.
 */
export async function listAgentEvents(
  projectId: string,
  options: { limit?: number } = {},
): Promise<RepositoryListResult<BwildAgentEvent>> {
  const limit = options.limit ?? 50;
  return executeListQuery(async () => {
    const { data, error } = await db
      .from(EVENTS_TABLE)
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: (data as unknown as BwildAgentEvent[] | null) ?? null, error };
  });
}

/**
 * Insere um evento de agente. Geralmente chamado pela Edge Function via
 * service_role; mantemos aqui para uso em testes/admin.
 */
export async function recordAgentEvent(
  input: CreateAgentEventInput,
): Promise<RepositoryResult<BwildAgentEvent>> {
  return executeQuery(async () => {
    const { data, error } = await db
      .from(EVENTS_TABLE)
      .insert(input)
      .select('*')
      .single();
    return { data: data as unknown as BwildAgentEvent, error };
  });
}
