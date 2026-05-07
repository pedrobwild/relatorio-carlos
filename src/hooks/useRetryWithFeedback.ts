import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

interface RetryState {
  isRetrying: boolean;
  attempt: number;
  maxAttempts: number;
}

const isNetworkError = (error: unknown): boolean => {
  if (!error) return false;
  const errorString = String(error).toLowerCase();
  const networkPatterns = [
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
  return networkPatterns.some((pattern) => errorString.includes(pattern));
};

export function useRetryWithFeedback<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    maxAttempts: maxRetries,
  });

  const toastIdRef = useRef<string | number | undefined>();

  const dismissToast = useCallback(() => {
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = undefined;
    }
  }, []);

  const execute = useCallback(async (): Promise<T> => {
    let lastError: unknown;
    let currentDelay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setState({ isRetrying: true, attempt, maxAttempts: maxRetries });
          toastIdRef.current = toast.loading(
            `Reconectando... Tentativa ${attempt} de ${maxRetries}`,
            { id: toastIdRef.current },
          );
        }

        const result = await operation();

        if (attempt > 0) {
          dismissToast();
          toast.success("Conexão restabelecida!");
        }

        setState({ isRetrying: false, attempt: 0, maxAttempts: maxRetries });
        return result;
      } catch (error) {
        lastError = error;

        if (!isNetworkError(error) || attempt === maxRetries) {
          dismissToast();
          setState({ isRetrying: false, attempt: 0, maxAttempts: maxRetries });
          throw error;
        }

        // Wait before next retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
      }
    }

    throw lastError;
  }, [
    operation,
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    dismissToast,
  ]);

  const reset = useCallback(() => {
    dismissToast();
    setState({ isRetrying: false, attempt: 0, maxAttempts: maxRetries });
  }, [dismissToast, maxRetries]);

  return {
    execute,
    reset,
    ...state,
  };
}

// Hook for mutation operations with automatic retry
export function useMutationWithRetry<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: RetryOptions = {},
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    execute: _executeWithRetry,
    isRetrying,
    attempt,
    maxAttempts,
    reset,
  } = useRetryWithFeedback(() => Promise.resolve(), options);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);

      const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        backoffMultiplier = 2,
      } = options;
      let lastError: unknown;
      let currentDelay = initialDelay;
      let toastId: string | number | undefined;

      for (let attemptNum = 0; attemptNum <= maxRetries; attemptNum++) {
        try {
          if (attemptNum > 0) {
            toastId = toast.loading(
              `Reconectando... Tentativa ${attemptNum} de ${maxRetries}`,
              { id: toastId },
            );
          }

          const result = await mutationFn(variables);

          if (attemptNum > 0) {
            toast.dismiss(toastId);
            toast.success("Operação concluída após reconexão!");
          }

          setIsLoading(false);
          return result;
        } catch (err) {
          lastError = err;

          if (!isNetworkError(err) || attemptNum === maxRetries) {
            if (toastId) toast.dismiss(toastId);
            setIsLoading(false);
            setError(err instanceof Error ? err : new Error(String(err)));
            throw err;
          }

          await new Promise((resolve) => setTimeout(resolve, currentDelay));
          currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
        }
      }

      throw lastError;
    },
    [mutationFn, options],
  );

  return {
    mutate,
    isLoading,
    isRetrying,
    attempt,
    maxAttempts,
    error,
    reset: () => {
      reset();
      setError(null);
    },
  };
}
