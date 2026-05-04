import {
  lazy,
  Suspense,
  useRef,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";
import { ArrowLeft } from "lucide-react";
import { ActivityTimelineCompact } from "@/components/ActivityTimeline";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { JourneyTimeline } from "@/components/journey/JourneyTimeline";
import { JourneyStepperCompact } from "@/components/journey/JourneyStepperCompact";
import { JourneyTimelineSheet } from "@/components/journey/JourneyTimelineSheet";
import { JourneyWelcomeStage } from "@/components/journey/JourneyWelcomeStage";
import { StageDetailInline } from "@/components/journey/StageDetailInline";
import { PullToRefreshIndicator } from "@/components/journey/PullToRefreshIndicator";
import { TabOnboardingTip } from "@/components/journey/TabOnboardingTip";
import { journeyCopy } from "@/constants/journeyCopy";
import { useIsMobile } from "@/hooks/use-mobile";
import type {
  JourneyStage,
  JourneyStageStatus,
} from "@/hooks/useProjectJourney";

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

function isStageBlocked(
  stage: JourneyStage,
  index: number,
  stages: JourneyStage[],
): boolean {
  if (
    stage.status === "completed" ||
    stage.status === "in_progress" ||
    stage.status === "waiting_action"
  )
    return false;
  if (stage.dependencies_text) return true;
  if (index > 0 && stages[index - 1].status !== "completed") return true;
  return false;
}

interface JornadaTabContentProps {
  activeTab: string;
  handleTabChange: (tab: string) => void;
  projectId: string;
  projectName: string;
  isAdmin: boolean;
  journey: {
    hero: any;
    stages: JourneyStage[];
  };
  welcomeCompleted: boolean;
  setWelcomeCompleted: (v: boolean) => void;
  welcomeKey: string;
  hasRealProgress: boolean;
  pulling: boolean;
  refreshing: boolean;
  pullDistance: number;
  threshold: number;
}

export function JornadaTabContent({
  activeTab,
  handleTabChange,
  projectId,
  projectName,
  isAdmin,
  journey,
  welcomeCompleted,
  setWelcomeCompleted,
  welcomeKey,
  hasRealProgress,
  pulling,
  refreshing,
  pullDistance,
  threshold,
}: JornadaTabContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [timelineSheetOpen, setTimelineSheetOpen] = useState(false);
  const hasAutoNavigated = useRef(false);
  const isMobile = useIsMobile();
  // On mobile, null means "show overview", a stageId means "show detail"
  const [mobileDetailStageId, setMobileDetailStageId] = useState<string | null>(
    null,
  );

  // Determine active view
  const [activeView, setActiveView] = useState<string>("welcome");

  useEffect(() => {
    if (hasRealProgress && journey?.stages && !hasAutoNavigated.current) {
      hasAutoNavigated.current = true;
      const currentStage =
        journey.stages.find(
          (s) => s.status === "in_progress" || s.status === "waiting_action",
        ) ||
        journey.stages.find(
          (s) => s.status !== "completed" && s.status !== "pending",
        );
      if (currentStage) setActiveView(currentStage.id);
    }
  }, [hasRealProgress, journey?.stages]);

  // Build stages list with virtual welcome stage
  const welcomeVirtualStage = useMemo(
    () => ({
      id: "welcome",
      project_id: projectId,
      sort_order: 0,
      name: "Boas-vindas",
      icon: "users",
      status: (welcomeCompleted
        ? "completed"
        : "in_progress") as JourneyStageStatus,
      description: null,
      warning_text: null,
      cta_text: null,
      cta_url: null,
      cta_visible: false,
      microcopy: null,
      responsible: null,
      dependencies_text: null,
      revision_text: null,
      proposed_start: null,
      proposed_end: null,
      confirmed_start: null,
      confirmed_end: null,
      waiting_since: null,
      todos: [],
    }),
    [projectId, welcomeCompleted],
  );

  const adjustedStages = useMemo(
    () =>
      journey.stages.map((s) =>
        welcomeCompleted || hasRealProgress
          ? s
          : { ...s, status: "pending" as JourneyStageStatus },
      ),
    [journey.stages, welcomeCompleted, hasRealProgress],
  );

  const allStagesForStepper = useMemo(
    () => [welcomeVirtualStage, ...adjustedStages],
    [welcomeVirtualStage, adjustedStages],
  );

  const selectedStage = useMemo(() => {
    if (activeView === "welcome") return null;
    return journey.stages.find((s) => s.id === activeView) || null;
  }, [activeView, journey.stages]);

  const selectedStageNextName = useMemo(() => {
    if (!selectedStage) return null;
    const idx = journey.stages.findIndex((s) => s.id === selectedStage.id);
    return journey.stages[idx + 1]?.name ?? null;
  }, [selectedStage, journey.stages]);

  const handleTimelineClick = useCallback(
    (stageId: string) => {
      if (stageId === "welcome") {
        setActiveView("welcome");
        if (isMobile) {
          setMobileDetailStageId("welcome");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }
      if (!welcomeCompleted && !isAdmin) return;
      if (!isAdmin) {
        const idx = journey.stages.findIndex((s) => s.id === stageId);
        if (
          idx >= 0 &&
          isStageBlocked(journey.stages[idx], idx, journey.stages)
        )
          return;
      }
      setActiveView(stageId);
      if (isMobile) {
        setMobileDetailStageId(stageId);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setTimeout(
          () =>
            contentRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          100,
        );
      }
    },
    [journey.stages, welcomeCompleted, isAdmin, isMobile],
  );

  const handleAdvanceFromWelcome = useCallback(() => {
    setWelcomeCompleted(true);
    if (welcomeKey) localStorage.setItem(welcomeKey, "1");
    if (journey.stages.length > 0) {
      setActiveView(journey.stages[0].id);
      setTimeout(
        () =>
          contentRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        100,
      );
    }
  }, [journey.stages, welcomeKey, setWelcomeCompleted]);

  return (
    <>
      <PullToRefreshIndicator
        pulling={pulling}
        refreshing={refreshing}
        pullDistance={pullDistance}
        threshold={threshold}
      />

      {/* Breadcrumb contextual */}
      {activeTab !== "jornada" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <button
            onClick={() => handleTabChange("jornada")}
            className="hover:text-foreground transition-colors"
          >
            {projectName}
          </button>
          <span>›</span>
          <span className="text-foreground font-medium">
            {activeTab === "financeiro"
              ? "Financeiro"
              : activeTab === "documentos"
                ? "Documentos"
                : activeTab === "formalizacoes"
                  ? "Formalizações"
                  : "Pendências"}
          </span>
        </div>
      )}

      {/* Jornada tab content */}
      {activeTab === "jornada" && (
        <>
          {/* ── Desktop layout (unchanged) ── */}
          <div className="hidden md:grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground mb-4">
                    {journeyCopy.page.sidebarTitle}
                  </h2>
                  <JourneyTimeline
                    stages={allStagesForStepper}
                    activeStageId={activeView}
                    onStageClick={handleTimelineClick}
                  />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground mb-3">
                    Atividade Recente
                  </h2>
                  <ActivityTimelineCompact projectId={projectId} maxItems={5} />
                </div>
              </div>
            </aside>

            <div ref={contentRef} className="space-y-4 md:space-y-8 min-w-0">
              <JourneyStepperCompact
                stages={allStagesForStepper}
                activeStageId={activeView}
                onOpenTimeline={() => setTimelineSheetOpen(true)}
                onStageClick={handleTimelineClick}
              />
              <JourneyTimelineSheet
                open={timelineSheetOpen}
                onOpenChange={setTimelineSheetOpen}
                stages={allStagesForStepper}
                activeStageId={activeView}
                onStageClick={handleTimelineClick}
              />

              <AnimatePresence mode="wait">
                {activeView === "welcome" ? (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <JourneyWelcomeStage
                      hero={journey.hero}
                      projectId={projectId}
                      isAdmin={isAdmin}
                      onAdvance={handleAdvanceFromWelcome}
                      nextStageName={journey.stages[0]?.name ?? "próxima etapa"}
                    />
                  </motion.div>
                ) : selectedStage ? (
                  <motion.div
                    key={selectedStage.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <StageDetailInline
                      stage={selectedStage}
                      projectId={projectId}
                      isAdmin={isAdmin}
                      nextStageName={selectedStageNextName}
                      allStages={journey.stages}
                      onStageCompleted={() => {
                        const idx = journey.stages.findIndex(
                          (s) => s.id === selectedStage.id,
                        );
                        const next = journey.stages[idx + 1];
                        if (next)
                          setTimeout(() => handleTimelineClick(next.id), 500);
                      }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <Separator />
            </div>
          </div>

          {/* ── Mobile layout: overview → drill-down ── */}
          <div className="md:hidden space-y-4">
            <AnimatePresence mode="wait">
              {mobileDetailStageId === null ? (
                <motion.div
                  key="mobile-overview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <JourneyStepperCompact
                    stages={allStagesForStepper}
                    activeStageId={activeView}
                    onOpenTimeline={() => {}}
                    onStageClick={handleTimelineClick}
                  />
                  <div className="mt-4">
                    <h2 className="text-sm font-medium text-muted-foreground mb-3">
                      {journeyCopy.page.sidebarTitle}
                    </h2>
                    <JourneyTimeline
                      stages={allStagesForStepper}
                      activeStageId={activeView}
                      onStageClick={handleTimelineClick}
                    />
                  </div>

                  {/* Show welcome content inline on overview when no stage is drilled into and welcome not completed */}
                  {!welcomeCompleted && activeView === "welcome" && (
                    <div className="mt-4">
                      <JourneyWelcomeStage
                        hero={journey.hero}
                        projectId={projectId}
                        isAdmin={isAdmin}
                        onAdvance={handleAdvanceFromWelcome}
                        nextStageName={
                          journey.stages[0]?.name ?? "próxima etapa"
                        }
                      />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key={`mobile-detail-${mobileDetailStageId}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMobileDetailStageId(null);
                      // Reset to current active stage or welcome
                      const currentStage = welcomeCompleted
                        ? journey.stages.find(
                            (s) =>
                              s.status === "in_progress" ||
                              s.status === "waiting_action",
                          )
                        : null;
                      setActiveView(
                        currentStage?.id || journey.stages[0]?.id || "welcome",
                      );
                    }}
                    className="gap-1.5 -ml-2 mb-3 text-muted-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar às etapas
                  </Button>

                  {activeView === "welcome" ? (
                    <JourneyWelcomeStage
                      hero={journey.hero}
                      projectId={projectId}
                      isAdmin={isAdmin}
                      onAdvance={handleAdvanceFromWelcome}
                      nextStageName={journey.stages[0]?.name ?? "próxima etapa"}
                    />
                  ) : selectedStage ? (
                    <StageDetailInline
                      stage={selectedStage}
                      projectId={projectId}
                      isAdmin={isAdmin}
                      nextStageName={selectedStageNextName}
                      allStages={journey.stages}
                      onStageCompleted={() => {
                        const idx = journey.stages.findIndex(
                          (s) => s.id === selectedStage.id,
                        );
                        const next = journey.stages[idx + 1];
                        if (next)
                          setTimeout(() => handleTimelineClick(next.id), 500);
                      }}
                    />
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {activeTab === "financeiro" && (
        <Suspense fallback={<ContentSkeleton variant="table" rows={4} />}>
          <TabOnboardingTip
            tabKey="financeiro"
            message="Aqui você acompanha pagamentos, boletos e o histórico financeiro do seu projeto."
          />
          <FinanceiroContent />
        </Suspense>
      )}
      {activeTab === "documentos" && (
        <Suspense fallback={<ContentSkeleton variant="list" rows={6} />}>
          <TabOnboardingTip
            tabKey="documentos"
            message="Todos os documentos do projeto ficam organizados aqui: contratos, plantas, projetos e aditivos."
          />
          <DocumentosContent />
        </Suspense>
      )}
      {activeTab === "formalizacoes" && (
        <Suspense fallback={<ContentSkeleton variant="list" rows={4} />}>
          <TabOnboardingTip
            tabKey="formalizacoes"
            message="Formalizações registram decisões e aprovações do projeto. Cada uma pode ser assinada digitalmente."
          />
          <FormalizacoesContent />
        </Suspense>
      )}
      {activeTab === "pendencias" && (
        <Suspense fallback={<ContentSkeleton variant="list" rows={5} />}>
          <TabOnboardingTip
            tabKey="pendencias"
            message="Itens que precisam da sua atenção: aprovações, envios de documentos e decisões pendentes."
          />
          <PendenciasContent />
        </Suspense>
      )}
    </>
  );
}
