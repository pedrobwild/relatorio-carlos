import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Check if error is an auth/permission error
function isAuthError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = String(error).toLowerCase();
  const authKeywords = ['unauthorized', '401', '403', 'jwt', 'token', 'permission', 'auth'];
  
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
  
  // Show user-friendly error message
  const message = error instanceof Error ? error.message : 'Ocorreu um erro inesperado';
  
  // Avoid showing technical/internal errors to users
  if (message.includes('fetch') || message.includes('network')) {
    toast.error('Erro de conexão. Verifique sua internet.');
  } else if (!message.includes('Missing or invalid environment')) {
    toast.error(message);
  }
}

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
    onError: (error) => {
      handleError(error, 'Mutation error');
    },
  }),
  defaultOptions: {
    queries: {
      // Disable automatic refetching to keep UX stable
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // Retry once on failure
      retry: 1,
      // Consider data stale after 5 minutes
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      // Don't retry mutations automatically
      retry: false,
    },
  },
});
