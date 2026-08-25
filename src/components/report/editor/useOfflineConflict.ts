/**
 * Guarda de conflito para edições feitas offline.
 *
 * Antes de a fila offline subir para o servidor, conferimos se o relatório
 * mudou por lá enquanto o aparelho estava sem conexão. Se as mudanças forem
 * em seções diferentes, juntamos tudo sozinho. Se a mesma seção mudou dos
 * dois lados, o envio é bloqueado e a pessoa escolhe qual versão vale.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WeeklyReportData } from "@/types/weeklyReport";
import { getWeeklyReportSnapshot } from "@/infra/repositories/weeklyReports.repository";
import { queryKeys } from "@/lib/queryKeys";
import { reportLogger } from "@/lib/devLogger";
import { isOffline, readOfflineSnapshot } from "@/lib/offlineAutoSaveQueue";
import {
  resolveOfflineConflict,
  type OfflineConflictResolution,
} from "./offlineConflict";

export class OfflineConflictError extends Error {
  constructor() {
    super(
      "O relatório mudou no servidor enquanto você estava sem conexão. Escolha qual versão manter.",
    );
    this.name = "OfflineConflictError";
  }
}

export interface PendingOfflineConflict {
  resolution: OfflineConflictResolution;
  serverData: WeeklyReportData;
  detectedAt: Date;
}

interface UseOfflineConflictOptions {
  projectId?: string;
  weekNumber?: number;
  /** Chave da fila offline usada pelo autosave. */
  offlineKey?: string;
  enabled?: boolean;
  /** Aplica um estado resolvido no editor. */
  onApply: (data: WeeklyReportData) => void;
  /** Dispara um novo envio ao servidor. */
  requestSave: () => void;
}

export interface OfflineConflictGuard {
  pending: PendingOfflineConflict | null;
  /** true enquanto o autosave deve ficar suspenso. */
  blocksAutoSave: boolean;
  isChecking: boolean;
  /** Chamado pelo autosave logo antes de gravar. */
  beforeSave: (
    local: WeeklyReportData,
  ) => Promise<{ blocked: true } | { blocked: false; data: WeeklyReportData }>;
  /** Registra o estado que ficou salvo no servidor com sucesso. */
  markSynced: (data: WeeklyReportData) => void;
  /** Mantém as edições do aparelho (trazendo as seções só do servidor). */
  keepLocal: () => void;
  /** Descarta as edições offline conflitantes e adota o servidor. */
  useServer: () => void;
}

export function useOfflineConflict({
  projectId,
  weekNumber,
  offlineKey,
  enabled = true,
  onApply,
  requestSave,
}: UseOfflineConflictOptions): OfflineConflictGuard {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingOfflineConflict | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Estado que sabemos estar salvo no servidor (base da comparação).
  const baseRef = useRef<WeeklyReportData | null>(null);
  // Só verificamos quando houve mesmo um período offline.
  const needsCheckRef = useRef(false);

  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const requestSaveRef = useRef(requestSave);
  requestSaveRef.current = requestSave;

  // Fila pendente de uma sessão anterior (aba fechada sem internet) também
  // exige conferência antes de subir.
  useEffect(() => {
    if (!enabled || !offlineKey) return;
    if (readOfflineSnapshot(offlineKey)) needsCheckRef.current = true;
  }, [enabled, offlineKey]);

  useEffect(() => {
    if (!enabled) return;
    const handleOffline = () => {
      needsCheckRef.current = true;
    };
    if (isOffline()) needsCheckRef.current = true;
    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [enabled]);

  const markSynced = useCallback((data: WeeklyReportData) => {
    baseRef.current = data;
  }, []);

  const beforeSave = useCallback(
    async (local: WeeklyReportData) => {
      if (
        !enabled ||
        !needsCheckRef.current ||
        !projectId ||
        weekNumber === undefined
      ) {
        return { blocked: false as const, data: local };
      }

      setIsChecking(true);
      try {
        const result = await getWeeklyReportSnapshot(projectId, weekNumber);
        if (result.error) {
          // Sem resposta do servidor não dá para comparar; a trava otimista
          // da RPC ainda protege contra sobrescrita.
          reportLogger.warn("offline conflict check failed", {
            projectId,
            weekNumber,
          });
          return { blocked: false as const, data: local };
        }

        const server =
          (result.data?.data as unknown as WeeklyReportData | null) ?? null;
        const resolution = resolveOfflineConflict({
          base: baseRef.current,
          local,
          server,
        });

        if (resolution.kind === "conflict" && server) {
          setPending({
            resolution,
            serverData: server,
            detectedAt: new Date(),
          });
          return { blocked: true as const };
        }

        needsCheckRef.current = false;

        if (resolution.kind === "auto-server" && server) {
          onApplyRef.current(server);
          baseRef.current = server;
          toast.info(
            "Trouxemos a versão mais recente do servidor — você não tinha alterações pendentes.",
          );
          return { blocked: false as const, data: server };
        }

        if (resolution.kind === "auto-merged") {
          onApplyRef.current(resolution.merged);
          toast.success(
            `Juntamos suas alterações offline com o que mudou no servidor (${resolution.serverSections.join(", ")}).`,
            { duration: 8000 },
          );
          return { blocked: false as const, data: resolution.merged };
        }

        return { blocked: false as const, data: local };
      } finally {
        setIsChecking(false);
      }
    },
    [enabled, projectId, weekNumber],
  );

  const finishResolution = useCallback(() => {
    needsCheckRef.current = false;
    setPending(null);
    if (projectId) {
      // Recarrega a lista para o controle de concorrência usar o
      // `updated_at` mais novo na próxima gravação.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.weeklyReports.list(projectId),
      });
    }
  }, [projectId, queryClient]);

  const keepLocal = useCallback(() => {
    const current = pending;
    finishResolution();
    if (current) {
      onApplyRef.current(current.resolution.merged);
      baseRef.current = current.serverData;
    }
    // Deixa o cache atualizar antes de reenviar.
    setTimeout(() => requestSaveRef.current(), 400);
  }, [pending, finishResolution]);

  const useServer = useCallback(() => {
    const current = pending;
    finishResolution();
    if (current) {
      onApplyRef.current(current.serverData);
      baseRef.current = current.serverData;
    }
    toast.info("Carregamos a versão do servidor neste relatório.");
  }, [pending, finishResolution]);

  return {
    pending,
    blocksAutoSave: pending !== null,
    isChecking,
    beforeSave,
    markSynced,
    keepLocal,
    useServer,
  };
}
