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
} from "./base.repository";
import type { Json } from "@/integrations/supabase/types";

// ============================================================================
// Types — espelham a seção `state_memory` da spec
// ============================================================================

export type AgentEventType =
  | "new_project"
  | "project_update"
  | "schedule_request"
  | "budget_request"
  | "field_problem"
  | "client_message"
  | "supplier_quote"
  | "purchase_decision"
  | "quality_inspection"
  | "scope_change"
  | "handover";

export type AgentEventSource =
  | "cliente"
  | "equipe"
  | "fornecedor"
  | "gestor"
  | "vistoria"
  | "documento";

export type AgentEventStatus =
  | "success"
  | "llm_error"
  | "state_error"
  | "auth_error"
  | "other";

export type RoutedAgent =
  | "master_bwild"
  | "schedule_planner"
  | "cost_engineer"
  | "procurement_manager"
  | "field_engineer"
  | "root_cause_engineer"
  | "coordination_engineer"
  | "risk_manager"
  | "quality_controller"
  | "client_communication"
  | "supplier_evaluator"
  | "millwork_agent"
  | "stonework_agent"
  | "delay_recovery"
  | "handover_postwork";

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

const STATE_TABLE = "project_state_memory";
const EVENTS_TABLE = "bwild_agent_events";

// As tabelas `project_state_memory` e `bwild_agent_events` ainda não estão no
// Database type gerado. Como não temos schema tipado para elas, criamos wrappers
// que expõem funções com assinaturas totalmente tipadas (Insert/Update/Row),
// confinando o cast dinâmico numa única linha por operação. Ao regenerar o
// Database type, basta substituir `unsafeFrom(...)` por `supabase.from(...)`.
import type { PostgrestError } from "@supabase/supabase-js";

type StateInsert = { project_id: string; state: Json };
type EventInsert = CreateAgentEventInput;

type SingleResult<T> = { data: T | null; error: PostgrestError | null };
type ListResult<T> = { data: T[] | null; error: PostgrestError | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnsafeBuilder = any;
function unsafeFrom(table: string): UnsafeBuilder {
  return (supabase.from as unknown as (t: string) => UnsafeBuilder)(table);
}

async function selectStateByProject(
  projectId: string,
): Promise<SingleResult<ProjectStateMemory>> {
  const result = (await unsafeFrom(STATE_TABLE)
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle()) as SingleResult<ProjectStateMemory>;
  return { data: result.data ?? null, error: result.error };
}

async function insertState(
  values: StateInsert,
): Promise<SingleResult<ProjectStateMemory>> {
  return (await unsafeFrom(STATE_TABLE)
    .insert(values)
    .select("*")
    .single()) as SingleResult<ProjectStateMemory>;
}

async function upsertState(
  values: StateInsert,
): Promise<SingleResult<ProjectStateMemory>> {
  return (await unsafeFrom(STATE_TABLE)
    .upsert(values, { onConflict: "project_id" })
    .select("*")
    .single()) as SingleResult<ProjectStateMemory>;
}

async function selectEventsByProject(
  projectId: string,
  limit: number,
): Promise<ListResult<BwildAgentEvent>> {
  const result = (await unsafeFrom(EVENTS_TABLE)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit)) as ListResult<BwildAgentEvent>;
  return { data: result.data ?? null, error: result.error };
}

async function insertEvent(
  values: EventInsert,
): Promise<SingleResult<BwildAgentEvent>> {
  return (await unsafeFrom(EVENTS_TABLE)
    .insert(values)
    .select("*")
    .single()) as SingleResult<BwildAgentEvent>;
}

/**
 * Busca a memória do projeto. Retorna null se ainda não existir.
 */
export async function getProjectState(
  projectId: string,
): Promise<RepositoryResult<ProjectStateMemory | null>> {
  return executeQuery(async () => {
    return await selectStateByProject(projectId);
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
    return await insertState({ project_id: projectId, state: {} });
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
    return await upsertState({
      project_id: projectId,
      state: state as unknown as Json,
    });
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
    return await selectEventsByProject(projectId, limit);
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
    return await insertEvent(input);
  });
}
