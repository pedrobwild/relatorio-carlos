import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => void | Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
  saveNow: () => void;
}

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 3000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<string>('');
  const isFirstRender = useRef(true);

  // Serialize data for comparison
  const serializedData = JSON.stringify(data);

  const performSave = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setIsSaving(true);
      await onSave(data);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
      toast.error('Erro ao salvar automaticamente');
    } finally {
      setIsSaving(false);
    }
  }, [data, onSave, enabled]);

  // Debounced auto-save effect
  useEffect(() => {
    // Skip first render to avoid saving initial state
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousDataRef.current = serializedData;
      return;
    }

    // Skip if data hasn't changed
    if (serializedData === previousDataRef.current) {
      return;
    }

    // Update previous data ref
    previousDataRef.current = serializedData;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Skip if not enabled
    if (!enabled) return;

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [serializedData, debounceMs, enabled, performSave]);

  // Save on visibility change (user leaving page)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden && serializedData !== previousDataRef.current) {
        // Clear pending timeout and save immediately
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        performSave();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (serializedData !== previousDataRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, serializedData, performSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    performSave();
  }, [performSave]);

  return {
    isSaving,
    lastSaved,
    saveNow,
  };
}
