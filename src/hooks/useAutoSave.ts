import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

interface UseAutoSaveOptions<T> {
  data: T;
  // `onSave` may optionally return the data shape that was actually
  // persisted (e.g. when the save pipeline rewrites blob: URLs to
  // permanent ones after upload). When a value is returned, it becomes
  // the new "last saved" baseline — so the next change-detection cycle
  // doesn't fire another save just because the local data was patched
  // to match what the server stored. Return nothing (or void) when the
  // saved shape equals the input.
  onSave: (data: T) => void | T | Promise<void | T>;
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
  const previousSavedDataRef = useRef<string>("");
  const isFirstRender = useRef(true);

  // Keep refs for latest values to avoid recreating callbacks
  const dataRef = useRef<T>(data);
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);

  // Update refs when values change
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Serialize data for comparison - only used for change detection
  const serializedData = JSON.stringify(data);

  // Guard against concurrent saves
  const isSavingRef = useRef(false);
  // Set when a save is requested while another save is in flight — the
  // newer data must be persisted when the current save finishes, instead
  // of being silently dropped (causa de perda de dados ao trocar de aba).
  const pendingTrailingSaveRef = useRef(false);
  // Self-reference so performSave can schedule a trailing save.
  const performSaveRef = useRef<() => Promise<void>>(async () => {});

  // Stable performSave that reads from refs
  const performSave = useCallback(async () => {
    if (!enabledRef.current) return;
    if (isSavingRef.current) {
      // Prevent concurrent saves, but remember that newer data is pending
      pendingTrailingSaveRef.current = true;
      return;
    }

    const currentData = dataRef.current;
    const currentSerialized = JSON.stringify(currentData);

    // Double-check if data actually changed since last save
    if (currentSerialized === previousSavedDataRef.current) {
      return;
    }

    isSavingRef.current = true;
    try {
      setIsSaving(true);
      const result = await onSaveRef.current(currentData);
      setLastSaved(new Date());
      // If onSave returned the persisted shape, use it as the new
      // baseline so post-save reshaping (e.g. blob: → signed URL) doesn't
      // trigger a phantom diff that re-fires the debounce or shows a
      // bogus "unsaved changes" warning on beforeunload.
      previousSavedDataRef.current =
        result !== undefined && result !== null
          ? JSON.stringify(result)
          : currentSerialized;
    } catch (error) {
      console.error("Auto-save failed:", error);
      // IMPORTANT: Do NOT update previousSavedDataRef on error
      // This ensures we'll retry on next change/visibility event
      toast.error(
        "Erro ao salvar o relatório. Suas alterações foram mantidas, tente novamente.",
      );
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      // Trailing save: data changed while this save was in flight (or a
      // save was requested during it). Persist the latest snapshot now.
      const latestSerialized = JSON.stringify(dataRef.current);
      if (
        enabledRef.current &&
        (pendingTrailingSaveRef.current ||
          latestSerialized !== previousSavedDataRef.current)
      ) {
        pendingTrailingSaveRef.current = false;
        setTimeout(() => {
          void performSaveRef.current();
        }, 0);
      }
    }
  }, []); // No dependencies - uses refs

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  // Debounced auto-save effect
  useEffect(() => {
    // Skip first render to avoid saving initial state
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousSavedDataRef.current = serializedData;
      return;
    }

    // Skip if data hasn't changed from last SAVED state
    if (serializedData === previousSavedDataRef.current) {
      return;
    }

    // Skip if not enabled
    if (!enabled) return;

    // Clear existing timeout - this is the key debounce behavior
    // Every change resets the timer, so save only happens after user stops editing
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    // Cleanup on unmount or when serializedData changes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [serializedData, debounceMs, enabled, performSave]);

  // Save on visibility change (user leaving page)
  useEffect(() => {
    if (!enabled) return;

    const flushUnsaved = () => {
      const currentSerialized = JSON.stringify(dataRef.current);
      if (currentSerialized !== previousSavedDataRef.current) {
        // Clear pending timeout and save immediately
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        performSave();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) flushUnsaved();
    };

    // pagehide é mais confiável que beforeunload em mobile (iOS/Android),
    // onde a aba pode ser congelada ou descartada sem beforeunload.
    const handlePageHide = () => {
      flushUnsaved();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentSerialized = JSON.stringify(dataRef.current);
      if (currentSerialized !== previousSavedDataRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, performSave]);

  // Cleanup on unmount: em vez de apenas cancelar o debounce pendente
  // (o que descartava silenciosamente edições recentes ao navegar/trocar
  // de aba interna), tenta um save final best-effort se houver mudanças.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const currentSerialized = JSON.stringify(dataRef.current);
      if (
        enabledRef.current &&
        currentSerialized !== previousSavedDataRef.current
      ) {
        void performSaveRef.current();
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
