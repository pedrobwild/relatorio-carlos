import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import {
  clearOfflineSnapshot,
  enqueueOfflineSnapshot,
  isOffline,
  readOfflineSnapshot,
} from "@/lib/offlineAutoSaveQueue";

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
  /**
   * Chave da fila offline (ex.: `weekly-report:<projectId>`). Quando
   * informada, as alterações que não puderam ir ao servidor ficam
   * guardadas localmente e sobem sozinhas quando a conexão voltar.
   */
  offlineKey?: string;
}

export type AutoSaveStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "retrying"
  | "error"
  | "offline";

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
  saveNow: () => void;
  /** Estado atual para o indicador de autosave. */
  status: AutoSaveStatus;
  /** Tentativas de gravação já feitas na falha atual (0 quando não há falha). */
  attempt: number;
  /** Segundos até a próxima tentativa automática (null quando não há). */
  retryInSeconds: number | null;
  /** Mensagem amigável do último erro de gravação. */
  errorMessage: string | null;
  /** Há alterações guardadas localmente aguardando sincronização. */
  hasOfflineChanges: boolean;
  /** Momento em que a alteração offline mais recente foi enfileirada. */
  offlineSince: Date | null;
}

/** Backoff das tentativas automáticas: 5s, 15s, 45s. */
const RETRY_DELAYS_MS = [5000, 15000, 45000];

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 3000,
  enabled = true,
  offlineKey,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  const [retryInSeconds, setRetryInSeconds] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef(0);
  const previousSavedDataRef = useRef<string>("");
  const isFirstRender = useRef(true);

  // ---- Fila offline -------------------------------------------------
  const offlineKeyRef = useRef(offlineKey);
  offlineKeyRef.current = offlineKey;
  const [offlineSince, setOfflineSince] = useState<Date | null>(() => {
    if (!offlineKey) return null;
    const queued = readOfflineSnapshot<T>(offlineKey);
    return queued ? new Date(queued.queuedAt) : null;
  });

  const queueOffline = useCallback((snapshot: T) => {
    const key = offlineKeyRef.current;
    if (!key) return;
    enqueueOfflineSnapshot(key, snapshot);
    setOfflineSince(new Date());
  }, []);

  const clearOffline = useCallback(() => {
    const key = offlineKeyRef.current;
    if (key) clearOfflineSnapshot(key);
    setOfflineSince(null);
  }, []);




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

  const clearRetryTimers = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setRetryInSeconds(null);
  }, []);

  // Agenda a próxima tentativa automática com backoff progressivo.
  const scheduleRetry = useCallback(() => {
    clearRetryTimers();
    const delay = RETRY_DELAYS_MS[attemptRef.current - 1];
    if (!delay) {
      // Esgotou as tentativas automáticas: cabe ao usuário tentar de novo.
      setStatus("error");
      toast.error(
        "Não foi possível salvar automaticamente. Suas alterações estão na tela — use “Tentar novamente”.",
      );
      return;
    }

    setStatus("retrying");
    let remaining = Math.round(delay / 1000);
    setRetryInSeconds(remaining);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setRetryInSeconds(remaining > 0 ? remaining : 0);
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }, 1000);

    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null;
      void performSaveRef.current();
    }, delay);
  }, [clearRetryTimers]);

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

    // Sem conexão: guarda localmente e espera o evento "online" em vez de
    // queimar tentativas que já sabemos que vão falhar.
    if (offlineKeyRef.current && isOffline()) {
      queueOffline(currentData);
      clearRetryTimers();
      setStatus("offline");
      return;
    }

    isSavingRef.current = true;
    let failed = false;
    try {
      clearRetryTimers();
      setIsSaving(true);
      setStatus("saving");
      const result = await onSaveRef.current(currentData);
      setLastSaved(new Date());
      attemptRef.current = 0;
      setAttempt(0);
      setErrorMessage(null);
      clearOffline();
      setStatus("saved");

      // If onSave returned the persisted shape, use it as the new
      // baseline so post-save reshaping (e.g. blob: → signed URL) doesn't
      // trigger a phantom diff that re-fires the debounce or shows a
      // bogus "unsaved changes" warning on beforeunload.
      previousSavedDataRef.current =
        result !== undefined && result !== null
          ? JSON.stringify(result)
          : currentSerialized;
    } catch (error) {
      failed = true;
      console.error("Auto-save failed:", error);
      // IMPORTANT: Do NOT update previousSavedDataRef on error
      // This ensures we'll retry on next change/visibility event
      attemptRef.current += 1;
      setAttempt(attemptRef.current);
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Falha de conexão ao salvar.",
      );
      setStatus("error");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      if (failed) {
        // Nova tentativa com backoff em vez de repetir imediatamente.
        scheduleRetry();
      } else {
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
    }
  }, [clearRetryTimers, scheduleRetry]);


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

    // Alterações pendentes ainda não gravadas
    if (!isSavingRef.current) {
      setStatus((s) => (s === "error" || s === "retrying" ? s : "pending"));
    }

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
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      const currentSerialized = JSON.stringify(dataRef.current);
      if (
        enabledRef.current &&
        currentSerialized !== previousSavedDataRef.current
      ) {
        void performSaveRef.current();
      }
    };
  }, []);

  // Ao recuperar a conexão, tenta imediatamente em vez de esperar o backoff.
  useEffect(() => {
    const handleOnline = () => {
      if (attemptRef.current > 0) {
        clearRetryTimers();
        void performSaveRef.current();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [clearRetryTimers]);

  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Retry manual reinicia o ciclo de tentativas automáticas.
    attemptRef.current = 0;
    setAttempt(0);
    clearRetryTimers();
    performSave();
  }, [performSave, clearRetryTimers]);

  return {
    isSaving,
    lastSaved,
    saveNow,
    status,
    attempt,
    retryInSeconds,
    errorMessage,
  };

}
