import { useEffect, useRef, useState, useCallback } from "react";

const PREFIX = "bwild-dialog-draft-";

interface UseDialogDraftOptions<T> {
  /** Unique storage key (e.g. `atividade-new-${obraId}` or `fornecedor-edit-${id}`). */
  key: string;
  /** Whether the draft system should be active (typically: dialog open + not loading). */
  enabled: boolean;
  /** Current values to persist. */
  values: T;
  /** Called when a saved draft is found on activation. Receives the persisted partial values. */
  onRestore?: (draft: Partial<T>) => void;
  /** Debounce in ms before writing to localStorage. */
  debounceMs?: number;
  /**
   * Optional predicate to decide if a draft is "meaningful" enough to persist
   * (e.g. user actually typed something). Defaults to: always persist when enabled.
   */
  isDirty?: (values: T) => boolean;
}

interface UseDialogDraftReturn {
  /** True when a saved draft was restored on this activation. */
  restored: boolean;
  /** True when there's currently a persisted draft for this key. */
  hasDraft: boolean;
  /** Manually clear the persisted draft (call after successful submit). */
  clearDraft: () => void;
  /** Timestamp of last autosave (null if not saved yet). */
  lastSavedAt: Date | null;
}

/**
 * Lightweight per-dialog autosave to localStorage.
 *
 * Use to protect form data from being lost when:
 *   - the user accidentally closes the dialog
 *   - the page is refreshed
 *   - the browser tab crashes
 *
 * Restores the draft once when `enabled` flips to true, then debounces persistence
 * on every change. Call `clearDraft()` after a successful submission.
 */
export function useDialogDraft<T>({
  key,
  enabled,
  values,
  onRestore,
  debounceMs = 800,
  isDirty,
}: UseDialogDraftOptions<T>): UseDialogDraftReturn {
  const storageKey = `${PREFIX}${key}`;
  const [restored, setRestored] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const restoreAttemptedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset restore flag when activation toggles off
  useEffect(() => {
    if (!enabled) {
      restoreAttemptedRef.current = false;
      setRestored(false);
    }
  }, [enabled]);

  // Try restoring once when enabled becomes true
  useEffect(() => {
    if (!enabled || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setHasDraft(true);
        setRestored(true);
        onRestore?.(parsed);
      }
    } catch {
      // ignore corrupted draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storageKey]);

  // Debounced persist while enabled
  useEffect(() => {
    if (!enabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      try {
        if (isDirty && !isDirty(values)) {
          // Not dirty: drop any leftover draft
          localStorage.removeItem(storageKey);
          setHasDraft(false);
          return;
        }
        localStorage.setItem(storageKey, JSON.stringify(values));
        setHasDraft(true);
        setLastSavedAt(new Date());
      } catch {
        // quota exceeded or serialization error — silently ignore
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [values, enabled, storageKey, debounceMs, isDirty]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setHasDraft(false);
    setRestored(false);
    setLastSavedAt(null);
  }, [storageKey]);

  return { restored, hasDraft, clearDraft, lastSavedAt };
}
