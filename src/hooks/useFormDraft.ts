import { useState, useEffect, useCallback, useRef } from 'react';
import { RESTORE_DRAFT_EVENT } from '@/components/TabDiscardDetector';

const DRAFT_PREFIX = 'bwild-draft-';

interface UseFormDraftOptions<T> {
  /** Unique key for this form (e.g. 'create-nc-{projectId}') */
  key: string;
  /** Initial/default values */
  initialValues: T;
  /** How often to persist to localStorage (ms) */
  debounceMs?: number;
}

interface UseFormDraftReturn<T> {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  clearDraft: () => void;
  hasDraft: boolean;
}

/**
 * Persists form state to localStorage as a draft.
 * Restores on mount if a draft exists. Auto-saves on changes.
 */
export function useFormDraft<T extends Record<string, unknown>>({
  key,
  initialValues,
  debounceMs = 1000,
}: UseFormDraftOptions<T>): UseFormDraftReturn<T> {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const [hasDraft, setHasDraft] = useState(false);

  // Initialize from draft or defaults
  const [values, setValues] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as T;
        setHasDraft(true);
        return { ...initialValues, ...parsed };
      }
    } catch {
      // ignore
    }
    return initialValues;
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Re-hydrate from localStorage when the tab is restored from a discard.
  // TabDiscardDetector dispatches RESTORE_DRAFT_EVENT after Memory Saver wakeups.
  useEffect(() => {
    function handleRestore() {
      try {
        const saved = localStorage.getItem(storageKey);
        if (!saved) return;
        const parsed = JSON.parse(saved) as Partial<T>;
        setValues(prev => ({ ...prev, ...parsed }));
        setHasDraft(true);
      } catch {
        // ignore — corrupted draft
      }
    }
    window.addEventListener(RESTORE_DRAFT_EVENT, handleRestore);
    return () => window.removeEventListener(RESTORE_DRAFT_EVENT, handleRestore);
  }, [storageKey]);

  // Debounced persist
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        const serialized = JSON.stringify(values);
        const defaultSerialized = JSON.stringify(initialValues);
        if (serialized !== defaultSerialized) {
          localStorage.setItem(storageKey, serialized);
          setHasDraft(true);
        }
      } catch {
        // quota exceeded or other error
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [values, storageKey, debounceMs, initialValues]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setHasDraft(false);
    setValues(initialValues);
  }, [storageKey, initialValues]);

  return { values, setValues, updateField, clearDraft, hasDraft };
}
