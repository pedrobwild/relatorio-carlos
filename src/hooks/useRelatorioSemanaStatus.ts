/**
 * Texto da situação do relatório da semana corrente de uma obra, a partir da
 * mesma leitura de relatórios que a tela do relatório usa (cache compartilhado).
 */
import { useWeeklyReports } from "@/hooks/useWeeklyReports";
import { todayISO } from "@/lib/hojeDia";
import { relatorioSemanaStatus } from "@/lib/relatorioSemanaStatus";
import { equipeMobileLabels } from "@/content/equipeMobileLabels";

const L = equipeMobileLabels.relatorioStatus;

export function useRelatorioSemanaStatus(
  projectId: string | undefined,
  obra: { inicio?: string | null; fim?: string | null },
): { text: string; kind: "neutro" | "sem_relatorio" | "rascunho" } {
  const { reportDataByWeek, isLoading, error } = useWeeklyReports({ projectId });
  const status = relatorioSemanaStatus({
    reports: reportDataByWeek.values(),
    loaded: !!projectId && !isLoading && !error,
    hoje: todayISO(),
    obra,
  });
  const text =
    status.kind === "rascunho" ? L.rascunho(status.fotos) : status.kind === "sem_relatorio" ? L.semRelatorio : L.neutro;
  return { text, kind: status.kind };
}
