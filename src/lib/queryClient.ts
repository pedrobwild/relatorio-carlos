import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mapError } from "@/lib/errorMapping";

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

// Check if error is a network error (retryable)
function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const errorString = String(error).toLowerCase();
  return networkErrorPatterns.some((pattern) => errorString.includes(pattern));
}

// Check if error is an auth error (NOT retryable)
function isAuthErrorCode(error: unknown): boolean {
  if (!error) return false;
  const errorString = String(error).toLowerCase();

  // Check for explicit auth error codes
  if (authErrorCodes.some((code) => errorString.includes(code))) {
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
  return authKeywords.some((keyword) => errorString.includes(keyword));
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

// Check if error is an auth/permission error requiring logout
function isAuthError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = String(error).toLowerCase();
  const authKeywords = [
    "jwt expired",
    "jwt malformed",
    "invalid jwt",
    "not authenticated",
  ];

  return authKeywords.some((keyword) => errorMessage.includes(keyword));
}

// Handle auth errors by signing out and redirecting
async function handleAuthError() {
  toast.error("Sessão expirada. Por favor, faça login novamente.");
  await supabase.auth.signOut();
  softNavigate("/auth", { replace: true });
}

// Generic error handler
function handleError(error: unknown, context?: string) {
  console.error(`${context || "Error"}:`, error);

  if (isAuthError(error)) {
    handleAuthError();
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
      // Only show error toast if the query has already been successful before
      // This prevents showing errors on initial load failures
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
