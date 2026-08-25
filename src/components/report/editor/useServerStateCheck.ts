/**
 * Verificação de divergência no carregamento do editor.
 *
 * Ao montar, buscamos a versão atual do relatório direto no servidor
 * (sem cache) e comparamos com o estado que o editor recebeu. Enquanto a
 * verificação roda — e enquanto uma divergência não é resolvida pela
 * pessoa — o autosave fica bloqueado, para nunca sobrescrever o servidor
 * com um estado local defasado.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { WeeklyReportData } from "@/types/weeklyReport";
import { getWeeklyReportSnapshot } from "@/infra/repositories/weeklyReports.repository";
import { diffWeeklyReportData } from "./reportDiff";
import { reportLogger } from "@/lib/devLogger";

export type ServerCheckStatus = "checking" | "ok" | "diverged" | "resolved";

interface UseServerStateCheckOptions {
  projectId: string | undefined;
  weekNumber: number | undefined;
  localData: WeeklyReportData;
  enabled?: boolean;
}

export interface ServerStateCheck {
  status: ServerCheckStatus;
  divergentSections: string[];
  serverData: WeeklyReportData | null;
  /** true enquanto o autosave deve ficar suspenso. */
  blocksAutoSave: boolean;
  /** Mantém o estado local e libera o autosave. */
  keepLocal: () => void;
  /** Marca a divergência como resolvida (após aplicar a versão do servidor). */
  acceptServer: () => void;
}

export function useServerStateCheck({
  projectId,
  weekNumber,
  localData,
  enabled = true,
}: UseServerStateCheckOptions): ServerStateCheck {
  const [status, setStatus] = useState<ServerCheckStatus>(
    enabled ? "checking" : "ok",
  );
  const [divergentSections, setDivergentSections] = useState<string[]>([]);
  const [serverData, setServerData] = useState<WeeklyReportData | null>(null);
  // Snapshot do estado local no momento do carregamento — comparar com o
  // estado "vivo" faria a checagem acusar as edições da própria pessoa.
  const loadedLocalRef = useRef(localData);
  const checkedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !projectId || weekNumber === undefined) return;
    const key = `${projectId}:${weekNumber}`;
    if (checkedKeyRef.current === key) return;
    checkedKeyRef.current = key;
    loadedLocalRef.current = localData;

    let cancelled = false;
    setStatus("checking");

    (async () => {
      const result = await getWeeklyReportSnapshot(projectId, weekNumber);
      if (cancelled) return;

      if (result.error) {
        // Sem resposta do servidor não dá para afirmar divergência; segue
        // o fluxo normal (o salvamento ainda tem trava otimista no banco).
        reportLogger.warn("weekly-report server check failed", {
          projectId,
          weekNumber,
        });
        setStatus("ok");
        return;
      }

      const remote =
        (result.data?.data as unknown as WeeklyReportData | null) ?? null;
      setServerData(remote);

      if (!remote) {
        setStatus("ok");
        return;
      }

      const { sections, hasDivergence } = diffWeeklyReportData(
        loadedLocalRef.current,
        remote,
      );
      if (hasDivergence) {
        setDivergentSections(sections);
        setStatus("diverged");
      } else {
        setStatus("ok");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, weekNumber, localData]);

  const keepLocal = useCallback(() => setStatus("resolved"), []);
  const acceptServer = useCallback(() => setStatus("resolved"), []);

  return {
    status,
    divergentSections,
    serverData,
    blocksAutoSave: status === "checking" || status === "diverged",
    keepLocal,
    acceptServer,
  };
}
