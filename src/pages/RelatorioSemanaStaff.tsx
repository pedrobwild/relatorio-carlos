/**
 * Relatório da semana, direto ao ponto (equipe, celular):
 * /obra/:projectId/relatorio-semana abre o editor da semana corrente, já em
 * passos, sem passar pela lista de semanas. É o destino de "Relatório da
 * semana" e "Tirar foto" no hub da obra e na gaveta Registrar.
 *
 * As semanas, os dados e o salvamento vêm do mesmo `useProjectPortal` da
 * página da obra, para a numeração das semanas ser exatamente a mesma.
 * No desktop a rota só encaminha para a aba de relatórios de sempre.
 */
import { useCallback, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { FileText } from "lucide-react";
import WeeklyReportEditor from "@/components/report/WeeklyReportEditor";
import { EmptyState } from "@/components/ui-premium";
import { Skeleton } from "@/components/ui/skeleton";
import { createEmptyReportTemplate } from "@/data/emptyReportTemplate";
import { useCan } from "@/hooks/useCan";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProjectPortal } from "@/hooks/useProjectPortal";
import { toLocalISODate } from "@/lib/localDate";
import { equipeMobileLabels } from "@/content/equipeMobileLabels";
import type { WeeklyReportData } from "@/types/weeklyReport";

const L = equipeMobileLabels.relatorio;

export default function RelatorioSemanaStaff() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { can } = useCan();
  const {
    projectId,
    project,
    projectLoading,
    activitiesLoading,
    reportData,
    reportsChronological,
    reportDataByWeek,
    weeklyReportsLoading,
    isSavingReport,
    savingWeek,
    saveWeeklyReport,
  } = useProjectPortal();

  // Semana corrente: a que contém hoje; se a obra já passou do fim (ou ainda
  // não chegou na primeira semana), a mais recente que já começou.
  const semana = useMemo(() => {
    if (reportsChronological.length === 0) return null;
    const hoje = toLocalISODate(new Date());
    const iso = (d: Date) => format(d, "yyyy-MM-dd");
    return (
      reportsChronological.find((r) => iso(r.startDate) <= hoje && hoje <= iso(r.endDate)) ??
      [...reportsChronological].reverse().find((r) => iso(r.startDate) <= hoje) ??
      reportsChronological[reportsChronological.length - 1]
    );
  }, [reportsChronological]);

  const weekNum = semana?.weekNumber;
  const weekStart = semana ? format(semana.startDate, "yyyy-MM-dd") : "";
  const weekEnd = semana ? format(semana.endDate, "yyyy-MM-dd") : "";
  const hub = projectId ? `/obra/${projectId}` : "/gestao/painel-obras";
  const lista = projectId ? `/obra/${projectId}/relatorio?tab=relatorios` : hub;

  const save = useCallback(
    async (updated: WeeklyReportData) => {
      if (weekNum == null) return undefined;
      const result = await saveWeeklyReport(weekNum, weekStart, weekEnd, updated);
      return result ?? undefined;
    },
    [saveWeeklyReport, weekNum, weekStart, weekEnd],
  );

  const saveAndClose = useCallback(
    async (updated: WeeklyReportData) => {
      const result = await save(updated);
      navigate(lista);
      return result;
    },
    [save, navigate, lista],
  );

  // Desktop: a edição continua onde sempre esteve.
  if (!isMobile && projectId) return <Navigate to={lista} replace />;

  if (!can("reports:edit_weekly")) {
    return <EmptyState icon={FileText} title={L.semPermissao.title} description={L.semPermissao.description} />;
  }

  // Nunca montar o editor com modelo vazio enquanto os relatórios carregam:
  // um autosave por cima apagaria o conteúdo real da semana.
  if (projectLoading || activitiesLoading || weeklyReportsLoading || !project || !reportData) {
    return (
      <div className="space-y-3 px-4 py-4" role="status" aria-busy="true" aria-label={L.carregando}>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!semana || weekNum == null) {
    return (
      <EmptyState
        icon={FileText}
        title={L.semSemana.title}
        description={L.semSemana.description}
        action={{ label: L.semSemana.action, onClick: () => navigate(hub) }}
      />
    );
  }

  const stored =
    reportDataByWeek.get(weekNum) ??
    createEmptyReportTemplate(
      projectId || "",
      reportData.projectName,
      reportData.unitName,
      reportData.clientName,
      weekNum,
      weekStart,
      weekEnd,
    );
  // Linhas antigas podem vir sem algumas listas (mesma normalização do
  // `WeeklyReportTemplate`).
  const data: WeeklyReportData = {
    ...stored,
    executiveSummary: stored.executiveSummary ?? "",
    lookaheadTasks: stored.lookaheadTasks ?? [],
    risksAndIssues: stored.risksAndIssues ?? [],
    clientDecisions: stored.clientDecisions ?? [],
    incidents: stored.incidents ?? [],
    gallery: stored.gallery ?? [],
    deliverablesCompleted: stored.deliverablesCompleted ?? [],
    roomsProgress: stored.roomsProgress ?? [],
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <WeeklyReportEditor
        key={`relatorio-semana-${projectId ?? "none"}-${weekNum}`}
        data={data}
        projectId={projectId}
        onAutoSave={save}
        onSaveAndClose={saveAndClose}
        onCancel={() => navigate(hub)}
        isSaving={isSavingReport && savingWeek === weekNum}
      />
    </div>
  );
}
