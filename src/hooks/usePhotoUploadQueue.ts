import { useCallback, useEffect, useRef, useState } from "react";
import {
  listPendingUploads,
  markUploadFailure,
  removePendingUpload,
  resetPendingBackoff,
  MAX_AUTO_ATTEMPTS,
  type PendingPhotoUploadMeta,
} from "@/lib/photoUploadQueue";
import {
  uploadReportPhotoBlob,
  PermanentUploadError,
} from "@/lib/reportPhotoUpload";
import { toast } from "sonner";

interface Options {
  projectId?: string;
  weekNumber: number;
  /** Chamado quando um arquivo pendente termina de subir. */
  onUploaded: (photoId: string, path: string, url: string) => void;
  enabled?: boolean;
}

export interface PhotoUploadQueueState {
  pending: PendingPhotoUploadMeta[];
  isProcessing: boolean;
  /** Itens que esgotaram as tentativas automáticas. */
  blocked: PendingPhotoUploadMeta[];
  retryNow: () => void;
}

/** Trava global: um único processamento por aba, mesmo com vários editores. */
let processing = false;
/** Quantos arquivos são enviados por rodada (limite de trabalho). */
const BATCH_SIZE = 3;
/** Intervalo do poller enquanto houver itens aguardando backoff. */
const POLL_MS = 15_000;

export function usePhotoUploadQueue({
  projectId,
  weekNumber,
  onUploaded,
  enabled = true,
}: Options): PhotoUploadQueueState {
  const [pending, setPending] = useState<PendingPhotoUploadMeta[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const onUploadedRef = useRef(onUploaded);
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  const refresh = useCallback(async () => {
    if (!projectId) return [];
    const items = await listPendingUploads({ projectId, weekNumber });
    setPending(items.map(({ blob: _blob, ...meta }) => meta));
    return items;
  }, [projectId, weekNumber]);

  const process = useCallback(async () => {
    if (!enabled || !projectId) return;
    if (processing) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    processing = true;
    setIsProcessing(true);
    try {
      const items = await refresh();
      const now = Date.now();
      const ready = items
        .filter((i) => i.nextAttemptAt <= now && i.attempts < MAX_AUTO_ATTEMPTS)
        .slice(0, BATCH_SIZE);

      for (const item of ready) {
        try {
          const result = await uploadReportPhotoBlob({
            projectId: item.projectId,
            weekNumber: item.weekNumber,
            photoId: item.id,
            blob: item.blob,
            mimeType: item.mimeType,
          });
          // Marca a conclusão antes de qualquer outra coisa: reabrir a tela
          // não reenvia o que já subiu.
          await removePendingUpload(item.id);
          onUploadedRef.current(item.id, result.path, result.url);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Falha no envio.";
          if (error instanceof PermanentUploadError) {
            await removePendingUpload(item.id);
            toast.error(`Arquivo não enviado: ${message}`);
          } else {
            await markUploadFailure(item.id, message);
          }
        }
      }
      await refresh();
    } finally {
      processing = false;
      setIsProcessing(false);
    }
  }, [enabled, projectId, refresh]);

  useEffect(() => {
    runRef.current = () => void process();
  }, [process]);

  // Retoma ao montar (inclusive após navegar para fora e voltar, ou depois
  // de a aba ter sido descartada pelo sistema no celular).
  useEffect(() => {
    if (!enabled || !projectId) return;
    runRef.current();

    const onVisible = () => {
      if (!document.hidden) runRef.current();
    };
    const onOnline = () => runRef.current();
    const timer = setInterval(() => runRef.current(), POLL_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onOnline);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onOnline);
    };
  }, [enabled, projectId]);

  const retryNow = useCallback(() => {
    void (async () => {
      await resetPendingBackoff(pending.map((p) => p.id));
      await process();
    })();
  }, [pending, process]);

  return {
    pending,
    isProcessing,
    blocked: pending.filter((p) => p.attempts >= MAX_AUTO_ATTEMPTS),
    retryNow,
  };
}
