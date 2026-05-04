import { useRef, useCallback, lazy, Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, GanttChartSquare, Calendar, DollarSign, FolderOpen, ClipboardSignature, TrendingUp, FileText } from "lucide-react";
import ReportHeader from "@/components/ReportHeader";
import SCurveChart from "@/components/SCurveChart";
import ScheduleTable from "@/components/ScheduleTable";
import ActivityDetailsPanel from "@/components/ActivityDetailsPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import WeeklyReportsHistory, { ExtendedWeeklyReport } from "@/components/WeeklyReportsHistory";
import WeeklyReportHeader from "@/components/WeeklyReportHeader";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { EmptyState } from "@/components/EmptyState";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { toast } from "sonner";
import { createEmptyReportTemplate } from "@/data/emptyReportTemplate";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";
import { useProjectLayout } from "@/components/layout/ProjectLayoutContext";
import { pdfLogger } from "@/lib/devLogger";
import { prefetchForTab } from "@/lib/prefetch";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { format } from "date-fns";
import { useProjectPortal } from "@/hooks/useProjectPortal";
import { NextActionsBlock } from "@/components/cockpit/NextActionsBlock";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy load heavy components
const GanttChart = lazy(() => import("@/components/GanttChart"));
const WeeklyReportTemplate = lazy(() => import("@/components/report/WeeklyReportTemplate"));
const FinanceiroContent = lazy(() => import("@/components/tabs/FinanceiroContent"));
const DocumentosContent = lazy(() => import("@/components/tabs/DocumentosContent"));
const FormalizacoesContent = lazy(() => import("@/components/tabs/FormalizacoesContent"));
const PendenciasContent = lazy(() => import("@/components/tabs/PendenciasContent"));

const MobileHeader = () => (
  <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border md:hidden px-3 py-2">
    <div className="flex items-center justify-between gap-2">
      <img src={bwildLogo} alt="Bwild" className="h-7 w-auto shrink-0" />
      <h1 className="font-bold text-sm text-foreground truncate flex-1 text-center">Portal do Cliente</h1>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>
    </div>
  </div>
);

const Index = () => {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const { hasShell } = useProjectLayout();

  const {
    project, projectId, projectLoading, projectError, activitiesLoading,
    isStaff, isAdmin, canEditSchedule, paths,
    reportData, milestoneDates,
    activeTab, setActiveTab, isExporting, setIsExporting,
    selectedWeeklyReport, selectedWeekIndex, showFullChart, setShowFullChart,
    selectedActivityId, setSelectedActivityId, reportsChronological,
    reportDataByWeek, isSavingReport, savingWeek, updateActivity,
    handleMilestoneDateChange, handleActivityDateChange,
    handleReportClick, handleBackToList, handlePreviousWeek, handleNextWeek,
    saveWeeklyReport,
  } = useProjectPortal();

  // Redirect to Jornada when project is in project phase
  useEffect(() => {
    if (!projectLoading && project?.is_project_phase && projectId) {
      navigate(`/obra/${projectId}/jornada`, { replace: true });
    }
  }, [projectLoading, project?.is_project_phase, projectId, navigate]);

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current) return;
    const operationId = 'pdf-export';
    pdfLogger.start(operationId, 'Starting PDF export');
    setIsExporting(true);
    const loadingToast = toast.loading("Gerando PDF... Isso pode levar alguns segundos.");
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Relatorio_Obra_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      await html2pdf().set(opt).from(reportRef.current).save();
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
  }, [setIsExporting]);

  // Loading state
  if (projectLoading || activitiesLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] pb-safe">
        {!hasShell && <MobileHeader />}
        <div className="px-4 md:p-4 lg:p-6 xl:p-8">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <ContentSkeleton variant="cards" rows={3} />
            <div className="bg-card rounded-xl shadow-card overflow-hidden p-4 space-y-4">
              <ContentSkeleton variant="chart" />
              <ContentSkeleton variant="table" rows={6} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{projectError}</p>
          <button
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate(isStaff ? '/gestao' : '/minhas-obras', { replace: true });
            }}
            className="text-primary underline"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

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
              if (window.history.length > 1) navigate(-1);
              else navigate(isStaff ? '/gestao' : '/minhas-obras', { replace: true });
            }}
            className="text-primary underline"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // Empty activities
  if (reportData.activities.length === 0) {
    return (
      <div className="min-h-screen min-h-[100dvh] pb-safe">
        {!hasShell && <MobileHeader />}
        <div className="px-4 md:p-4 lg:p-6 xl:p-8">
          <div className="max-w-[1600px] mx-auto space-y-6">
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
              canEditMilestones={isStaff}
              onMilestoneDateChange={isStaff ? handleMilestoneDateChange : undefined}
            />
            <ProjectSubNav className="mt-3 -mx-3 md:-mx-4 lg:-mx-6 xl:-mx-8" />
            {!project?.is_project_phase && <OnboardingChecklist projectId={projectId} />}
            {canEditSchedule && (
              <EmptyState
                variant="schedule"
                title="Cronograma não cadastrado"
                description="Cadastre as atividades do cronograma para acompanhar o progresso da obra."
                action={{ label: "Cadastrar Cronograma", onClick: () => navigate(paths.cronograma), icon: Calendar }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe">
      {!hasShell && <MobileHeader />}
      <div className="px-4 md:p-4 lg:p-6 xl:p-8">
        <div className="max-w-[1600px] mx-auto">
          {/* Cockpit "Ação necessária" — visível só para cliente, antes do relatório */}
          {!isStaff && projectId && (
            <ErrorBoundary name="NextActionsBlock-Project" feature="general" fallback={null}>
              <div className="mb-4">
                <NextActionsBlock projectId={projectId} />
              </div>
            </ErrorBoundary>
          )}
          <div ref={reportRef}>
            <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              {!hasShell && (
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
                  canEditMilestones={isStaff}
                  onMilestoneDateChange={isStaff ? handleMilestoneDateChange : undefined}
                />
              )}
              {hasShell && (
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
                  canEditMilestones={isStaff}
                  onMilestoneDateChange={isStaff ? handleMilestoneDateChange : undefined}
                />
              )}
              <ProjectSubNav className="mt-3 -mx-3 md:mx-0 rounded-none md:rounded-xl" />
            </div>

            <div className="bg-card rounded-xl shadow-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="portal-tabs-bar">
                  <div className="px-3 md:px-5">
                    <TabsList className="bg-transparent h-auto p-0 gap-0 w-full md:w-auto overflow-x-auto scrollbar-hide">
                      {/* Staff with sidebar: only dashboard tabs */}
                      {hasShell ? (
                        <>
                          <TabsTrigger value="cronograma" className="portal-tab-trigger">
                            <GanttChartSquare className="w-3.5 h-3.5 mr-1.5" />Cronograma
                          </TabsTrigger>
                          <TabsTrigger value="evolucao" className="portal-tab-trigger">
                            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />Evolução
                          </TabsTrigger>
                          <TabsTrigger value="relatorios" className="portal-tab-trigger">
                            <FileText className="w-3.5 h-3.5 mr-1.5" />Relatórios
                          </TabsTrigger>
                        </>
                      ) : (
                        <>
                          <TabsTrigger value="cronograma" className="portal-tab-trigger">
                            <GanttChartSquare className="w-3.5 h-3.5 mr-1.5" />Cronograma
                          </TabsTrigger>
                          <TabsTrigger value="evolucao" className="portal-tab-trigger">
                            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />Evolução de Obra
                          </TabsTrigger>
                          <TabsTrigger value="relatorios" className="portal-tab-trigger"
                            onMouseEnter={() => prefetchForTab('relatorio', projectId)}
                            onFocus={() => prefetchForTab('relatorio', projectId)}
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5" />Relatórios
                          </TabsTrigger>
                          <TabsTrigger value="financeiro" className="portal-tab-trigger"
                            onMouseEnter={() => prefetchForTab('financeiro', projectId)}
                            onFocus={() => prefetchForTab('financeiro', projectId)}
                          >
                            <DollarSign className="w-3.5 h-3.5 mr-1.5" />Financeiro
                          </TabsTrigger>
                          <TabsTrigger value="documentos" className="portal-tab-trigger"
                            onMouseEnter={() => prefetchForTab('documentos', projectId)}
                            onFocus={() => prefetchForTab('documentos', projectId)}
                          >
                            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />Documentos
                          </TabsTrigger>
                          <TabsTrigger value="formalizacoes" className="portal-tab-trigger"
                            onMouseEnter={() => prefetchForTab('formalizacoes', projectId)}
                            onFocus={() => prefetchForTab('formalizacoes', projectId)}
                          >
                            <ClipboardSignature className="w-3.5 h-3.5 mr-1.5" />Formalizações
                          </TabsTrigger>
                          <TabsTrigger value="pendencias" className="portal-tab-trigger"
                            onMouseEnter={() => prefetchForTab('pendencias', projectId)}
                            onFocus={() => prefetchForTab('pendencias', projectId)}
                          >
                            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />Pendências
                          </TabsTrigger>
                        </>
                      )}
                    </TabsList>
                  </div>
                </div>

                <div className="p-3 md:p-4 lg:p-6">
                  <div className="flex gap-4">
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
                        <SCurveChart
                          activities={reportData.activities}
                          reportDate={reportData.reportDate}
                          projectStartDate={reportData.startDate}
                          projectEndDate={reportData.endDate}
                          showFullChart={showFullChart}
                          onShowFullChartChange={setShowFullChart}
                        />
                      </TabsContent>

                      <TabsContent value="relatorios" className="mt-0 focus-visible:outline-none">
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
                                projectId || "", reportData.projectName, reportData.unitName,
                                reportData.clientName, weekNum, weekStart, weekEnd
                              );
                              return (
                                <Suspense fallback={<ContentSkeleton variant="report" />}>
                                  <WeeklyReportTemplate
                                    data={templateData}
                                    isStaff={isStaff}
                                    projectId={projectId}
                                    isSaving={isSavingReport && savingWeek === weekNum}
                                    onSaveReport={(updated) => saveWeeklyReport(weekNum, weekStart, weekEnd, updated)}
                                  />
                                </Suspense>
                              );
                            })()}
                          </>
                        ) : (
                          <WeeklyReportsHistory
                            projectStartDate={reportData.startDate ?? ''}
                            reportDate={reportData.reportDate}
                            projectEndDate={reportData.endDate ?? undefined}
                            activities={reportData.activities}
                            onReportClick={handleReportClick}
                            isStaff={isStaff}
                          />
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

                    {selectedActivityId && activeTab === 'cronograma' && (
                      <div className="hidden md:block w-64 lg:w-80 shrink-0">
                        <ActivityDetailsPanel
                          activity={reportData.activities.find(a => a.id === selectedActivityId) || null}
                          activities={reportData.activities}
                          onClose={() => setSelectedActivityId(null)}
                        />
                      </div>
                    )}

                    {/* Mobile (<md): detalhes da atividade em bottom sheet */}
                    <Sheet
                      open={!!selectedActivityId && activeTab === 'cronograma'}
                      onOpenChange={(open) => { if (!open) setSelectedActivityId(null); }}
                    >
                      <SheetContent side="bottom" className="md:hidden max-h-[85vh] overflow-y-auto rounded-t-2xl pb-safe">
                        <SheetHeader className="pb-2">
                          <SheetTitle className="text-base">Detalhes da atividade</SheetTitle>
                        </SheetHeader>
                        <ActivityDetailsPanel
                          activity={reportData.activities.find(a => a.id === selectedActivityId) || null}
                          activities={reportData.activities}
                          onClose={() => setSelectedActivityId(null)}
                        />
                      </SheetContent>
                    </Sheet>
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
