import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";

interface Options {
  status: AutoSaveStatus;
  lastSaved: Date | null;
  errorMessage?: string | null;
  /** Dispara uma nova tentativa imediata de gravação. */
  onRetry?: () => void;
  enabled?: boolean;
}

/** Um id fixo evita empilhar avisos a cada ciclo do autosave. */
const TOAST_ID = "weekly-report-autosave";

/**
 * Avisos de autosave: confirma a gravação com o horário e, em caso de falha,
 * explica o motivo e oferece "Tentar agora". Complementa o indicador do
 * cabeçalho, que pode estar fora da área visível em telas longas.
 */
export function useAutoSaveToasts({
  status,
  lastSaved,
  errorMessage,
  onRetry,
  enabled = true,
}: Options) {
  const previousStatus = useRef<AutoSaveStatus | null>(null);
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;

  useEffect(() => {
    if (!enabled) return;
    const previous = previousStatus.current;
    previousStatus.current = status;
    // Não avisa nada no primeiro render (estado inicial ainda não é evento).
    if (previous === null || previous === status) return;

    if (status === "offline") {
      toast.warning("Sem conexão — alterações guardadas neste dispositivo", {
        id: TOAST_ID,
        description: "Vamos sincronizar sozinho assim que a internet voltar.",
        duration: 6000,
      });
      return;
    }

    if (status === "saved" && lastSaved) {
      const hora = format(lastSaved, "HH:mm", { locale: ptBR });
      toast.success(
        previous === "offline"
          ? `Alterações sincronizadas às ${hora}`
          : `Salvo às ${hora}`,
        { id: TOAST_ID, duration: 2500 },
      );
      return;
    }


    if (status === "retrying") {
      toast.warning("Falha ao salvar. Tentando de novo…", {
        id: TOAST_ID,
        description: errorMessage ?? undefined,
        duration: 4000,
      });
      return;
    }

    if (status === "error") {
      toast.error("Não foi possível salvar o relatório", {
        id: TOAST_ID,
        description:
          `${errorMessage ? `${errorMessage}. ` : ""}Suas alterações continuam na tela.`,
        duration: Infinity,
        action: retryRef.current
          ? { label: "Tentar agora", onClick: () => retryRef.current?.() }
          : undefined,
      });
    }
  }, [status, lastSaved, errorMessage, enabled]);
}

export default useAutoSaveToasts;
