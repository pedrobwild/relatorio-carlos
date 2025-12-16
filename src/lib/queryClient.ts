import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Map of error codes/messages to user-friendly Portuguese messages
const errorMessages: Record<string, string> = {
  // Network errors
  'failed to fetch': 'Não foi possível conectar ao servidor. Verifique sua conexão.',
  'network error': 'Erro de conexão. Verifique sua internet.',
  'networkerror': 'Erro de conexão. Verifique sua internet.',
  'timeout': 'A operação demorou muito. Tente novamente.',
  'aborted': 'A operação foi cancelada.',
  
  // Auth errors
  'jwt expired': 'Sua sessão expirou. Faça login novamente.',
  'jwt malformed': 'Sessão inválida. Faça login novamente.',
  'invalid jwt': 'Sessão inválida. Faça login novamente.',
  'not authenticated': 'Você precisa estar logado para esta ação.',
  'unauthorized': 'Você não tem permissão para esta ação.',
  '401': 'Sessão expirada. Faça login novamente.',
  '403': 'Você não tem permissão para acessar este recurso.',
  
  // Database errors
  'unique_violation': 'Este registro já existe.',
  'foreign_key_violation': 'Esta operação não é permitida devido a dados relacionados.',
  'check_violation': 'Os dados informados não são válidos.',
  'not_null_violation': 'Preencha todos os campos obrigatórios.',
  '23505': 'Este registro já existe no sistema.',
  '23503': 'Operação não permitida: dados relacionados existentes.',
  '23514': 'Os dados informados não atendem aos requisitos.',
  '23502': 'Campo obrigatório não preenchido.',
  
  // RLS errors
  'row-level security': 'Você não tem permissão para acessar estes dados.',
  'new row violates row-level security': 'Você não tem permissão para criar este registro.',
  'rls': 'Acesso negado. Verifique suas permissões.',
  
  // Storage errors
  'bucket not found': 'Erro de armazenamento. Contate o suporte.',
  'object not found': 'Arquivo não encontrado.',
  'payload too large': 'Arquivo muito grande. Reduza o tamanho e tente novamente.',
  '413': 'Arquivo muito grande para upload.',
  
  // Rate limiting
  'rate limit': 'Muitas tentativas. Aguarde um momento.',
  '429': 'Muitas requisições. Aguarde um momento.',
  
  // Server errors
  '500': 'Erro interno do servidor. Tente novamente.',
  '502': 'Servidor temporariamente indisponível.',
  '503': 'Serviço indisponível. Tente novamente em alguns minutos.',
  '504': 'Tempo de resposta excedido. Tente novamente.',
  
  // Generic
  'pgrst': 'Erro ao processar sua solicitação.',
};

// Network error patterns for retry detection
const networkErrorPatterns = [
  'failed to fetch',
  'network error',
  'networkerror',
  'timeout',
  'aborted',
  'net::err',
  'econnrefused',
  'enotfound',
  'etimedout',
];

// Check if error is a network error (retryable)
function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const errorString = String(error).toLowerCase();
  return networkErrorPatterns.some(pattern => errorString.includes(pattern));
}

// Get user-friendly message from error
function getUserFriendlyMessage(error: unknown): string {
  const errorString = String(error).toLowerCase();
  
  // Check each known error pattern
  for (const [pattern, message] of Object.entries(errorMessages)) {
    if (errorString.includes(pattern.toLowerCase())) {
      return message;
    }
  }
  
  // Extract Supabase/PostgreSQL error message if available
  if (error && typeof error === 'object') {
    const err = error as { message?: string; code?: string; details?: string; hint?: string };
    
    // Check error code first
    if (err.code && errorMessages[err.code]) {
      return errorMessages[err.code];
    }
    
    // If it has a readable message and it's not too technical
    if (err.message && !err.message.includes('PGRST') && err.message.length < 100) {
      return err.message;
    }
  }
  
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

// Check if error is an auth/permission error requiring logout
function isAuthError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = String(error).toLowerCase();
  const authKeywords = ['jwt expired', 'jwt malformed', 'invalid jwt', 'not authenticated'];
  
  return authKeywords.some(keyword => errorMessage.includes(keyword));
}

// Handle auth errors by signing out and redirecting
async function handleAuthError() {
  toast.error('Sessão expirada. Por favor, faça login novamente.');
  await supabase.auth.signOut();
  window.location.href = '/auth';
}

// Generic error handler
function handleError(error: unknown, context?: string) {
  console.error(`${context || 'Error'}:`, error);
  
  if (isAuthError(error)) {
    handleAuthError();
    return;
  }
  
  const userMessage = getUserFriendlyMessage(error);
  toast.error(userMessage);
}

// Mutation retry state tracker
const mutationRetryState = new Map<string, { toastId?: string | number; attempt: number }>();

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only show error toast if the query has already been successful before
      // This prevents showing errors on initial load failures
      if (query.state.data !== undefined) {
        handleError(error, 'Query error');
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
      
      handleError(error, 'Mutation error');
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      const mutationId = mutation.mutationId.toString();
      const retryState = mutationRetryState.get(mutationId);
      
      // Show success toast if we recovered from retry
      if (retryState && retryState.attempt > 0) {
        if (retryState.toastId) {
          toast.dismiss(retryState.toastId);
        }
        toast.success('Operação concluída após reconexão!');
      }
      
      mutationRetryState.delete(mutationId);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // Retry network errors up to 3 times
        if (isNetworkError(error) && failureCount < 3) {
          return true;
        }
        // Don't retry other errors
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: (failureCount, error) => {
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
const originalMutate = queryClient.getMutationCache().build.bind(queryClient.getMutationCache());
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
          { id: currentState.toastId }
        );
        mutationRetryState.set(mutationId, { toastId, attempt: newAttempt });
      }
      throw error;
    }
  };
  
  return mutation;
};
