import { useRef, useCallback, lazy, Suspense, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  readMobileNavSlot,
  pathForMobileNavSlot,
} from "@/lib/mobileBottomNavMemory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  GanttChartSquare,
  Calendar,
  DollarSign,
  FolderOpen,
  ClipboardSignature,
  TrendingUp,
  FileText,
} from "lucide-react";
import ReportHeader from "@/components/ReportHeader";
import SCurveChart from "@/components/SCurveChart";
import ScheduleTable from "@/components/ScheduleTable";
import { CronogramaPdfButton } from "@/components/cronograma/CronogramaPdfButton";
import ActivityDetailsPanel from "@/components/ActivityDetailsPanel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import WeeklyReportsHistory, {
  ExtendedWeeklyReport,
} from "@/components/WeeklyReportsHistory";
import WeeklyReportHeader from "@/components/WeeklyReportHeader";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { EmptyState } from "@/components/EmptyState";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { toast } from "sonner";
import { createEmptyReportTemplate } from "@/data/emptyReportTemplate";
import { useProjectLayout } from "@/components/layout/ProjectLayoutContext";
import { pdfLogger } from "@/lib/devLogger";
import { prefetchForTab } from "@/lib/prefetch";
import { format } from "date-fns";
import { useProjectPortal } from "@/hooks/useProjectPortal";
import { NextActionsBlock } from "@/components/cockpit/NextActionsBlock";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LiveStatus } from "@/components/a11y/LiveStatus";
import { trackAmplitude } from "@/lib/amplitude";

// Lazy load heavy components
const _GanttChart = lazy(() => import("@/components/GanttChart"));
const WeeklyReportTemplate = lazy(
  () => import("@/components/report/WeeklyReportTemplate"),
);
const FinanceiroContent = lazy(
  () => import("@/components/tabs/FinanceiroContent"),
);
const DocumentosContent = lazy(
  () => import("@/components/tabs/DocumentosContent"),
);
const FormalizacoesContent = lazy(
  () => import("@/components/tabs/FormalizacoesContent"),
);
const PendenciasContent = lazy(
  () => import("@/components/tabs/PendenciasContent"),
);

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reportRef = useRef<HTMLDivElement>(null);
  const reportDetailRef = useRef<HTMLDivElement>(null);
  const { hasShell } = useProjectLayout();

  const {
    project,
    projectId,
    projectLoading,
    projectError,
    refetchProject,
    activitiesLoading,
    projectActivities,
    isStaff,
    isAdmin: _isAdmin,
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
    availableAtByWeek,
    isSavingReport,
    savingWeek,
    updateActivity,
    handleMilestoneDateChange,
    handleActivityDateChange: _handleActivityDateChange,
    handleReportClick,
    handleBackToList,
    handlePreviousWeek,
    handleNextWeek,
    saveWeeklyReport,
  } = useProjectPortal();

  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const restoreCheckedRef = useRef(false);

  // Redirect to Jornada when project is in project phase
  useEffect(() => {
    if (!projectLoading && project?.is_project_phase && projectId) {
      navigate(`/obra/${projectId}/jornada`, { replace: true });
    }
  }, [projectLoading, project?.is_project_phase, projectId, navigate]);

  // Restore the last bottom-nav slot the user picked for this project.
  // Runs once per mount: if we landed at /obra/:projectId on mobile and there
  // is a remembered slot, jump straight to that route so the bottom-nav
  // selection is preserved across sessions.
  useEffect(() => {
    if (!isMobile || !projectId) return;
    if (restoreCheckedRef.current) return;
    restoreCheckedRef.current = true;
    // Only restore when the user landed on the project root — not on a
    // deep-linked schedule/relatório/etc. or already on a bottom-nav route.
    if (location.pathname !== `/obra/${projectId}`) return;
    // A deep-link carrying an explicit ?tab= (e.g. the report-published
    // notification → ?tab=relatorios) must win over the persisted bottom-nav
    // slot — otherwise the restore would immediately navigate away from it.
    if (searchParams.get("tab")) return;
    const slot = readMobileNavSlot(projectId);
    if (!slot) return;
    const target = pathForMobileNavSlot(projectId, slot);
    trackAmplitude("mobile_tab_route_redirect", {
      projectId,
      slot,
      target,
      reason: "persisted_slot_restore",
    });
    navigate(target, { replace: true });
  }, [isMobile, projectId, location.pathname, navigate, searchParams]);

  // Mobile sync: route-only tabs (financeiro/documentos/formalizacoes/pendencias)
  // live in the bottom nav as standalone pages. If a stale activeTab still
  // points there, redirect so the bottom nav highlight matches the view.
  // Guard against navigation loops: only redirect when the current pathname
  // does not already match the resolved target.
  useEffect(() => {
    if (!isMobile || !projectId) return;
    const routeMap: Record<string, string> = {
      financeiro: `/obra/${projectId}/financeiro`,
      documentos: `/obra/${projectId}/documentos`,
      formalizacoes: `/obra/${projectId}/formalizacoes`,
      pendencias: `/obra/${projectId}/pendencias`,
    };
    const visible = ["cronograma", "evolucao", "relatorios"];
    const target = routeMap[activeTab];
    if (target) {
      if (location.pathname === target) return;
      trackAmplitude("mobile_tab_route_redirect", {
        projectId,
        slot: activeTab,
        target,
        reason: "stale_active_tab",
      });
      setActiveTab("cronograma");
      navigate(target, { replace: true });
      return;
    }
    // Fallback: activeTab is stale (not a visible tab and not in routeMap).
    // Reset to the default visible tab so the UI stays consistent.
    if (!visible.includes(activeTab)) {
      trackAmplitude("mobile_tab_synced", {
        projectId,
        from: activeTab,
        to: "cronograma",
        reason: "fallback_invalid_tab",
      });
      setActiveTab("cronograma");
    }
  }, [
    isMobile,
    activeTab,
    projectId,
    navigate,
    setActiveTab,
    location.pathname,
  ]);

  // URL <-> activeTab sync for the visible Index tabs.
  // Keeps the address bar (and browser back/forward history) authoritative,
  // so the bottom-nav highlight + the top TabsList always reflect the URL.
  const VISIBLE_TABS = ["cronograma", "evolucao", "relatorios"] as const;
  const urlTab = searchParams.get("tab");
  const activeTabStorageKey = projectId
    ? `mobileActiveTab:${projectId}`
    : null;

  // URL -> state: when the user lands or hits back/forward, adopt the tab
  // from the query string if it is a valid Index tab. On mobile, if no ?tab
  // is present, fall back to the value persisted in localStorage so a refresh
  // restores the last selected tab.
  useEffect(() => {
    if (urlTab) {
      if (!(VISIBLE_TABS as readonly string[]).includes(urlTab)) return;
      if (urlTab === activeTab) return;
      trackAmplitude("mobile_tab_synced", {
        projectId: projectId ?? null,
        from: activeTab,
        to: urlTab,
        reason: "url_param",
      });
      setActiveTab(urlTab);
      return;
    }
    if (!isMobile || !activeTabStorageKey) return;
    try {
      const stored = localStorage.getItem(activeTabStorageKey);
      if (!stored) return;
      if (!(VISIBLE_TABS as readonly string[]).includes(stored)) return;
      if (stored === activeTab) return;
      trackAmplitude("mobile_tab_synced", {
        projectId: projectId ?? null,
        from: activeTab,
        to: stored,
        reason: "localstorage_restore",
      });
      setActiveTab(stored);
    } catch {
      // ignore storage access errors (private mode, quota, etc.)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab, isMobile, activeTabStorageKey]);

  // state -> URL: when the user toggles a tab on Index, mirror it to ?tab=
  // (replace, no extra history entries) so refresh and deep-links keep state.
  // Also persist the selection in localStorage per project so it survives
  // a hard reload on mobile.
  useEffect(() => {
    if (!(VISIBLE_TABS as readonly string[]).includes(activeTab)) return;
    if (activeTabStorageKey) {
      try {
        localStorage.setItem(activeTabStorageKey, activeTab);
      } catch {
        // ignore storage access errors
      }
    }
    if (searchParams.get("tab") === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams, activeTabStorageKey]);

  // When the user opens a weekly report (click on the list, or prev/next),
  // ensure the report header is brought into view. The project shell scrolls
  // inside its own overflow container, so window.scrollTo won't help — use
  // scrollIntoView on the report node itself. Runs on every selection change
  // (including week navigation) but skips when the detail view is closed.
  useEffect(() => {
    if (!selectedWeeklyReport) return;
    const node = reportDetailRef.current;
    if (!node) return;

    // ProjectShell mounts the content inside a sibling com `overflow-y-auto`,
    // então `window.scrollTo` não funciona. Também não basta rolar logo de
    // cara: enquanto o lazy `WeeklyReportTemplate` está em Suspense, o nó só
    // contém o cabeçalho (~150px) e o ContentSkeleton, e qualquer scroll
    // disparado nesse momento para no meio da lista anterior. Estratégia:
    //   1. esperar o template real montar — sinalizado pelo atributo
    //      `data-report-template-ready` em qualquer um dos seus branches;
    //   2. ler `getBoundingClientRect` no frame seguinte (após layout);
    //   3. rolar diretamente o ancestral scrollável real.
    const findScrollableAncestor = (
      el: HTMLElement | null,
    ): HTMLElement | null => {
      let cur = el?.parentElement ?? null;
      while (cur) {
        const style = window.getComputedStyle(cur);
        const oy = style.overflowY;
        if (
          (oy === "auto" || oy === "scroll") &&
          cur.scrollHeight > cur.clientHeight
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    };

    const performScroll = () => {
      const scroller = findScrollableAncestor(node);
      if (scroller) {
        const nodeRect = node.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const delta = nodeRect.top - scrollerRect.top - 8;
        scroller.scrollTo({
          top: scroller.scrollTop + delta,
          behavior: "smooth",
        });
      } else {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    let raf = 0;
    let timeoutId = 0;
    let observer: MutationObserver | null = null;
    let done = false;

    const scheduleScrollAfterLayout = () => {
      if (done) return;
      done = true;
      observer?.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
      // dois rAF: garante que o layout pós-mount foi aplicado antes da medição
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(performScroll);
      });
    };

    // Caso 1: template já estava montado (cache do lazy, navegação prev/next
    // dentro da mesma instância, ou re-render). Rola imediatamente.
    if (node.querySelector("[data-report-template-ready]")) {
      scheduleScrollAfterLayout();
    } else {
      // Caso 2: aguarda o marcador aparecer via MutationObserver. Limite
      // máximo de 2s para não travar caso algo dê errado — nesse caso rola
      // com o que estiver renderizado (ainda melhor que não rolar).
      observer = new MutationObserver(() => {
        if (node.querySelector("[data-report-template-ready]")) {
          scheduleScrollAfterLayout();
        }
      });
      observer.observe(node, { childList: true, subtree: true });
      timeoutId = window.setTimeout(scheduleScrollAfterLayout, 2000);
    }

    return () => {
      done = true;
      observer?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
    // selectedWeeklyReport identity changes on every click/prev/next, so this
    // is intentionally tied to it (not just its presence).
  }, [selectedWeeklyReport]);


  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current) return;
    const operationId = "pdf-export";
    pdfLogger.start(operationId, "Starting PDF export");
    setIsExporting(true);
    const loadingToast = toast.loading(
      "Gerando PDF... Isso pode levar alguns segundos.",
    );
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Relatorio_Obra_${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };
      await html2pdf().set(opt).from(reportRef.current).save();
      toast.dismiss(loadingToast);
      toast.success("PDF exportado com sucesso!");
      pdfLogger.end(operationId, { level: "success" });
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
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => refetchProject()}
              className="text-primary underline"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => {
                if (window.history.length > 1) navigate(-1);
                else
                  navigate(isStaff ? "/gestao" : "/minhas-obras", {
                    replace: true,
                  });
              }}
              className="text-primary underline"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            Dados ainda não disponíveis
          </h2>
          <p className="text-muted-foreground mb-4">
            Os dados desta obra ainda não foram carregados. Entre em contato com
            seu engenheiro responsável.
          </p>
          <button
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else
                navigate(isStaff ? "/gestao" : "/minhas-obras", {
                  replace: true,
                });
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
              onMilestoneDateChange={
                isStaff ? handleMilestoneDateChange : undefined
              }
            />
            {!project?.is_project_phase && (
              <OnboardingChecklist projectId={projectId} />
            )}
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

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe">
      <LiveStatus>
        {isSavingReport
          ? `Salvando relatório${savingWeek != null ? ` da semana ${savingWeek}` : ""}…`
          : null}
      </LiveStatus>
      <div className="px-4 md:p-4 lg:p-6 xl:p-8">
        <div className="max-w-[1600px] mx-auto">
          {/* Bloco "Ação necessária" removido do ambiente da obra do cliente
              a pedido — segue disponível em /minhas-obras. */}
          <div ref={reportRef}>
            <div
              className="opacity-0 animate-fade-in-up"
              style={{ animationDelay: "100ms" }}
            >
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
                  onMilestoneDateChange={
                    isStaff ? handleMilestoneDateChange : undefined
                  }
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
                  onMilestoneDateChange={
                    isStaff ? handleMilestoneDateChange : undefined
                  }
                />
              )}
            </div>

            <div
              className="bg-card rounded-xl shadow-card overflow-hidden opacity-0 animate-fade-in-up"
              style={{ animationDelay: "200ms" }}
            >
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <div className="portal-tabs-bar">
                  <div className="px-3 md:px-5">
                    <TabsList className="bg-transparent h-auto p-0 gap-0 w-full md:w-auto overflow-x-auto scrollbar-hide">
                      {/* Staff with sidebar: only dashboard tabs */}
                      {hasShell ? (
                        <>
                          <TabsTrigger
                            value="cronograma"
                            className="portal-tab-trigger"
                          >
                            <GanttChartSquare className="w-3.5 h-3.5 mr-1.5" />
                            Cronograma
                          </TabsTrigger>
                          <TabsTrigger
                            value="evolucao"
                            className="portal-tab-trigger"
                          >
                            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                            Evolução
                          </TabsTrigger>
                          <TabsTrigger
                            value="relatorios"
                            className="portal-tab-trigger"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            Relatórios
                          </TabsTrigger>
                        </>
                      ) : (
                        <>
                          <TabsTrigger
                            value="cronograma"
                            className="portal-tab-trigger"
                          >
                            <GanttChartSquare className="w-3.5 h-3.5 mr-1.5" />
                            Cronograma
                          </TabsTrigger>
                          <TabsTrigger
                            value="evolucao"
                            className="portal-tab-trigger"
                          >
                            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                            Evolução de Obra
                          </TabsTrigger>
                          <TabsTrigger
                            value="relatorios"
                            className="portal-tab-trigger"
                            onMouseEnter={() =>
                              prefetchForTab("relatorio", projectId)
                            }
                            onFocus={() =>
                              prefetchForTab("relatorio", projectId)
                            }
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            Relatórios
                          </TabsTrigger>
                          <TabsTrigger
                            value="financeiro"
                            className="portal-tab-trigger hidden md:inline-flex"
                            onMouseEnter={() =>
                              prefetchForTab("financeiro", projectId)
                            }
                            onFocus={() =>
                              prefetchForTab("financeiro", projectId)
                            }
                          >
                            <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                            Financeiro
                          </TabsTrigger>
                          <TabsTrigger
                            value="documentos"
                            className="portal-tab-trigger hidden md:inline-flex"
                            onMouseEnter={() =>
                              prefetchForTab("documentos", projectId)
                            }
                            onFocus={() =>
                              prefetchForTab("documentos", projectId)
                            }
                          >
                            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                            Documentos
                          </TabsTrigger>
                          <TabsTrigger
                            value="formalizacoes"
                            className="portal-tab-trigger hidden md:inline-flex"
                            onMouseEnter={() =>
                              prefetchForTab("formalizacoes", projectId)
                            }
                            onFocus={() =>
                              prefetchForTab("formalizacoes", projectId)
                            }
                          >
                            <ClipboardSignature className="w-3.5 h-3.5 mr-1.5" />
                            Formalizações
                          </TabsTrigger>
                          <TabsTrigger
                            value="pendencias"
                            className="portal-tab-trigger hidden md:inline-flex"
                            onMouseEnter={() =>
                              prefetchForTab("pendencias", projectId)
                            }
                            onFocus={() =>
                              prefetchForTab("pendencias", projectId)
                            }
                          >
                            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                            Pendências
                          </TabsTrigger>
                        </>
                      )}
                    </TabsList>
                  </div>
                </div>

                <div className="p-3 md:p-4 lg:p-6">
                  <div className="flex gap-4">
                    <div
                      className={
                        selectedActivityId ? "flex-1 min-w-0" : "w-full"
                      }
                    >
                      <TabsContent
                        value="cronograma"
                        className="mt-0 focus-visible:outline-none"
                      >
                        <div className="flex justify-end px-3 md:px-5 pt-3">
                          <CronogramaPdfButton
                            project={project}
                            activities={projectActivities}
                          />
                        </div>
                        <ScheduleTable
                          activities={reportData.activities}
                          reportDate={reportData.reportDate}
                          selectedActivityId={selectedActivityId}
                          onActivitySelect={setSelectedActivityId}
                          canEditDates={canEditSchedule}
                          onUpdateActivityDates={
                            canEditSchedule ? updateActivity : undefined
                          }
                        />
                      </TabsContent>

                      <TabsContent
                        value="evolucao"
                        className="mt-0 focus-visible:outline-none"
                      >
                        <SCurveChart
                          activities={reportData.activities}
                          reportDate={reportData.reportDate}
                          projectStartDate={reportData.startDate}
                          projectEndDate={reportData.endDate}
                          showFullChart={showFullChart}
                          onShowFullChartChange={setShowFullChart}
                        />
                      </TabsContent>

                      <TabsContent
                        value="relatorios"
                        className="mt-0 focus-visible:outline-none"
                      >
                        {selectedWeeklyReport ? (
                          <div ref={reportDetailRef} className="scroll-mt-4">
                            <WeeklyReportHeader
                              weeklyReport={selectedWeeklyReport}
                              activities={reportData.activities}
                              onPreviousWeek={handlePreviousWeek}
                              onNextWeek={handleNextWeek}
                              onBackToList={handleBackToList}
                              onExportPDF={handleExportPDF}
                              isExporting={isExporting}
                              hasPrevious={selectedWeekIndex > 0}
                              hasNext={
                                selectedWeekIndex <
                                reportsChronological.length - 1
                              }
                            />
                            {(() => {
                              const extendedReport =
                                selectedWeeklyReport as ExtendedWeeklyReport;
                              const weekNum = extendedReport.weekNumber;
                              const weekStart = format(
                                extendedReport.startDate,
                                "yyyy-MM-dd",
                              );
                              const weekEnd = format(
                                extendedReport.endDate,
                                "yyyy-MM-dd",
                              );
                              const storedData = reportDataByWeek.get(weekNum);
                              const templateData =
                                storedData ??
                                createEmptyReportTemplate(
                                  projectId || "",
                                  reportData.projectName,
                                  reportData.unitName,
                                  reportData.clientName,
                                  weekNum,
                                  weekStart,
                                  weekEnd,
                                );
                              return (
                                <Suspense
                                  key={`weekly-report-${projectId ?? "none"}-${weekNum}`}
                                  fallback={
                                    <div
                                      role="status"
                                      aria-busy="true"
                                      aria-label="Carregando relatório semanal"
                                      className="space-y-6 animate-pulse"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                                        <p className="text-sm font-medium text-muted-foreground">
                                          Carregando relatório da semana{" "}
                                          {weekNum}…
                                        </p>
                                      </div>
                                      <ContentSkeleton variant="report" />
                                    </div>
                                  }
                                >
                                  <WeeklyReportTemplate
                                    key={`weekly-report-tpl-${projectId ?? "none"}-${weekNum}`}
                                    data={templateData}
                                    isStaff={isStaff}
                                    projectId={projectId}
                                    isSaving={
                                      isSavingReport && savingWeek === weekNum
                                    }
                                    onSaveReport={(updated) =>
                                      saveWeeklyReport(
                                        weekNum,
                                        weekStart,
                                        weekEnd,
                                        updated,
                                      )
                                    }
                                  />
                                </Suspense>
                              );
                            })()}
                          </div>
                        ) : (
                          <WeeklyReportsHistory
                            projectStartDate={reportData.startDate ?? ""}
                            reportDate={reportData.reportDate}
                            projectEndDate={reportData.endDate ?? undefined}
                            activities={reportData.activities}
                            onReportClick={handleReportClick}
                            isStaff={isStaff}
                            availableAtByWeek={availableAtByWeek}
                          />
                        )}
                      </TabsContent>

                      <TabsContent
                        value="financeiro"
                        className="mt-0 focus-visible:outline-none"
                      >
                        <Suspense
                          fallback={
                            <ContentSkeleton variant="cards" rows={3} />
                          }
                        >
                          <FinanceiroContent />
                        </Suspense>
                      </TabsContent>
                      <TabsContent
                        value="documentos"
                        className="mt-0 focus-visible:outline-none"
                      >
                        <Suspense
                          fallback={
                            <ContentSkeleton variant="cards" rows={6} />
                          }
                        >
                          <DocumentosContent />
                        </Suspense>
                      </TabsContent>
                      <TabsContent
                        value="formalizacoes"
                        className="mt-0 focus-visible:outline-none"
                      >
                        <Suspense
                          fallback={
                            <ContentSkeleton variant="cards" rows={4} />
                          }
                        >
                          <FormalizacoesContent />
                        </Suspense>
                      </TabsContent>
                      <TabsContent
                        value="pendencias"
                        className="mt-0 focus-visible:outline-none"
                      >
                        <Suspense
                          fallback={<ContentSkeleton variant="list" rows={5} />}
                        >
                          <PendenciasContent />
                        </Suspense>
                      </TabsContent>
                    </div>

                    {selectedActivityId && activeTab === "cronograma" && (
                      <div className="hidden md:block w-64 lg:w-80 shrink-0">
                        <ActivityDetailsPanel
                          activity={
                            reportData.activities.find(
                              (a) => a.id === selectedActivityId,
                            ) || null
                          }
                          activities={reportData.activities}
                          onClose={() => setSelectedActivityId(null)}
                        />
                      </div>
                    )}

                    {/* Mobile (<md): detalhes da atividade em bottom sheet */}
                    <Sheet
                      open={!!selectedActivityId && activeTab === "cronograma"}
                      onOpenChange={(open) => {
                        if (!open) setSelectedActivityId(null);
                      }}
                    >
                      <SheetContent
                        side="bottom"
                        className="md:hidden max-h-[85vh] overflow-y-auto rounded-t-2xl pb-safe"
                      >
                        <SheetHeader className="pb-2">
                          <SheetTitle className="text-base">
                            Detalhes da atividade
                          </SheetTitle>
                        </SheetHeader>
                        <ActivityDetailsPanel
                          activity={
                            reportData.activities.find(
                              (a) => a.id === selectedActivityId,
                            ) || null
                          }
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
