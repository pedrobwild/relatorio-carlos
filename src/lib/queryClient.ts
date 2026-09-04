import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mapError } from "@/lib/errorMapping";
import {
  describeError,
  isExpiredSessionError,
  recoverSession,
} from "@/lib/authRecovery";

function softNavigate(to: string, options?: { replace?: boolean }) {
  if (typeof window === "undefined") return;

  const replace = options?.replace ?? true;
  const url = new URL(to, window.location.origin);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (current === next) return;

  if (replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }

  // BrowserRouter listens to POP events; pushState/replaceState don't emit them.
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// ============================================================================
// StaleTime / GcTime Configuration per Query Type
// ============================================================================

/**
 * Query timing configuration for different data types.
 * staleTime: how long data is considered fresh (no background refetch)
 * gcTime: how long unused data stays in cache before garbage collection
 */
export const QUERY_TIMING = {
  // Projects/Documents: less frequently changing, longer cache
  projects: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 }, // 5min stale, 30min gc
  documents: { staleTime: 3 * 60 * 1000, gcTime: 20 * 60 * 1000 }, // 3min stale, 20min gc

  // Activities/Schedule: moderately changing
  activities: { staleTime: 2 * 60 * 1000, gcTime: 15 * 60 * 1000 }, // 2min stale, 15min gc
  cronograma: { staleTime: 2 * 60 * 1000, gcTime: 15 * 60 * 1000 },

  // Formalizations: moderately changing
  formalizacoes: { staleTime: 2 * 60 * 1000, gcTime: 15 * 60 * 1000 },

  // Payments/Purchases: financial data, slightly shorter
  payments: { staleTime: 1 * 60 * 1000, gcTime: 10 * 60 * 1000 }, // 1min stale, 10min gc
  purchases: { staleTime: 1 * 60 * 1000, gcTime: 10 * 60 * 1000 },

  // Journey: can be cached longer
  journey: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },

  // Users/Profiles: rarely change
  users: { staleTime: 10 * 60 * 1000, gcTime: 60 * 60 * 1000 }, // 10min stale, 1hr gc

  // Default for unspecified queries
  default: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 },
} as const;

/**
 * Get timing config based on query key
 */
export function getQueryTiming(queryKey: unknown[]): {
  staleTime: number;
  gcTime: number;
} {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    return QUERY_TIMING.default;
  }

  const firstKey = String(queryKey[0]).toLowerCase();

  if (firstKey.includes("project")) return QUERY_TIMING.projects;
  if (firstKey.includes("document")) return QUERY_TIMING.documents;
  if (firstKey.includes("activit")) return QUERY_TIMING.activities;
  if (firstKey.includes("cronograma") || firstKey.includes("schedule"))
    return QUERY_TIMING.cronograma;
  if (firstKey.includes("formal")) return QUERY_TIMING.formalizacoes;
  if (firstKey.includes("payment")) return QUERY_TIMING.payments;
  if (firstKey.includes("purchase") || firstKey.includes("compra"))
    return QUERY_TIMING.purchases;
  if (firstKey.includes("journey") || firstKey.includes("jornada"))
    return QUERY_TIMING.journey;
  if (firstKey.includes("user") || firstKey.includes("profile"))
    return QUERY_TIMING.users;

  return QUERY_TIMING.default;
}

// ============================================================================
// Error Messages and Handling
// ============================================================================

// Map of error codes/messages to user-friendly Portuguese messages
const errorMessages: Record<string, string> = {
  // Network errors
  "failed to fetch":
    "Não foi possível conectar ao servidor. Verifique sua conexão.",
  "network error": "Erro de conexão. Verifique sua internet.",
  networkerror: "Erro de conexão. Verifique sua internet.",
  timeout: "A operação demorou muito. Tente novamente.",
  aborted: "A operação foi cancelada.",

  // Auth errors
  "jwt expired": "Sua sessão expirou. Faça login novamente.",
  "jwt malformed": "Sessão inválida. Faça login novamente.",
  "invalid jwt": "Sessão inválida. Faça login novamente.",
  "not authenticated": "Você precisa estar logado para esta ação.",
  unauthorized: "Você não tem permissão para esta ação.",
  "401": "Sessão expirada. Faça login novamente.",
  "403": "Você não tem permissão para acessar este recurso.",

  // Database errors
  unique_violation: "Este registro já existe.",
  foreign_key_violation:
    "Esta operação não é permitida devido a dados relacionados.",
  check_violation: "Os dados informados não são válidos.",
  not_null_violation: "Preencha todos os campos obrigatórios.",
  "23505": "Este registro já existe no sistema.",
  "23503": "Operação não permitida: dados relacionados existentes.",
  "23514": "Os dados informados não atendem aos requisitos.",
  "23502": "Campo obrigatório não preenchido.",

  // RLS errors
  "row-level security": "Você não tem permissão para acessar estes dados.",
  "new row violates row-level security":
    "Você não tem permissão para criar este registro.",
  rls: "Acesso negado. Verifique suas permissões.",

  // Storage errors
  "bucket not found": "Erro de armazenamento. Contate o suporte.",
  "object not found": "Arquivo não encontrado.",
  "payload too large":
    "Arquivo muito grande. Reduza o tamanho e tente novamente.",
  "413": "Arquivo muito grande para upload.",

  // Rate limiting
  "rate limit": "Muitas tentativas. Aguarde um momento.",
  "429": "Muitas requisições. Aguarde um momento.",

  // Server errors
  "500": "Erro interno do servidor. Tente novamente.",
  "502": "Servidor temporariamente indisponível.",
  "503": "Serviço indisponível. Tente novamente em alguns minutos.",
  "504": "Tempo de resposta excedido. Tente novamente.",

  // Generic
  pgrst: "Erro ao processar sua solicitação.",
};

// Network error patterns for retry detection
const networkErrorPatterns = [
  "failed to fetch",
  "network error",
  "networkerror",
  "timeout",
  "aborted",
  "net::err",
  "econnrefused",
  "enotfound",
  "etimedout",
];

// Auth error codes that should NOT retry
const authErrorCodes = ["401", "403"];

/**
 * Texto pesquisável de um erro.
 *
 * CUIDADO: NÃO use `String(error)` aqui. Os erros que chegam do Supabase são
 * objetos simples (`{ message, details, hint, code }`) — inclusive os que o
 * `base.repository` clona via `Object.assign({}, error, ...)`, que deixam de
 * ser instâncias de `Error`. `String(objeto)` devolve `"[object Object]"`, o
 * que fazia TODAS as heurísticas abaixo (rede, auth, JWT) darem sempre falso:
 * erros de rede nunca eram repetidos e sessão expirada nunca era detectada.
 */
function errorText(error: unknown): string {
  return describeError(error).text.toLowerCase();
}

/**
 * Um erro com SQLSTATE veio do Postgres: o servidor RECEBEU o pedido e
 * respondeu. Repetir o mesmo pedido dá o mesmo resultado — salvo nas classes
 * abaixo, em que a falha é da infraestrutura, não do pedido.
 *
 * Sem esta distinção, "canceling statement due to lock timeout" (55P03) e
 * "statement timeout" (57014) casavam com o padrão "timeout" e cada gravação
 * virava até 4 chamadas ao banco — um multiplicador da avalanche de 04/09.
 */
const SQLSTATE_RE = /^[0-9A-Z]{5}$/;
const TRANSIENT_SQLSTATE_CLASSES = new Set([
  "08", // connection exception
  "53", // insufficient resources (too many connections, out of memory…)
  "XX", // internal error
]);
const TRANSIENT_SQLSTATES = new Set([
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
]);

function isTransientPostgresError(code: string): boolean {
  return (
    TRANSIENT_SQLSTATE_CLASSES.has(code.slice(0, 2)) ||
    TRANSIENT_SQLSTATES.has(code)
  );
}

// Check if error is a network error (retryable)
function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const { code } = describeError(error);
  if (code && SQLSTATE_RE.test(code) && !isTransientPostgresError(code)) {
    return false;
  }
  const text = errorText(error);
  if (!text) return false;
  return networkErrorPatterns.some((pattern) => text.includes(pattern));
}

// Check if error is an auth error (NOT retryable)
function isAuthErrorCode(error: unknown): boolean {
  if (!error) return false;
  const { text, code, status } = describeError(error);
  if (status === 401 || status === 403) return true;
  if (code && authErrorCodes.includes(code)) return true;

  const lowered = text.toLowerCase();
  if (!lowered) return false;

  // Check for explicit auth error codes
  if (authErrorCodes.some((c) => lowered.includes(c))) {
    return true;
  }

  // Check for auth-related messages
  const authKeywords = [
    "jwt expired",
    "jwt malformed",
    "invalid jwt",
    "not authenticated",
    "unauthorized",
  ];
  return authKeywords.some((keyword) => lowered.includes(keyword));
}

/**
 * Get user-friendly message from error
 * Exported for use in custom error handling.
 *
 * Delegated to `mapError` (src/lib/errorMapping.ts) — fonte única da verdade
 * para humanização de erros. Mantemos a função aqui apenas como atalho
 * histórico para callers existentes.
 */
export function getUserFriendlyMessage(error: unknown): string {
  return mapError(error).userMessage;
}

// Mantém o objeto `errorMessages` apenas para referência (não usado em runtime).
void errorMessages;

// Check if error is an auth/permission error requiring recovery
function isAuthError(error: unknown): boolean {
  return isExpiredSessionError(error);
}

/**
 * Sessão expirada: TENTA RENOVAR antes de desistir.
 *
 * O comportamento anterior era deslogar direto — e como a detecção estava
 * quebrada (`String(error)`), na prática nunca rodava: o usuário ficava numa
 * sessão zumbi, com o nome no header e todo request devolvendo 401. Agora:
 *  1. renova o token (resolve o caso comum da aba que ficou em segundo plano);
 *  2. revalida as queries para a tela se recompor sozinha;
 *  3. só desloga se o refresh token realmente não valer mais.
 */
let authRecoveryInFlight: Promise<void> | null = null;

function handleAuthError(): Promise<void> {
  if (authRecoveryInFlight) return authRecoveryInFlight;

  authRecoveryInFlight = (async () => {
    const outcome = await recoverSession();

    if (outcome === "recovered") {
      toast.info("Conexão com sua conta renovada. Recarregando os dados…", {
        id: "session-recovered",
      });
      await queryClient.invalidateQueries();
      return;
    }

    if (outcome === "unknown") {
      // NÃO deslogar. Não conseguimos falar com o servidor de autenticação —
      // isso não prova que a sessão morreu. Deslogar aqui expulsava um
      // usuário com credencial válida só porque a rede oscilou ou a
      // renovação demorou mais que o teto de 15s.
      toast.error(
        "Estamos com instabilidade para confirmar sua sessão. Tente de novo em instantes.",
        { id: "session-unverified" },
      );
      return;
    }

    // outcome === "rejected": o servidor recusou o refresh token. Agora sim.
    toast.error("Sua sessão expirou. Entre novamente para continuar.", {
      id: "session-expired",
    });
    await supabase.auth.signOut();
    softNavigate("/auth", { replace: true });
  })().finally(() => {
    authRecoveryInFlight = null;
  });

  return authRecoveryInFlight;
}

// Generic error handler
function handleError(error: unknown, context?: string) {
  console.error(`${context || "Error"}:`, error);

  if (isAuthError(error)) {
    void handleAuthError();
    return;
  }

  const userMessage = getUserFriendlyMessage(error);
  toast.error(userMessage);
}

// Mutation retry state tracker
const mutationRetryState = new Map<
  string,
  { toastId?: string | number; attempt: number }
>();

// ============================================================================
// Query Client Configuration
// ============================================================================

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Sessão expirada tem que ser tratada SEMPRE, inclusive na primeira
      // carga. Era exatamente esse o buraco: o usuário abria o app com um
      // token vencido, tudo falhava com 401 e — como `query.state.data` ainda
      // era `undefined` — o app não avisava nem tentava renovar. Resultado:
      // "Não foi possível carregar seus projetos" para sempre.
      if (isAuthError(error)) {
        void handleAuthError();
        return;
      }

      // Demais erros: só avisa se a query já tinha funcionado antes, para não
      // encher a tela de toast durante a carga inicial.
      if (query.state.data !== undefined) {
        handleError(error, "Query error");
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const mutationId = mutation.mutationId.toString();
      const retryState = mutationRetryState.get(mutationId);

      // Clean up retry state
      if (retryState?.toastId) {
        toast.dismiss(retryState.toastId);
      }
      mutationRetryState.delete(mutationId);

      handleError(error, "Mutation error");
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      const mutationId = mutation.mutationId.toString();
      const retryState = mutationRetryState.get(mutationId);

      // Show success toast if we recovered from retry
      if (retryState && retryState.attempt > 0) {
        if (retryState.toastId) {
          toast.dismiss(retryState.toastId);
        }
        toast.success("Operação concluída após reconexão!");
      }

      mutationRetryState.delete(mutationId);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // Never retry auth errors (401/403)
        if (isAuthErrorCode(error)) {
          return false;
        }
        // Retry network errors up to 3 times
        if (isNetworkError(error) && failureCount < 3) {
          return true;
        }
        // Don't retry other errors
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: QUERY_TIMING.default.staleTime,
      gcTime: QUERY_TIMING.default.gcTime,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Never retry auth errors
        if (isAuthErrorCode(error)) {
          return false;
        }
        // Only retry network errors, up to 3 times
        if (isNetworkError(error) && failureCount < 3) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      onMutate: async () => {
        // This runs before each mutation attempt
        return { startTime: Date.now() };
      },
    },
  },
});

// Override default mutation behavior to show retry feedback
const originalMutate = queryClient
  .getMutationCache()
  .build.bind(queryClient.getMutationCache());
queryClient.getMutationCache().build = (client, options, state) => {
  const mutation = originalMutate(client, options, state);
  const originalExecute = mutation.execute.bind(mutation);

  mutation.execute = async (variables) => {
    const mutationId = mutation.mutationId.toString();

    // Track retry attempts
    const currentState = mutationRetryState.get(mutationId) || { attempt: 0 };

    try {
      const result = await originalExecute(variables);
      return result;
    } catch (error) {
      // If it's a network error and we're retrying, show feedback
      if (isNetworkError(error)) {
        const newAttempt = currentState.attempt + 1;
        const toastId = toast.loading(
          `Reconectando... Tentativa ${newAttempt} de 3`,
          { id: currentState.toastId },
        );
        mutationRetryState.set(mutationId, { toastId, attempt: newAttempt });
      }
      throw error;
    }
  };

  return mutation;
};
