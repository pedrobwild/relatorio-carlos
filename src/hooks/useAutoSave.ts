import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

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

  // Stable performSave that reads from refs
  const performSave = useCallback(async () => {
    if (!enabledRef.current) return;
    if (isSavingRef.current) return; // Prevent concurrent saves

    const currentData = dataRef.current;
    const currentSerialized = JSON.stringify(currentData);

    // Double-check if data actually changed since last save
    if (currentSerialized === previousSavedDataRef.current) {
      return;
    }

    isSavingRef.current = true;
    try {
      setIsSaving(true);
      await onSaveRef.current(currentData);
      setLastSaved(new Date());
      // Update the "saved" reference so we don't trigger re-saves
      previousSavedDataRef.current = currentSerialized;
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
    }
  }, []); // No dependencies - uses refs

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

    const handleVisibilityChange = () => {
      const currentSerialized = JSON.stringify(dataRef.current);
      if (
        document.hidden &&
        currentSerialized !== previousSavedDataRef.current
      ) {
        // Clear pending timeout and save immediately
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        performSave();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentSerialized = JSON.stringify(dataRef.current);
      if (currentSerialized !== previousSavedDataRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, performSave]);

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
