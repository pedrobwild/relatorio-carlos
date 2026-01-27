import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, Loader2, AlertCircle, Activity, Plus, GanttChartSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import ReportHeader from "@/components/ReportHeader";
import SCurveChart from "@/components/SCurveChart";
import ScheduleTable from "@/components/ScheduleTable";
import GanttChart from "@/components/GanttChart";
import ActivityDetailsPanel from "@/components/ActivityDetailsPanel";
import WeeklyReportTemplate from "@/components/report/WeeklyReportTemplate";
import WeeklyReportsHistory, { generateWeeklyReports, ExtendedWeeklyReport } from "@/components/WeeklyReportsHistory";
import WeeklyReportHeader from "@/components/WeeklyReportHeader";
import { toast } from "sonner";
import { ReportData, WeeklyReport, Activity as ActivityType } from "@/types/report";
import { createEmptyReportTemplate } from "@/data/emptyReportTemplate";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectActivities } from "@/hooks/useProjectActivities";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { isDemoMode } from "@/config/flags";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { getPortalViewState, patchPortalViewState } from "@/lib/portalViewState";
import bwildLogo from "@/assets/bwild-logo.png";
import { format } from "date-fns";

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
  const { project, loading: projectLoading, error: projectError } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const { isStaff } = useUserRole();
  const { activities: dbActivities, loading: activitiesLoading, updateActivity } = useProjectActivities(projectId);

  // Persistência da UI do portal (aba ativa e semana do relatório) para evitar “voltar pra Curva S”
  // quando o navegador recarrega/remonta a página ao alternar abas.
  const viewStateKey = useMemo(
    () => `portal:view:${projectId ?? "sem-projeto"}`,
    [projectId]
  );

  const [activeTab, setActiveTab] = useState(() => {
    return getPortalViewState(viewStateKey).activeTab ?? "curvaS";
  });
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
  const isPageVisible = usePageVisibility();

  // Persiste a aba ativa
  useEffect(() => {
    patchPortalViewState(viewStateKey, { activeTab });
  }, [viewStateKey, activeTab]);

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

  // Use real project data if available, demo data only in demo mode
  const reportData: ReportData | null = useMemo(() => {
    if (project) {
      // Use database activities if available
      if (formattedActivities.length > 0) {
        return {
          projectName: project.name,
          unitName: project.unit_name || '',
          clientName: project.customer_name || '',
          startDate: project.planned_start_date,
          endDate: project.planned_end_date,
          reportDate: new Date().toISOString().split('T')[0],
          activities: formattedActivities,
        };
      }

      // Demo mode: show demo activities
      if (isDemoMode) {
        return {
          projectName: project.name,
          unitName: project.unit_name || '',
          clientName: project.customer_name || '',
          startDate: project.planned_start_date,
          endDate: project.planned_end_date,
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

    if (activeTab === "relatorio" && open && typeof idx === "number" && reportsChronological[idx]) {
      setSelectedWeekIndex(idx);
      setSelectedWeeklyReport(reportsChronological[idx]);
    }

    hasRestoredWeeklyRef.current = true;
  }, [activeTab, reportsChronological, viewStateKey]);

  // Handler for Gantt drag-and-drop date changes
  const handleActivityDateChange = async (activityId: string, newPlannedStart: string, newPlannedEnd: string) => {
    if (!isStaff) return;
    await updateActivity(activityId, { 
      planned_start: newPlannedStart, 
      planned_end: newPlannedEnd 
    });
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    setIsExporting(true);
    toast.info("Gerando PDF...");

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
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleReportClick = (report: WeeklyReport, index: number) => {
    setSelectedWeeklyReport(report);
    setSelectedWeekIndex(index);
    patchPortalViewState(viewStateKey, {
      activeTab: "relatorio",
      weeklyReport: { open: true, index },
    });
  };

  const handleBackToList = () => {
    setSelectedWeeklyReport(null);
    patchPortalViewState(viewStateKey, { weeklyReport: { open: false } });
  };

  const handlePreviousWeek = () => {
    if (selectedWeekIndex > 0) {
      const newIndex = selectedWeekIndex - 1;
      setSelectedWeekIndex(newIndex);
      setSelectedWeeklyReport(reportsChronological[newIndex]);
      patchPortalViewState(viewStateKey, { weeklyReport: { open: true, index: newIndex } });
    }
  };

  const handleNextWeek = () => {
    if (selectedWeekIndex < reportsChronological.length - 1) {
      const newIndex = selectedWeekIndex + 1;
      setSelectedWeekIndex(newIndex);
      setSelectedWeeklyReport(reportsChronological[newIndex]);
      patchPortalViewState(viewStateKey, { weeklyReport: { open: true, index: newIndex } });
    }
  };

  if (projectLoading || activitiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{projectError}</p>
          <button onClick={() => navigate(-1)} className="text-primary underline">
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
          <button onClick={() => navigate(-1)} className="text-primary underline">
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
          <div className="flex flex-col items-center gap-0.5">
            <img src={bwildLogo} alt="Bwild" className="h-6 w-auto" />
            <h1 className="font-bold text-xl text-foreground">Portal do Cliente</h1>
          </div>
        </div>

        <div className="p-3 md:p-4 lg:p-6 xl:p-8">
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
            />

            {/* Staff: Show button to create schedule */}
            {isStaff && (
              <div className="bg-card rounded-xl shadow-card p-6 text-center">
                <h3 className="font-semibold mb-2">Cronograma não cadastrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Cadastre as atividades do cronograma para acompanhar o progresso da obra.
                </p>
                <Button onClick={() => navigate(paths.cronograma)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Cronograma
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Quando a aba fica oculta, desmonta a UI pesada (gráficos/tabelas) para reduzir uso de memória
  // e diminuir a chance do navegador descartar a aba e recarregar a página ao voltar.
  if (!isPageVisible) {
    return <div className="min-h-screen min-h-[100dvh] bg-background" />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe">
      {/* Fixed Mobile Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border md:hidden px-3 py-2.5">
        <div className="flex flex-col items-center gap-0.5 opacity-0 animate-fade-in" style={{ animationDelay: "0ms" }}>
          <img src={bwildLogo} alt="Bwild" className="h-6 w-auto" />
          <h1 className="font-bold text-xl text-foreground">Portal do Cliente</h1>
        </div>
      </div>

      <div className="p-3 md:p-4 lg:p-6 xl:p-8">
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
              />
            </div>

            <div className="bg-card rounded-xl shadow-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="border-b border-border bg-secondary/30">
                  <div className="px-3 md:px-5">
                    <TabsList className="bg-transparent h-auto p-0 gap-0 w-full md:w-auto overflow-x-auto">
                      <TabsTrigger
                        value="curvaS"
                        className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-3 md:px-5 py-2.5 md:py-3 font-semibold text-xs md:text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                      >
                        <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                        Curva S
                      </TabsTrigger>
                      {/* Gantt tab hidden temporarily */}
                      <TabsTrigger
                        value="relatorio"
                        className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-3 md:px-5 py-2.5 md:py-3 font-semibold text-xs md:text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Relatórios
                      </TabsTrigger>
                      <TabsTrigger
                        value="atividade"
                        className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-3 md:px-5 py-2.5 md:py-3 font-semibold text-xs md:text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                      >
                        <Activity className="w-3.5 h-3.5 mr-1.5" />
                        Atividade
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <div className="p-3 md:p-4 lg:p-6">
                  <div className="flex gap-4">
                    {/* Main content area */}
                    <div className={selectedActivityId ? "flex-1 min-w-0" : "w-full"}>
                      <TabsContent value="curvaS" className="mt-0 focus-visible:outline-none">
                        <SCurveChart 
                          activities={reportData.activities} 
                          reportDate={reportData.reportDate}
                          showFullChart={showFullChart}
                          onShowFullChartChange={setShowFullChart}
                        />
                        <ScheduleTable 
                          activities={reportData.activities} 
                          reportDate={reportData.reportDate}
                          selectedActivityId={selectedActivityId}
                          onActivitySelect={setSelectedActivityId}
                        />
                      </TabsContent>

                      {/* Gantt content hidden temporarily */}

                      <TabsContent value="relatorio" className="mt-0 focus-visible:outline-none">
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
                            <WeeklyReportTemplate 
                              data={createEmptyReportTemplate(
                                projectId || "",
                                reportData.projectName,
                                reportData.unitName,
                                reportData.clientName,
                                (selectedWeeklyReport as ExtendedWeeklyReport).weekNumber,
                                format((selectedWeeklyReport as ExtendedWeeklyReport).startDate, "yyyy-MM-dd"),
                                format((selectedWeeklyReport as ExtendedWeeklyReport).endDate, "yyyy-MM-dd")
                              )}
                              isStaff={isStaff}
                            />
                          </>
                        ) : (
                          <WeeklyReportsHistory
                            projectStartDate={reportData.startDate}
                            reportDate={reportData.reportDate}
                            activities={reportData.activities}
                            onReportClick={handleReportClick}
                            isStaff={isStaff}
                          />
                        )}
                      </TabsContent>

                      <TabsContent value="atividade" className="mt-0 focus-visible:outline-none">
                        <ActivityTimeline 
                          projectId={project?.id} 
                          maxItems={30}
                          showHeader={false}
                        />
                      </TabsContent>
                    </div>

                    {/* Activity Details Panel - visible on desktop when activity selected */}
                    {selectedActivityId && (activeTab === 'curvaS' || activeTab === 'gantt') && (
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
