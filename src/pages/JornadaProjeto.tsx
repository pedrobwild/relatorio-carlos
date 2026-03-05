import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Map, DollarSign, FolderOpen, ClipboardSignature, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { journeyCopy } from '@/constants/journeyCopy';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/contexts/ProjectContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProjectJourney, useInitializeJourney, JourneyStage, JourneyStageStatus } from '@/hooks/useProjectJourney';

import { JourneyTimeline } from '@/components/journey/JourneyTimeline';
import { JourneyStepperCompact } from '@/components/journey/JourneyStepperCompact';
import { JourneyTimelineSheet } from '@/components/journey/JourneyTimelineSheet';
import { JourneyFooterSection } from '@/components/journey/JourneyFooterSection';
import { JourneyWelcomeStage } from '@/components/journey/JourneyWelcomeStage';
import { StageDetailInline } from '@/components/journey/StageDetailInline';
import { JourneyProgressBar } from '@/components/journey/JourneyProgressBar';
import { PullToRefreshIndicator } from '@/components/journey/PullToRefreshIndicator';
import { TabOnboardingTip } from '@/components/journey/TabOnboardingTip';

import { PageHeader } from '@/components/layout/PageHeader';
import { useProjectLayout } from '@/components/layout/ProjectLayoutContext';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { prefetchForTab } from '@/lib/prefetch';
import { useTabKeyboardNav } from '@/hooks/useKeyboardShortcuts';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePendencias } from '@/hooks/usePendencias';


// Lazy load tab content components
const FinanceiroContent = lazy(() => import('@/components/tabs/FinanceiroContent'));
const DocumentosContent = lazy(() => import('@/components/tabs/DocumentosContent'));
const FormalizacoesContent = lazy(() => import('@/components/tabs/FormalizacoesContent'));
const PendenciasContent = lazy(() => import('@/components/tabs/PendenciasContent'));

/* ─── Helpers ─── */

function isStageBlocked(stage: JourneyStage, index: number, stages: JourneyStage[]): boolean {
  if (stage.status === 'completed' || stage.status === 'in_progress' || stage.status === 'waiting_action') return false;
  if (stage.dependencies_text) return true;
  if (index > 0 && stages[index - 1].status !== 'completed') return true;
  return false;
}

export default function JornadaProjeto() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const { project, loading: projectLoading } = useProject();
  const { role, loading: roleLoading } = useUserRole();
  const { hasShell } = useProjectLayout();
  const { data: journey, isLoading: journeyLoading, refetch } = useProjectJourney(projectId);
  const initializeJourney = useInitializeJourney();

  // Sync tab with URL query param ?tab=
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['jornada', 'financeiro', 'documentos', 'formalizacoes', 'pendencias'];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'jornada';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === 'jornada') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);
  // Derive welcomeCompleted from actual stage data — if any stage is not 'pending', welcome is done
  const welcomeKey = projectId ? `journey_welcome_${projectId}` : '';
  // Welcome is only "done" when at least one stage has progressed beyond 'pending'
  const hasRealProgress = journey?.stages?.some(s => s.status !== 'pending') ?? false;
  const [welcomeCompleted, setWelcomeCompleted] = useState(() => {
    if (welcomeKey && localStorage.getItem(welcomeKey)) return true;
    return false;
  });

  // Determine initial active view: go to current stage if welcome is done
  const [activeView, setActiveView] = useState<string>('welcome');
  const [timelineSheetOpen, setTimelineSheetOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasAutoNavigated = useRef(false);

  // Sync welcomeCompleted when journey data loads & auto-navigate to current stage
  useEffect(() => {
    if (hasRealProgress && !welcomeCompleted) {
      setWelcomeCompleted(true);
      if (welcomeKey) localStorage.setItem(welcomeKey, '1');
    }
    // Auto-navigate to the current active stage once
    if (hasRealProgress && journey?.stages && !hasAutoNavigated.current) {
      hasAutoNavigated.current = true;
      const currentStage = journey.stages.find(s => s.status === 'in_progress' || s.status === 'waiting_action')
        || journey.stages.find(s => s.status !== 'completed' && s.status !== 'pending');
      if (currentStage) {
        setActiveView(currentStage.id);
      }
    }
  }, [hasRealProgress, welcomeCompleted, welcomeKey, journey?.stages]);

  const isMobile = useIsMobile();
  const isAdmin = role === 'admin' || role === 'manager' || role === 'engineer';
  const isLoading = projectLoading || roleLoading || journeyLoading;

  // Pending items count for badge
  const { stats: pendingStats } = usePendencias({ projectId });

  // Keyboard shortcuts: Arrow Left/Right to switch tabs
  const TABS = useMemo(() => ['jornada', 'financeiro', 'documentos', 'formalizacoes', 'pendencias'], []);
  useTabKeyboardNav(TABS, activeTab, handleTabChange);

  // Pull-to-refresh on mobile
  const { pulling, refreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => { await refetch(); },
    enabled: isMobile && activeTab === 'jornada',
  });

  // Initialize journey if not exists
  useEffect(() => {
    if (!journeyLoading && journey && !journey.hero && projectId) {
      initializeJourney.mutate(projectId, {
        onSuccess: () => refetch(),
      });
    }
  }, [journeyLoading, journey, projectId, initializeJourney, refetch]);

  // Build stages list with virtual welcome stage
  const welcomeVirtualStage = {
    id: 'welcome',
    project_id: projectId || '',
    sort_order: 0,
    name: 'Boas-vindas',
    icon: 'users',
    status: (welcomeCompleted ? 'completed' : 'in_progress') as JourneyStageStatus,
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
  };

  const adjustedStages = journey?.stages
    ? journey.stages.map(s => (welcomeCompleted || hasRealProgress) ? s : { ...s, status: 'pending' as JourneyStageStatus })
    : [];

  const allStagesForStepper = journey?.stages ? [welcomeVirtualStage, ...adjustedStages] : [];

  const selectedStage = useMemo(() => {
    if (activeView === 'welcome' || !journey?.stages) return null;
    return journey.stages.find(s => s.id === activeView) || null;
  }, [activeView, journey?.stages]);

  const selectedStageNextName = useMemo(() => {
    if (!selectedStage || !journey?.stages) return null;
    const idx = journey.stages.findIndex(s => s.id === selectedStage.id);
    return journey.stages[idx + 1]?.name ?? null;
  }, [selectedStage, journey?.stages]);

  const handleTimelineClick = useCallback((stageId: string) => {
    if (stageId === 'welcome') {
      setActiveView('welcome');
      return;
    }
    if (!welcomeCompleted && !isAdmin) return;
    if (!isAdmin && journey?.stages) {
      const idx = journey.stages.findIndex(s => s.id === stageId);
      if (idx >= 0 && isStageBlocked(journey.stages[idx], idx, journey.stages)) return;
    }
    setActiveView(stageId);
    // Scroll to content area smoothly
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [journey?.stages, welcomeCompleted, isAdmin]);

  const handleAdvanceFromWelcome = useCallback(() => {
    setWelcomeCompleted(true);
    if (welcomeKey) localStorage.setItem(welcomeKey, '1');
    if (journey?.stages && journey.stages.length > 0) {
      setActiveView(journey.stages[0].id);
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [journey?.stages, welcomeKey]);

  // Welcome toast — once per project
  useEffect(() => {
    if (!project || !projectId) return;
    const key = `welcome_toast_${projectId}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    toast(`Bem-vindo ao portal, ${project.customer_name?.split(' ')[0] || ''}! 👋`, {
      description: 'Acompanhe cada etapa do seu projeto aqui.',
      duration: 5000,
    });
  }, [project, projectId]);

  if (isLoading || initializeJourney.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{journeyCopy.loading.notFound}</p>
      </div>
    );
  }

  if (!journey?.hero || !journey.stages.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{journeyCopy.loading.initializing}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
      {/* Header — compact: project name inline, meta collapsed */}
      <PageHeader
        title={journeyCopy.page.title}
        backTo="/minhas-obras"
      >
        <div className="text-right min-w-0">
          <p className="font-medium text-sm truncate">{project.name}</p>
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
            {project.unit_name && (
              <span className="text-xs text-muted-foreground">{project.unit_name}</span>
            )}
            {project.customer_name && (
              <span className="text-xs text-muted-foreground hidden sm:inline">• {project.customer_name}</span>
            )}
          </div>
        </div>
      </PageHeader>

      {/* Tabs bar — horizontal scroll, 44px touch targets (hidden when staff sidebar is active) */}
      {!hasShell && (
      <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="px-3 sm:px-6 md:px-8 overflow-x-auto scrollbar-hide">
              <TabsList className="bg-transparent h-auto p-0 gap-0 w-full whitespace-nowrap" aria-label="Navegação do projeto">
                <TabsTrigger value="jornada" className="portal-tab-trigger">
                  <Map className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <span className="hidden sm:inline">{journeyCopy.tabs.jornada}</span>
                  <span className="sm:hidden">Jornada</span>
                </TabsTrigger>
                <TabsTrigger value="financeiro" className="portal-tab-trigger"
                  onMouseEnter={() => prefetchForTab('financeiro', projectId)}
                  onFocus={() => prefetchForTab('financeiro', projectId)}>
                  <DollarSign className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <span className="hidden sm:inline">{journeyCopy.tabs.financeiro}</span>
                  <span className="sm:hidden">Financeiro</span>
                </TabsTrigger>
                <TabsTrigger value="documentos" className="portal-tab-trigger"
                  onMouseEnter={() => prefetchForTab('documentos', projectId)}
                  onFocus={() => prefetchForTab('documentos', projectId)}>
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <span className="hidden sm:inline">{journeyCopy.tabs.documentos}</span>
                  <span className="sm:hidden">Docs</span>
                </TabsTrigger>
                <TabsTrigger value="formalizacoes" className="portal-tab-trigger"
                  onMouseEnter={() => prefetchForTab('formalizacoes', projectId)}
                  onFocus={() => prefetchForTab('formalizacoes', projectId)}>
                  <ClipboardSignature className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <span className="hidden sm:inline">{journeyCopy.tabs.formalizacoes}</span>
                  <span className="sm:hidden">Formal.</span>
                </TabsTrigger>
                <TabsTrigger value="pendencias" className="portal-tab-trigger relative"
                  onMouseEnter={() => prefetchForTab('pendencias', projectId)}
                  onFocus={() => prefetchForTab('pendencias', projectId)}>
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <span className="hidden sm:inline">{journeyCopy.tabs.pendencias}</span>
                  <span className="sm:hidden">Pendências</span>
                  {pendingStats.total > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums">
                      {pendingStats.total > 99 ? '99+' : pendingStats.total}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      </div>
      )}

      <main
        className={cn(
          "max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-4 md:py-8 w-full overflow-x-hidden",
          'pb-safe',
        )}
        role="region"
        aria-label={`Conteúdo da aba ${activeTab === 'jornada' ? 'Jornada' : activeTab === 'financeiro' ? 'Financeiro' : activeTab === 'documentos' ? 'Documentos' : activeTab === 'formalizacoes' ? 'Formalizações' : 'Pendências'}`}
      >
        <PullToRefreshIndicator
          pulling={pulling}
          refreshing={refreshing}
          pullDistance={pullDistance}
          threshold={threshold}
        />

        {/* Breadcrumb contextual */}
        {activeTab !== 'jornada' && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <button
              onClick={() => handleTabChange('jornada')}
              className="hover:text-foreground transition-colors"
            >
              {project.name}
            </button>
            <span>›</span>
            <span className="text-foreground font-medium">
              {activeTab === 'financeiro' ? 'Financeiro'
                : activeTab === 'documentos' ? 'Documentos'
                : activeTab === 'formalizacoes' ? 'Formalizações'
                : 'Pendências'}
            </span>
          </div>
        )}

        {/* Jornada tab content */}
        {activeTab === 'jornada' && (
          <div className="grid gap-4 md:gap-8 lg:grid-cols-[280px_1fr]">
            {/* Sidebar with Timeline (desktop only) */}
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
              </div>
            </aside>

            {/* Main content */}
            <div ref={contentRef} className="space-y-4 md:space-y-8 min-w-0">

              {/* Global progress indicator — disabled */}

              {/* Mobile Stepper Compact */}
              <JourneyStepperCompact
                stages={allStagesForStepper}
                activeStageId={activeView}
                onOpenTimeline={() => setTimelineSheetOpen(true)}
                onStageClick={handleTimelineClick}
              />

              {/* Mobile Timeline Sheet */}
              <JourneyTimelineSheet
                open={timelineSheetOpen}
                onOpenChange={setTimelineSheetOpen}
                stages={allStagesForStepper}
                activeStageId={activeView}
                onStageClick={handleTimelineClick}
              />

              {/* Content area — switches based on activeView with transitions */}
              <AnimatePresence mode="wait">
                {activeView === 'welcome' ? (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <JourneyWelcomeStage
                      hero={journey.hero}
                      projectId={projectId!}
                      isAdmin={isAdmin}
                      onAdvance={handleAdvanceFromWelcome}
                      nextStageName={journey.stages[0]?.name ?? 'próxima etapa'}
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
                      projectId={projectId!}
                      isAdmin={isAdmin}
                      nextStageName={selectedStageNextName}
                      allStages={journey.stages}
                      onStageCompleted={() => {
                        // Navigate to the next stage after completing current
                        const idx = journey.stages.findIndex(s => s.id === selectedStage.id);
                        const next = journey.stages[idx + 1];
                        if (next) {
                          setTimeout(() => {
                            handleTimelineClick(next.id);
                          }, 500);
                        }
                      }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <Separator />
            </div>
          </div>
        )}

        {/* Other tabs with onboarding tips */}
        {activeTab === 'financeiro' && (
          <Suspense fallback={<ContentSkeleton variant="table" rows={4} />}>
            <TabOnboardingTip
              tabKey="financeiro"
              message="Aqui você acompanha pagamentos, boletos e o histórico financeiro do seu projeto."
            />
            <FinanceiroContent />
          </Suspense>
        )}

        {activeTab === 'documentos' && (
          <Suspense fallback={<ContentSkeleton variant="list" rows={6} />}>
            <TabOnboardingTip
              tabKey="documentos"
              message="Todos os documentos do projeto ficam organizados aqui: contratos, plantas, projetos e aditivos."
            />
            <DocumentosContent />
          </Suspense>
        )}

        {activeTab === 'formalizacoes' && (
          <Suspense fallback={<ContentSkeleton variant="list" rows={4} />}>
            <TabOnboardingTip
              tabKey="formalizacoes"
              message="Formalizações registram decisões e aprovações do projeto. Cada uma pode ser assinada digitalmente."
            />
            <FormalizacoesContent />
          </Suspense>
        )}

        {activeTab === 'pendencias' && (
          <Suspense fallback={<ContentSkeleton variant="list" rows={5} />}>
            <TabOnboardingTip
              tabKey="pendencias"
              message="Itens que precisam da sua atenção: aprovações, envios de documentos e decisões pendentes."
            />
            <PendenciasContent />
          </Suspense>
        )}
      </main>
    </div>
  );
}
