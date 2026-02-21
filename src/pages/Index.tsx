import { useEffect, useState, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, Loader2, AlertCircle, Plus, GanttChartSquare, Calendar, DollarSign, FolderOpen, ClipboardSignature, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReportHeader, { type MilestoneKey } from "@/components/ReportHeader";
import SCurveChart from "@/components/SCurveChart";
import ScheduleTable from "@/components/ScheduleTable";
import ActivityDetailsPanel from "@/components/ActivityDetailsPanel";
import WeeklyReportsHistory, { generateWeeklyReports, ExtendedWeeklyReport } from "@/components/WeeklyReportsHistory";
import WeeklyReportHeader from "@/components/WeeklyReportHeader";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { EmptyState } from "@/components/EmptyState";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { toast } from "sonner";
import { ReportData, WeeklyReport, Activity as ActivityType } from "@/types/report";
import { createEmptyReportTemplate } from "@/data/emptyReportTemplate";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectActivities } from "@/hooks/useProjectActivities";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useCan } from "@/hooks/useCan";
import { isDemoMode } from "@/config/flags";
// usePageVisibility removido - causava desmontagem de UI e perda de estado
import { getPortalViewState, patchPortalViewState } from "@/lib/portalViewState";
import { useWeeklyReports } from "@/hooks/useWeeklyReports";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";
import { pdfLogger } from "@/lib/devLogger";
import { perf } from "@/lib/perf";
import { prefetchForTab } from "@/lib/prefetch";
import bwildLogo from "@/assets/bwild-logo-transparent.png";
import { UserMenu } from "@/components/layout/UserMenu";
import { format } from "date-fns";

// Lazy load heavy components to reduce initial bundle
const GanttChart = lazy(() => import("@/components/GanttChart"));
const WeeklyReportTemplate = lazy(() => import("@/components/report/WeeklyReportTemplate"));
const FinanceiroContent = lazy(() => import("@/components/tabs/FinanceiroContent"));
const DocumentosContent = lazy(() => import("@/components/tabs/DocumentosContent"));
const FormalizacoesContent = lazy(() => import("@/components/tabs/FormalizacoesContent"));
const PendenciasContent = lazy(() => import("@/components/tabs/PendenciasContent"));

// Demo data for projects without real data yet
const demoReportData: ReportData = {
  projectName: "Hub Brooklyn",
  unitName: "502",
  clientName: "Pedro Alves",
  startDate: "2025-07-01",
  endDate: "2025-09-14",
  reportDate: "2025-09-08",
  activities: [
    { description: "Preparação e Mobilização", plannedStart: "2025-07-01", plannedEnd: "2025-07-05", actualStart: "2025-07-01", actualEnd: "2025-07-04", weight: 5 },
    { description: "Proteções, demolições e infraestrutura", plannedStart: "2025-07-07", plannedEnd: "2025-07-18", actualStart: "2025-07-05", actualEnd: "2025-07-19", weight: 15 },
    { description: "Pisos, revestimentos, bancadas e box", plannedStart: "2025-07-21", plannedEnd: "2025-08-03", actualStart: "2025-07-21", actualEnd: "2025-08-03", weight: 20 },
    { description: "Pinturas e metais", plannedStart: "2025-08-04", plannedEnd: "2025-08-10", actualStart: "2025-08-06", actualEnd: "2025-08-12", weight: 10 },
    { description: "Instalações e elétrica", plannedStart: "2025-08-11", plannedEnd: "2025-08-17", actualStart: "2025-08-14", actualEnd: "2025-08-17", weight: 10 },
    { description: "Marcenaria", plannedStart: "2025-08-20", plannedEnd: "2025-09-05", actualStart: "2025-08-20", actualEnd: "2025-09-05", weight: 33 },
    { description: "Etapa atual: Instalação de mobiliário e eletros", plannedStart: "2025-09-08", plannedEnd: "2025-09-10", actualStart: "2025-09-08", actualEnd: "", weight: 3 },
    { description: "Limpeza fina", plannedStart: "2025-09-11", plannedEnd: "2025-09-11", actualStart: "", actualEnd: "", weight: 2 },
    { description: "Vistoria de qualidade", plannedStart: "2025-09-12", plannedEnd: "2025-09-12", actualStart: "", actualEnd: "", weight: 1 },
    { description: "Conclusão", plannedStart: "2025-09-14", plannedEnd: "2025-09-14", actualStart: "", actualEnd: "", weight: 1 },
  ],
};

const Index = () => {
  const navigate = useNavigate();
  const { project, loading: projectLoading, error: projectError, setProject } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const { isStaff, isCustomer, isAdmin } = useUserRole();
  const { can } = useCan();
  const { activities: dbActivities, loading: activitiesLoading, updateActivity } = useProjectActivities(projectId);
  const {
    reportDataByWeek,
    saveReport: saveWeeklyReport,
    isSaving: isSavingReport,
    savingWeek,
  } = useWeeklyReports({ projectId });
  
  const canEditSchedule = can('schedule:edit');

  // Milestone key -> DB column mapping
  const milestoneKeyToColumn: Record<MilestoneKey, string> = {
    dateBriefingArch: 'date_briefing_arch',
    dateApproval3d: 'date_approval_3d',
    dateApprovalExec: 'date_approval_exec',
    dateApprovalObra: 'date_approval_obra',
    dateMobilizationStart: 'date_mobilization_start',
  };

  const handleMilestoneDateChange = useCallback(async (key: MilestoneKey, date: string | null) => {
    if (!projectId) return;
    const column = milestoneKeyToColumn[key];
    const { supabase } = await import('@/integrations/supabase/client');
    const { error } = await supabase
      .from('projects')
      .update({ [column]: date } as any)
      .eq('id', projectId);
    if (error) {
      const { toast } = await import('sonner');
      toast.error('Erro ao salvar data do marco');
      throw error;
    }
    // Update local project state
    if (project) {
      setProject({ ...project, [column]: date } as any);
    }
    const { toast } = await import('sonner');
    toast.success('Data do marco atualizada');
  }, [projectId, project, setProject]);

  // Persistência da UI do portal (aba ativa e semana do relatório) para evitar “voltar pra Curva S”
  // quando o navegador recarrega/remonta a página ao alternar abas.
  const viewStateKey = useMemo(
    () => `portal:view:${projectId ?? "sem-projeto"}`,
    [projectId]
  );

  const [activeTab, setActiveTab] = useState("cronograma");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedWeeklyReport, setSelectedWeeklyReport] = useState<WeeklyReport | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(() => {
    const idx = getPortalViewState(viewStateKey).weeklyReport?.index;
    return typeof idx === "number" ? idx : 0;
  });
  // Mostrar tudo por padrão para não “cortar” etapas iniciais (ex.: Demolição e preparação)
  const [showFullChart, setShowFullChart] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Em alguns cenários (ex.: reload/restore), o projectId pode estar indisponível
  // no primeiro render e o viewStateKey muda depois. Quando isso acontecer,
  // re-sincroniza estado da UI a partir do storage do novo key.
  const hasSyncedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (hasSyncedKeyRef.current === viewStateKey) return;
    hasSyncedKeyRef.current = viewStateKey;

    const saved = getPortalViewState(viewStateKey);
    if (saved.activeTab) setActiveTab(saved.activeTab);

    const idx = saved.weeklyReport?.index;
    if (typeof idx === "number") setSelectedWeekIndex(idx);
  }, [viewStateKey]);

  // Persiste a aba ativa
  useEffect(() => {
    patchPortalViewState(viewStateKey, { activeTab });
  }, [viewStateKey, activeTab]);

  // Persiste o estado do relatório semanal aberto (além dos handlers), para evitar
  // perda de contexto quando o navegador recarrega/descarta a aba.
  useEffect(() => {
    patchPortalViewState(viewStateKey, {
      weeklyReport: {
        open: !!selectedWeeklyReport,
        index: selectedWeekIndex,
      },
    });
  }, [viewStateKey, selectedWeeklyReport, selectedWeekIndex]);

  // Convert database activities to report format
  const formattedActivities = useMemo(() => {
    return dbActivities.map(act => ({
      id: act.id,
      description: act.description,
      plannedStart: act.planned_start,
      plannedEnd: act.planned_end,
      actualStart: act.actual_start || '',
      actualEnd: act.actual_end || '',
      weight: act.weight,
      predecessorIds: act.predecessor_ids || [],
      baselineStart: act.baseline_start,
      baselineEnd: act.baseline_end,
    }));
  }, [dbActivities]);

  // Calculate effective end date from activities (max of planned_end)
  const calculateEndDateFromActivities = (activities: ActivityType[]): string | null => {
    if (activities.length === 0) return null;
    const dates = activities
      .map(a => a.plannedEnd)
      .filter(d => d)
      .map(d => new Date(d + 'T00:00:00').getTime());
    if (dates.length === 0) return null;
    const maxDate = new Date(Math.max(...dates));
    return maxDate.toISOString().split('T')[0];
  };

  // Milestone dates from project (cast to any since new columns may not be in generated types yet)
  const milestoneDates = useMemo(() => {
    if (!project) return undefined;
    const p = project as any;
    return {
      dateBriefingArch: p.date_briefing_arch ?? null,
      dateApproval3d: p.date_approval_3d ?? null,
      dateApprovalExec: p.date_approval_exec ?? null,
      dateApprovalObra: p.date_approval_obra ?? null,
      dateOfficialStart: p.date_official_start ?? null,
      dateOfficialDelivery: p.date_official_delivery ?? null,
      dateMobilizationStart: p.date_mobilization_start ?? null,
    };
  }, [project]);

  // Use real project data if available, demo data only in demo mode
  const reportData: ReportData | null = useMemo(() => {
    if (project) {
      // Use database activities if available
      if (formattedActivities.length > 0) {
        // Calculate end date from activities (max planned_end), fallback to project date
        const activitiesEndDate = calculateEndDateFromActivities(formattedActivities);
        return {
          projectName: project.name,
          unitName: project.unit_name || '',
          clientName: project.customer_name || '',
          startDate: project.planned_start_date,
          endDate: activitiesEndDate || project.planned_end_date,
          reportDate: new Date().toISOString().split('T')[0],
          activities: formattedActivities,
        };
      }

      // Demo mode: show demo activities
      if (isDemoMode) {
        const demoEndDate = calculateEndDateFromActivities(demoReportData.activities);
        return {
          projectName: project.name,
          unitName: project.unit_name || '',
          clientName: project.customer_name || '',
          startDate: project.planned_start_date,
          endDate: demoEndDate || project.planned_end_date,
          reportDate: new Date().toISOString().split('T')[0],
          activities: demoReportData.activities,
        };
      }
      
      // Production with no activities: return empty
      return {
        projectName: project.name,
        unitName: project.unit_name || '',
        clientName: project.customer_name || '',
        startDate: project.planned_start_date,
        endDate: project.planned_end_date,
        reportDate: new Date().toISOString().split('T')[0],
        activities: [],
      };
    }
    
    // No project at all
    if (isDemoMode) {
      return demoReportData;
    }
    
    return null;
  }, [project, formattedActivities]);

  const allWeeklyReports = useMemo(() => {
    if (!reportData || reportData.activities.length === 0) return [];
    return generateWeeklyReports(reportData.startDate, reportData.reportDate, reportData.activities);
  }, [reportData]);

  const reportsChronological = useMemo(() => {
    return [...allWeeklyReports].reverse();
  }, [allWeeklyReports]);

  // Restaura a semana aberta após (re)carregar dados
  const hasRestoredWeeklyRef = useRef(false);
  useEffect(() => {
    if (hasRestoredWeeklyRef.current) return;
    if (reportsChronological.length === 0) return;

    const saved = getPortalViewState(viewStateKey);
    const open = saved.weeklyReport?.open;
    const idx = saved.weeklyReport?.index;

    // Se havia um relatório semanal aberto, força a aba “Relatórios” e restaura.
    if (open && typeof idx === "number" && reportsChronological[idx]) {
      setActiveTab("evolucao");
      setSelectedWeekIndex(idx);
      setSelectedWeeklyReport(reportsChronological[idx]);
    }

    hasRestoredWeeklyRef.current = true;
  }, [reportsChronological, viewStateKey]);

  // Handler for Gantt drag-and-drop date changes
  const handleActivityDateChange = useCallback(async (activityId: string, newPlannedStart: string, newPlannedEnd: string) => {
    if (!isStaff) return;
    
    // Validate dates before saving
    if (newPlannedEnd < newPlannedStart) {
      toast.error('Data de término deve ser igual ou posterior ao início');
      return;
    }
    
    const success = await updateActivity(activityId, { 
      planned_start: newPlannedStart, 
      planned_end: newPlannedEnd 
    });
    
    if (!success) {
      toast.error('Erro ao atualizar datas. Tente novamente.');
    }
  }, [isStaff, updateActivity]);

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current) return;

    const operationId = 'pdf-export';
    pdfLogger.start(operationId, 'Starting PDF export');
    
    setIsExporting(true);
    // Show loading toast that persists
    const loadingToast = toast.loading("Gerando PDF... Isso pode levar alguns segundos.");

    try {
      // Carrega somente quando necessário (reduz bundle/memória inicial)
      const { default: html2pdf } = await import("html2pdf.js");

      const element = reportRef.current;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Relatorio_Obra_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).save();
      toast.dismiss(loadingToast);
      toast.success("PDF exportado com sucesso!");
      pdfLogger.end(operationId, { level: 'success' });
    } catch (error) {
      toast.dismiss(loadingToast);
      pdfLogger.error(operationId, error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleReportClick = useCallback((report: WeeklyReport, index: number) => {
    setSelectedWeeklyReport(report);
    setSelectedWeekIndex(index);
    patchPortalViewState(viewStateKey, {
      activeTab: "evolucao",
      weeklyReport: { open: true, index },
    });
  }, [viewStateKey]);

  const handleBackToList = useCallback(() => {
    setSelectedWeeklyReport(null);
    patchPortalViewState(viewStateKey, { weeklyReport: { open: false } });
  }, [viewStateKey]);

  const handlePreviousWeek = useCallback(() => {
    if (selectedWeekIndex > 0) {
      const newIndex = selectedWeekIndex - 1;
      setSelectedWeekIndex(newIndex);
      setSelectedWeeklyReport(reportsChronological[newIndex]);
      patchPortalViewState(viewStateKey, { weeklyReport: { open: true, index: newIndex } });
    }
  }, [selectedWeekIndex, reportsChronological, viewStateKey]);

  const handleNextWeek = useCallback(() => {
    if (selectedWeekIndex < reportsChronological.length - 1) {
      const newIndex = selectedWeekIndex + 1;
      setSelectedWeekIndex(newIndex);
      setSelectedWeeklyReport(reportsChronological[newIndex]);
      patchPortalViewState(viewStateKey, { weeklyReport: { open: true, index: newIndex } });
    }
  }, [selectedWeekIndex, reportsChronological, viewStateKey]);

  // Redirect ALL users to journey page when project is in "fase de projeto"
  useEffect(() => {
    if (!projectLoading && project?.is_project_phase && projectId) {
      navigate(`/obra/${projectId}/jornada`, { replace: true });
    }
  }, [projectLoading, project?.is_project_phase, projectId, navigate]);

  // Loading state or redirect in progress
  if (projectLoading || activitiesLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] pb-safe">
        <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border md:hidden px-3 py-2.5">
          <div className="flex items-center justify-between">
            <img src={bwildLogo} alt="Bwild" className="h-8 w-auto" />
            <h1 className="font-bold text-xl text-foreground">Portal do Cliente</h1>
            <UserMenu />
          </div>
        </div>
        <div className="px-4 md:p-4 lg:p-6 xl:p-8">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {/* Header skeleton */}
            <ContentSkeleton variant="cards" rows={3} />
            {/* Chart skeleton */}
            <div className="bg-card rounded-xl shadow-card overflow-hidden p-4 space-y-4">
              <ContentSkeleton variant="chart" />
              <ContentSkeleton variant="table" rows={6} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Note: Customers in project phase can access this page normally.
  // The journey page is linked via the header.

  if (projectError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{projectError}</p>
          <button 
            onClick={() => {
              // BUG FIX: Previne loop se histórico estiver vazio
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(isStaff ? '/gestao' : '/minhas-obras', { replace: true });
              }
            }} 
            className="text-primary underline"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // No data available state (production mode without demo data)
  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Dados ainda não disponíveis</h2>
          <p className="text-muted-foreground mb-4">
            Os dados desta obra ainda não foram carregados. Entre em contato com seu engenheiro responsável.
          </p>
          <button 
            onClick={() => {
              // BUG FIX: Previne loop se histórico estiver vazio
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(isStaff ? '/gestao' : '/minhas-obras', { replace: true });
              }
            }} 
            className="text-primary underline"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // Empty activities state (production mode with project but no activities)
  // Show project header with quick links but without schedule/charts
  if (reportData.activities.length === 0) {
    return (
      <div className="min-h-screen min-h-[100dvh] pb-safe">
        {/* Fixed Mobile Header */}
        <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border md:hidden px-3 py-2.5">
          <div className="flex items-center justify-between">
            <img src={bwildLogo} alt="Bwild" className="h-8 w-auto" />
            <h1 className="font-bold text-xl text-foreground">Portal do Cliente</h1>
            <UserMenu />
          </div>
        </div>

        <div className="px-4 md:p-4 lg:p-6 xl:p-8">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {/* Full project header with quick links */}
            <ReportHeader
              projectName={reportData.projectName}
              unitName={reportData.unitName}
              clientName={reportData.clientName}
              startDate={reportData.startDate}
              endDate={reportData.endDate}
              reportDate={reportData.reportDate}
              activities={reportData.activities}
              isProjectPhase={project?.is_project_phase}
              milestoneDates={milestoneDates}
              canEditMilestones={isAdmin}
              onMilestoneDateChange={isAdmin ? handleMilestoneDateChange : undefined}
            />
            <ProjectSubNav className="mt-3 -mx-3 md:-mx-4 lg:-mx-6 xl:-mx-8" />

            {/* Onboarding for new users */}
            <OnboardingChecklist projectId={projectId} />

            {/* Staff: Show button to create schedule */}
            {canEditSchedule && (
              <EmptyState
                variant="schedule"
                title="Cronograma não cadastrado"
                description="Cadastre as atividades do cronograma para acompanhar o progresso da obra."
                action={{
                  label: "Cadastrar Cronograma",
                  onClick: () => navigate(paths.cronograma),
                  icon: Calendar,
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // REMOVIDO: O guard que desmontava a UI quando !isPageVisible causava perda de estado
  // do formulário e re-renders que triggavam redirects indevidos ao voltar para a aba.
  // A otimização de memória agora é feita via CSS (visibility) em vez de desmontagem completa.

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe">
      {/* Fixed Mobile Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border md:hidden px-3 py-2.5">
        <div className="flex items-center justify-between opacity-0 animate-fade-in" style={{ animationDelay: "0ms" }}>
          <img src={bwildLogo} alt="Bwild" className="h-8 w-auto" />
          <h1 className="font-bold text-xl text-foreground">Portal do Cliente</h1>
          <UserMenu />
        </div>
      </div>

      <div className="px-4 md:p-4 lg:p-6 xl:p-8">
        <div className="max-w-[1600px] mx-auto">
          <div ref={reportRef}>
            <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <ReportHeader
                projectName={reportData.projectName}
                unitName={reportData.unitName}
                clientName={reportData.clientName}
                startDate={reportData.startDate}
                endDate={reportData.endDate}
                reportDate={reportData.reportDate}
                activities={reportData.activities}
                isProjectPhase={project?.is_project_phase}
                milestoneDates={milestoneDates}
                canEditMilestones={isAdmin}
                onMilestoneDateChange={isAdmin ? handleMilestoneDateChange : undefined}
              />
              <ProjectSubNav className="mt-3 -mx-3 md:mx-0 rounded-none md:rounded-xl" />
            </div>

            <div className="bg-card rounded-xl shadow-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="portal-tabs-bar">
                  <div className="px-3 md:px-5">
                    <TabsList className="bg-transparent h-auto p-0 gap-0 w-full md:w-auto overflow-x-auto scrollbar-hide">
                      <TabsTrigger value="cronograma" className="portal-tab-trigger">
                        <GanttChartSquare className="w-3.5 h-3.5 mr-1.5" />
                        Cronograma
                      </TabsTrigger>
                      <TabsTrigger value="evolucao" className="portal-tab-trigger"
                        onMouseEnter={() => prefetchForTab('relatorio', projectId)}
                        onFocus={() => prefetchForTab('relatorio', projectId)}
                      >
                        <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                        Evolução de Obra
                      </TabsTrigger>
                      <TabsTrigger value="financeiro" className="portal-tab-trigger">
                        <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                        Financeiro
                      </TabsTrigger>
                      <TabsTrigger value="documentos" className="portal-tab-trigger">
                        <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                        Documentos
                      </TabsTrigger>
                      <TabsTrigger value="formalizacoes" className="portal-tab-trigger">
                        <ClipboardSignature className="w-3.5 h-3.5 mr-1.5" />
                        Formalizações
                      </TabsTrigger>
                      <TabsTrigger value="pendencias" className="portal-tab-trigger">
                        <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                        Pendências
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <div className="p-4 md:p-4 lg:p-6">
                  <div className="flex gap-4">
                    {/* Main content area */}
                    <div className={selectedActivityId ? "flex-1 min-w-0" : "w-full"}>
                      <TabsContent value="cronograma" className="mt-0 focus-visible:outline-none">
                        <ScheduleTable 
                          activities={reportData.activities} 
                          reportDate={reportData.reportDate}
                          selectedActivityId={selectedActivityId}
                          onActivitySelect={setSelectedActivityId}
                          canEditDates={canEditSchedule}
                          onUpdateActivityDates={canEditSchedule ? updateActivity : undefined}
                        />
                      </TabsContent>

                      <TabsContent value="evolucao" className="mt-0 focus-visible:outline-none">
                        {selectedWeeklyReport ? (
                          <>
                            <WeeklyReportHeader
                              weeklyReport={selectedWeeklyReport}
                              activities={reportData.activities}
                              onPreviousWeek={handlePreviousWeek}
                              onNextWeek={handleNextWeek}
                              onBackToList={handleBackToList}
                              onExportPDF={handleExportPDF}
                              isExporting={isExporting}
                              hasPrevious={selectedWeekIndex > 0}
                              hasNext={selectedWeekIndex < reportsChronological.length - 1}
                            />
                            {(() => {
                              const extendedReport = selectedWeeklyReport as ExtendedWeeklyReport;
                              const weekNum = extendedReport.weekNumber;
                              const weekStart = format(extendedReport.startDate, "yyyy-MM-dd");
                              const weekEnd = format(extendedReport.endDate, "yyyy-MM-dd");
                              const storedData = reportDataByWeek.get(weekNum);
                              const templateData = storedData ?? createEmptyReportTemplate(
                                projectId || "",
                                reportData.projectName,
                                reportData.unitName,
                                reportData.clientName,
                                weekNum,
                                weekStart,
                                weekEnd
                              );
                              return (
                                <Suspense fallback={<ContentSkeleton variant="report" />}>
                                  <WeeklyReportTemplate
                                    data={templateData}
                                    isStaff={isStaff}
                                    isSaving={isSavingReport && savingWeek === weekNum}
                                    onSaveReport={(updated) => {
                                      saveWeeklyReport(weekNum, weekStart, weekEnd, updated);
                                    }}
                                  />
                                </Suspense>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            <SCurveChart 
                              activities={reportData.activities} 
                              reportDate={reportData.reportDate}
                              showFullChart={showFullChart}
                              onShowFullChartChange={setShowFullChart}
                            />
                            <div className="mt-6">
                              <WeeklyReportsHistory
                                projectStartDate={reportData.startDate}
                                reportDate={reportData.reportDate}
                                activities={reportData.activities}
                                onReportClick={handleReportClick}
                                isStaff={isStaff}
                              />
                            </div>
                          </>
                        )}
                      </TabsContent>

                      <TabsContent value="financeiro" className="mt-0 focus-visible:outline-none">
                        <Suspense fallback={<ContentSkeleton variant="cards" rows={3} />}>
                          <FinanceiroContent />
                        </Suspense>
                      </TabsContent>

                      <TabsContent value="documentos" className="mt-0 focus-visible:outline-none">
                        <Suspense fallback={<ContentSkeleton variant="cards" rows={6} />}>
                          <DocumentosContent />
                        </Suspense>
                      </TabsContent>

                      <TabsContent value="formalizacoes" className="mt-0 focus-visible:outline-none">
                        <Suspense fallback={<ContentSkeleton variant="cards" rows={4} />}>
                          <FormalizacoesContent />
                        </Suspense>
                      </TabsContent>

                      <TabsContent value="pendencias" className="mt-0 focus-visible:outline-none">
                        <Suspense fallback={<ContentSkeleton variant="list" rows={5} />}>
                          <PendenciasContent />
                        </Suspense>
                      </TabsContent>
                    </div>

                    {/* Activity Details Panel - visible on desktop when activity selected */}
                    {selectedActivityId && activeTab === 'cronograma' && (
                      <div className="hidden lg:block w-80 shrink-0">
                        <ActivityDetailsPanel
                          activity={reportData.activities.find(a => a.id === selectedActivityId) || null}
                          activities={reportData.activities}
                          onClose={() => setSelectedActivityId(null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
