import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ReportData,
  WeeklyReport,
  Activity as ActivityType,
} from "@/types/report";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectActivities } from "@/hooks/useProjectActivities";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useCan } from "@/hooks/useCan";
import { isDemoMode } from "@/config/flags";
import {
  getPortalViewState,
  patchPortalViewState,
} from "@/lib/portalViewState";
import { useWeeklyReports } from "@/hooks/useWeeklyReports";
import { generateWeeklyReports } from "@/components/WeeklyReportsHistory";
import type { MilestoneKey } from "@/components/ReportHeader";

// Demo data for projects without real data yet
const demoReportData: ReportData = {
  projectName: "Hub Brooklyn",
  unitName: "502",
  clientName: "Pedro Alves",
  startDate: "2025-07-01",
  endDate: "2025-09-14",
  reportDate: "2025-09-08",
  activities: [
    {
      id: "demo-1",
      description: "Preparação e Mobilização",
      plannedStart: "2025-07-01",
      plannedEnd: "2025-07-05",
      actualStart: "2025-07-01",
      actualEnd: "2025-07-04",
      weight: 5,
    },
    {
      id: "demo-2",
      description: "Proteções, demolições e infraestrutura",
      plannedStart: "2025-07-07",
      plannedEnd: "2025-07-18",
      actualStart: "2025-07-05",
      actualEnd: "2025-07-19",
      weight: 15,
    },
    {
      id: "demo-3",
      description: "Pisos, revestimentos, bancadas e box",
      plannedStart: "2025-07-21",
      plannedEnd: "2025-08-03",
      actualStart: "2025-07-21",
      actualEnd: "2025-08-03",
      weight: 20,
    },
    {
      id: "demo-4",
      description: "Pinturas e metais",
      plannedStart: "2025-08-04",
      plannedEnd: "2025-08-10",
      actualStart: "2025-08-06",
      actualEnd: "2025-08-12",
      weight: 10,
    },
    {
      id: "demo-5",
      description: "Instalações e elétrica",
      plannedStart: "2025-08-11",
      plannedEnd: "2025-08-17",
      actualStart: "2025-08-14",
      actualEnd: "2025-08-17",
      weight: 10,
    },
    {
      id: "demo-6",
      description: "Marcenaria",
      plannedStart: "2025-08-20",
      plannedEnd: "2025-09-05",
      actualStart: "2025-08-20",
      actualEnd: "2025-09-05",
      weight: 33,
    },
    {
      id: "demo-7",
      description: "Etapa atual: Instalação de mobiliário e eletros",
      plannedStart: "2025-09-08",
      plannedEnd: "2025-09-10",
      actualStart: "2025-09-08",
      actualEnd: "",
      weight: 3,
    },
    {
      id: "demo-8",
      description: "Limpeza fina",
      plannedStart: "2025-09-11",
      plannedEnd: "2025-09-11",
      actualStart: "",
      actualEnd: "",
      weight: 2,
    },
    {
      id: "demo-9",
      description: "Vistoria de qualidade",
      plannedStart: "2025-09-12",
      plannedEnd: "2025-09-12",
      actualStart: "",
      actualEnd: "",
      weight: 1,
    },
    {
      id: "demo-10",
      description: "Conclusão",
      plannedStart: "2025-09-14",
      plannedEnd: "2025-09-14",
      actualStart: "",
      actualEnd: "",
      weight: 1,
    },
  ],
};

const milestoneKeyToColumn: Record<MilestoneKey, string> = {
  dateBriefingArch: "date_briefing_arch",
  dateApproval3d: "date_approval_3d",
  dateApprovalExec: "date_approval_exec",
  dateApprovalObra: "date_approval_obra",
  dateMobilizationStart: "date_mobilization_start",
  contractSigningDate: "contract_signing_date",
};

function calculateEndDateFromActivities(
  activities: ActivityType[],
): string | null {
  if (activities.length === 0) return null;
  const dates = activities
    .map((a) => a.plannedEnd)
    .filter((d) => d)
    .map((d) => new Date(d + "T00:00:00").getTime());
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates)).toISOString().split("T")[0];
}

export function useProjectPortal() {
  const navigate = useNavigate();
  const {
    project,
    loading: projectLoading,
    error: projectError,
    setProject,
  } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const { isStaff, isCustomer, isAdmin } = useUserRole();
  const { can } = useCan();
  const {
    activities: dbActivities,
    loading: activitiesLoading,
    updateActivity,
  } = useProjectActivities(projectId);
  const {
    reportDataByWeek,
    saveReport: saveWeeklyReport,
    isSaving: isSavingReport,
    savingWeek,
  } = useWeeklyReports({ projectId });

  const canEditSchedule = can("schedule:edit");

  // --- View state persistence ---
  const viewStateKey = useMemo(
    () => `portal:view:${projectId ?? "sem-projeto"}`,
    [projectId],
  );

  const [activeTab, setActiveTab] = useState("cronograma");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedWeeklyReport, setSelectedWeeklyReport] =
    useState<WeeklyReport | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(() => {
    const idx = getPortalViewState(viewStateKey).weeklyReport?.index;
    return typeof idx === "number" ? idx : 0;
  });
  const [showFullChart, setShowFullChart] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );

  // Sync view state on key change
  const hasSyncedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (hasSyncedKeyRef.current === viewStateKey) return;
    hasSyncedKeyRef.current = viewStateKey;
    const saved = getPortalViewState(viewStateKey);
    if (saved.activeTab) setActiveTab(saved.activeTab);
    const idx = saved.weeklyReport?.index;
    if (typeof idx === "number") setSelectedWeekIndex(idx);
  }, [viewStateKey]);

  useEffect(() => {
    patchPortalViewState(viewStateKey, { activeTab });
  }, [viewStateKey, activeTab]);

  useEffect(() => {
    patchPortalViewState(viewStateKey, {
      weeklyReport: { open: !!selectedWeeklyReport, index: selectedWeekIndex },
    });
  }, [viewStateKey, selectedWeeklyReport, selectedWeekIndex]);

  // --- Data transforms ---
  const formattedActivities = useMemo(() => {
    return dbActivities.map((act) => ({
      id: act.id,
      description: act.description,
      plannedStart: act.planned_start,
      plannedEnd: act.planned_end,
      actualStart: act.actual_start || "",
      actualEnd: act.actual_end || "",
      weight: act.weight,
      predecessorIds: act.predecessor_ids || [],
      baselineStart: act.baseline_start,
      baselineEnd: act.baseline_end,
      etapa: act.etapa ?? null,
      detailed_description: act.detailed_description ?? null,
    }));
  }, [dbActivities]);

  const milestoneDates = useMemo(() => {
    if (!project) return undefined;
    // Access milestone date columns that exist on the projects table but aren't in the base TS type
    const p = project as unknown as Record<string, unknown>;
    return {
      dateBriefingArch: (p.date_briefing_arch as string) ?? null,
      dateApproval3d: (p.date_approval_3d as string) ?? null,
      dateApprovalExec: (p.date_approval_exec as string) ?? null,
      dateApprovalObra: (p.date_approval_obra as string) ?? null,
      dateOfficialStart: (p.date_official_start as string) ?? null,
      dateOfficialDelivery: (p.date_official_delivery as string) ?? null,
      dateMobilizationStart: (p.date_mobilization_start as string) ?? null,
      contractSigningDate: (p.contract_signing_date as string) ?? null,
    };
  }, [project]);

  const reportData: ReportData | null = useMemo(() => {
    if (project) {
      // Determine the earliest real start across activities (actual_start when present, else planned_start)
      // so the weekly timeline reflects the full schedule even when project.actual_start_date was
      // set later than the actual on-site start of the first activities.
      const earliestActivityStart = formattedActivities.reduce<string | null>(
        (min, a) => {
          const candidate = a.actualStart || a.plannedStart;
          if (!candidate) return min;
          if (!min || candidate < min) return candidate;
          return min;
        },
        null,
      );

      // Pick the earliest non-empty among: project actual start, project planned start, earliest activity start.
      const startCandidates = [
        project.actual_start_date,
        project.planned_start_date,
        earliestActivityStart,
      ].filter((d): d is string => !!d);
      const effectiveStartDate =
        startCandidates.length > 0
          ? startCandidates.reduce(
              (earliest, d) => (d < earliest ? d : earliest),
              startCandidates[0],
            )
          : "";
      const effectiveEndDate =
        project.actual_end_date || project.planned_end_date || "";

      // Ensure endDate is never before the latest activity to avoid clipping the chart
      const reconcileEndDate = (
        preferred: string | null | undefined,
        activitiesEnd: string | null,
      ): string => {
        const candidates = [
          preferred,
          activitiesEnd,
          project.planned_end_date,
        ].filter(Boolean) as string[];
        if (candidates.length === 0) return "";
        return candidates.reduce(
          (latest, d) => (d > latest ? d : latest),
          candidates[0],
        );
      };

      if (formattedActivities.length > 0) {
        const activitiesEndDate =
          calculateEndDateFromActivities(formattedActivities);
        return {
          projectName: project.name,
          unitName: project.unit_name || "",
          clientName: project.customer_name || "",
          startDate: effectiveStartDate,
          endDate: reconcileEndDate(
            project.actual_end_date || project.planned_end_date,
            activitiesEndDate,
          ),
          reportDate: new Date().toISOString().split("T")[0],
          activities: formattedActivities,
        };
      }
      if (isDemoMode) {
        const demoEndDate = calculateEndDateFromActivities(
          demoReportData.activities,
        );
        return {
          projectName: project.name,
          unitName: project.unit_name || "",
          clientName: project.customer_name || "",
          startDate: effectiveStartDate,
          endDate: reconcileEndDate(
            project.actual_end_date || project.planned_end_date,
            demoEndDate,
          ),
          reportDate: new Date().toISOString().split("T")[0],
          activities: demoReportData.activities,
        };
      }
      return {
        projectName: project.name,
        unitName: project.unit_name || "",
        clientName: project.customer_name || "",
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        reportDate: new Date().toISOString().split("T")[0],
        activities: [],
      };
    }
    if (isDemoMode) return demoReportData;
    return null;
  }, [project, formattedActivities]);

  const allWeeklyReports = useMemo(() => {
    if (!reportData || reportData.activities.length === 0) return [];
    return generateWeeklyReports(
      reportData.startDate ?? "",
      reportData.reportDate,
      reportData.activities,
      reportData.endDate ?? undefined,
    );
  }, [reportData]);

  const reportsChronological = useMemo(
    () => [...allWeeklyReports].reverse(),
    [allWeeklyReports],
  );

  // Telemetria de diagnóstico: registra qual effectiveStartDate foi usada e
  // quantas semanas foram geradas para cada obra. Útil para investigar casos
  // onde o número de relatórios não bate com a duração real do cronograma.
  useEffect(() => {
    if (!project || !reportData) return;

    const earliestActivityStart = formattedActivities.reduce<string | null>(
      (min, a) => {
        const candidate = a.actualStart || a.plannedStart;
        if (!candidate) return min;
        if (!min || candidate < min) return candidate;
        return min;
      },
      null,
    );

    // Determine the source that "won" as the earliest start
    const candidates: Array<{
      source: string;
      date: string | null | undefined;
    }> = [
      { source: "project.actual_start_date", date: project.actual_start_date },
      {
        source: "project.planned_start_date",
        date: project.planned_start_date,
      },
      { source: "earliestActivityStart", date: earliestActivityStart },
    ];
    const validCandidates = candidates.filter((c) => !!c.date) as Array<{
      source: string;
      date: string;
    }>;
    const winner =
      validCandidates.length > 0
        ? validCandidates.reduce(
            (earliest, c) => (c.date < earliest.date ? c : earliest),
            validCandidates[0],
          )
        : null;

    const diagnostic = {
      projectId: project.id,
      projectName: project.name,
      effectiveStartDate: reportData.startDate,
      effectiveEndDate: reportData.endDate,
      effectiveStartSource: winner?.source ?? "none",
      candidates: {
        actual_start_date: project.actual_start_date ?? null,
        planned_start_date: project.planned_start_date ?? null,
        earliestActivityStart,
      },
      activitiesCount: formattedActivities.length,
      weeksGenerated: allWeeklyReports.length,
      reportDate: reportData.reportDate,
    };

    // Console diagnostic — visível em dev e prod para debugging
    console.info(
      "[ReportsTelemetry] effectiveStartDate diagnostic",
      diagnostic,
    );
  }, [project, reportData, formattedActivities, allWeeklyReports.length]);

  // Restore weekly report state
  const hasRestoredWeeklyRef = useRef(false);
  useEffect(() => {
    if (hasRestoredWeeklyRef.current) return;
    if (reportsChronological.length === 0) return;
    const saved = getPortalViewState(viewStateKey);
    if (
      saved.weeklyReport?.open &&
      typeof saved.weeklyReport?.index === "number" &&
      reportsChronological[saved.weeklyReport.index]
    ) {
      setActiveTab("relatorios");
      setSelectedWeekIndex(saved.weeklyReport.index);
      setSelectedWeeklyReport(reportsChronological[saved.weeklyReport.index]);
    }
    hasRestoredWeeklyRef.current = true;
  }, [reportsChronological, viewStateKey]);

  // --- Handlers ---
  const handleMilestoneDateChange = useCallback(
    async (key: MilestoneKey, date: string | null) => {
      if (!projectId) return;
      const column = milestoneKeyToColumn[key];
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from("projects")
        .update({ [column]: date })
        .eq("id", projectId);
      if (error) {
        toast.error("Erro ao salvar data do marco");
        throw error;
      }
      if (project) setProject({ ...project, [column]: date } as typeof project);
      toast.success("Data do marco atualizada");
    },
    [projectId, project, setProject],
  );

  const handleActivityDateChange = useCallback(
    async (
      activityId: string,
      newPlannedStart: string,
      newPlannedEnd: string,
    ) => {
      if (!isStaff) return;
      if (newPlannedEnd < newPlannedStart) {
        toast.error("Data de término deve ser igual ou posterior ao início");
        return;
      }
      const success = await updateActivity(activityId, {
        planned_start: newPlannedStart,
        planned_end: newPlannedEnd,
      });
      if (!success) toast.error("Erro ao atualizar datas. Tente novamente.");
    },
    [isStaff, updateActivity],
  );

  const handleReportClick = useCallback(
    (report: WeeklyReport, index: number) => {
      setSelectedWeeklyReport(report);
      setSelectedWeekIndex(index);
      setActiveTab("relatorios");
      patchPortalViewState(viewStateKey, {
        activeTab: "relatorios",
        weeklyReport: { open: true, index },
      });
    },
    [viewStateKey],
  );

  const handleBackToList = useCallback(() => {
    setSelectedWeeklyReport(null);
    patchPortalViewState(viewStateKey, { weeklyReport: { open: false } });
  }, [viewStateKey]);

  const handlePreviousWeek = useCallback(() => {
    if (selectedWeekIndex > 0) {
      const newIndex = selectedWeekIndex - 1;
      setSelectedWeekIndex(newIndex);
      setSelectedWeeklyReport(reportsChronological[newIndex]);
      patchPortalViewState(viewStateKey, {
        weeklyReport: { open: true, index: newIndex },
      });
    }
  }, [selectedWeekIndex, reportsChronological, viewStateKey]);

  const handleNextWeek = useCallback(() => {
    if (selectedWeekIndex < reportsChronological.length - 1) {
      const newIndex = selectedWeekIndex + 1;
      setSelectedWeekIndex(newIndex);
      setSelectedWeeklyReport(reportsChronological[newIndex]);
      patchPortalViewState(viewStateKey, {
        weeklyReport: { open: true, index: newIndex },
      });
    }
  }, [selectedWeekIndex, reportsChronological, viewStateKey]);

  // Redirect to journey for "fase de projeto"
  useEffect(() => {
    if (!projectLoading && project?.is_project_phase && projectId) {
      navigate(`/obra/${projectId}`, { replace: true });
    }
  }, [projectLoading, project?.is_project_phase, projectId, navigate]);

  return {
    // State
    project,
    projectId,
    projectLoading,
    projectError,
    activitiesLoading,
    isStaff,
    isCustomer,
    isAdmin,
    canEditSchedule,
    paths,
    reportData,
    milestoneDates,
    activeTab,
    setActiveTab,
    isExporting,
    setIsExporting,
    selectedWeeklyReport,
    selectedWeekIndex,
    showFullChart,
    setShowFullChart,
    selectedActivityId,
    setSelectedActivityId,
    reportsChronological,
    reportDataByWeek,
    isSavingReport,
    savingWeek,
    updateActivity,
    // Handlers
    handleMilestoneDateChange,
    handleActivityDateChange,
    handleReportClick,
    handleBackToList,
    handlePreviousWeek,
    handleNextWeek,
    saveWeeklyReport,
  };
}
