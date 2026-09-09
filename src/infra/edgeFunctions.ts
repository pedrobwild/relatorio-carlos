/**
 * Edge Functions Helper
 *
 * Centralized edge function invocation helper.
 * Avoids direct supabase imports in components for edge function calls.
 */

import { supabase } from "@/infra/supabase";
import type {
  AgentEventSource,
  AgentEventType,
  RoutedAgent,
} from "@/infra/repositories/agentMemory.repository";

/**
 * Invoke an edge function via supabase.functions.invoke
 */
export async function invokeFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<{ data: T | null; error: any }> {
  return supabase.functions.invoke<T>(functionName, { body });
}

/**
 * Extrai a mensagem de erro real devolvida por uma edge function.
 *
 * `supabase.functions.invoke` converte qualquer resposta não-2xx em um
 * `FunctionsHttpError` com mensagem genérica ("Edge Function returned a
 * non-2xx status code"); o motivo em PT-BR fica no corpo JSON (`{ error }`),
 * acessível pelo `context` (a `Response` original).
 */
export async function readFunctionError(
  error: unknown,
  fallback = "Erro inesperado",
): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      // clone() para não consumir o corpo de quem também for lê-lo.
      const body = await context.clone().json();
      const detail = (body as { error?: unknown } | null)?.error;
      if (typeof detail === "string" && detail.trim()) return detail;
    } catch {
      // corpo já consumido, vazio ou não-JSON — cai na mensagem do erro
    }
  }

  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

/**
 * Invoke an edge function via fetch (for FormData uploads)
 */
export async function invokeFunctionRaw(
  functionName: string,
  options: RequestInit,
): Promise<Response> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${baseUrl}/functions/v1/${functionName}`, {
    ...options,
    headers,
  });
}

/**
 * Get current auth session token
 */
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ============================================================================
// BWild Agent
// ============================================================================

export interface BwildAgentRequest {
  project_id: string;
  event_type: AgentEventType;
  content: string;
  source?: AgentEventSource;
}

export interface BwildAgentResponse {
  event_id: string | null;
  project_id: string;
  routed_agent: RoutedAgent;
  routing_reason: string;
  status: "success" | "llm_error" | "state_error" | "other";
  response: {
    diagnostico?: string;
    premissas?: string[];
    impactos?: Record<string, string>;
    recomendacao?: string;
    plano_de_acao?: string[];
    riscos?: string[];
    decisoes_necessarias?: string[];
    memoria_atualizada?: Record<string, unknown>;
  } | null;
  state_diff: Record<string, unknown>;
  state_version: number | null;
  latency_ms: number;
  error: string | null;
}

/**
 * Invoca o orquestrador BWild para um evento de obra.
 * Spec: docs/BWILD_AI_AGENTS_SPEC.yaml
 */
export async function invokeBwildAgent(
  request: BwildAgentRequest,
): Promise<{ data: BwildAgentResponse | null; error: unknown }> {
  return invokeFunction<BwildAgentResponse>(
    "bwild-agent",
    request as unknown as Record<string, unknown>,
  );
}
