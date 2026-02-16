import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Map, DollarSign, FolderOpen, ClipboardSignature, AlertCircle } from 'lucide-react';
import { journeyCopy } from '@/constants/journeyCopy';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/contexts/ProjectContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProjectJourney, useInitializeJourney, JourneyStage } from '@/hooks/useProjectJourney';

import { JourneyTimeline } from '@/components/journey/JourneyTimeline';
import { JourneyMobileStepper } from '@/components/journey/JourneyMobileStepper';
import { JourneyStageCard } from '@/components/journey/JourneyStageCard';
import { JourneyFooterSection } from '@/components/journey/JourneyFooterSection';
import { JourneyWelcomeStage } from '@/components/journey/JourneyWelcomeStage';

import { StageDetailSheet } from '@/components/journey/StageDetailSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentSkeleton } from '@/components/ContentSkeleton';


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

  const { project, loading: projectLoading } = useProject();
  const { role, loading: roleLoading } = useUserRole();
  const { data: journey, isLoading: journeyLoading, refetch } = useProjectJourney(projectId);
  const initializeJourney = useInitializeJourney();

  const [activeTab, setActiveTab] = useState<string>('jornada');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isAdmin = role === 'admin' || role === 'manager' || role === 'engineer';
  const isLoading = projectLoading || roleLoading || journeyLoading;

  // Initialize journey if not exists
  useEffect(() => {
    if (!journeyLoading && journey && !journey.hero && projectId) {
      initializeJourney.mutate(projectId, {
        onSuccess: () => refetch(),
      });
    }
  }, [journeyLoading, journey, projectId, initializeJourney, refetch]);

  // Build stages list with virtual welcome stage for stepper/timeline
  const welcomeVirtualStage = {
    id: 'welcome',
    project_id: projectId || '',
    sort_order: 0,
    name: 'Boas-vindas',
    icon: 'users',
    status: 'in_progress' as const,
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

  const allStagesForStepper = journey?.stages ? [welcomeVirtualStage, ...journey.stages] : [];

  const selectedStage = useMemo(() => {
    if (!selectedStageId || !journey?.stages) return null;
    return journey.stages.find(s => s.id === selectedStageId) || null;
  }, [selectedStageId, journey?.stages]);

  const selectedStageNextName = useMemo(() => {
    if (!selectedStage || !journey?.stages) return null;
    const idx = journey.stages.findIndex(s => s.id === selectedStage.id);
    return journey.stages[idx + 1]?.name ?? null;
  }, [selectedStage, journey?.stages]);

  const handleStageSelect = useCallback((stageId: string) => {
    if (stageId === 'welcome') {
      // Welcome stage opens inline, not in sheet
      return;
    }
    setSelectedStageId(stageId);
    setSheetOpen(true);
  }, []);

  const handleTimelineClick = useCallback((stageId: string) => {
    if (stageId === 'welcome') return;
    // Check if stage is blocked
    if (journey?.stages) {
      const idx = journey.stages.findIndex(s => s.id === stageId);
      if (idx >= 0 && isStageBlocked(journey.stages[idx], idx, journey.stages)) return;
    }
    handleStageSelect(stageId);
  }, [journey?.stages, handleStageSelect]);

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
      {/* Header */}
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
              <span className="text-xs text-muted-foreground">• {project.customer_name}</span>
            )}
          </div>
          {((project as any).address || (project as any).bairro || (project as any).cep) && (
            <p className="text-xs text-muted-foreground truncate">
              {[(project as any).address, (project as any).bairro, (project as any).cep].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </PageHeader>

      {/* Tabs bar */}
      <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-4 sm:px-6 md:px-8">
              <TabsList className="bg-transparent h-auto p-0 gap-0 w-full overflow-x-auto scrollbar-hide">
                <TabsTrigger value="jornada" className="portal-tab-trigger">
                  <Map className="w-3.5 h-3.5 mr-1.5" />
                  {journeyCopy.tabs.jornada}
                </TabsTrigger>
                <TabsTrigger value="financeiro" className="portal-tab-trigger">
                  <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                  {journeyCopy.tabs.financeiro}
                </TabsTrigger>
                <TabsTrigger value="documentos" className="portal-tab-trigger">
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                  {journeyCopy.tabs.documentos}
                </TabsTrigger>
                <TabsTrigger value="formalizacoes" className="portal-tab-trigger">
                  <ClipboardSignature className="w-3.5 h-3.5 mr-1.5" />
                  {journeyCopy.tabs.formalizacoes}
                </TabsTrigger>
                <TabsTrigger value="pendencias" className="portal-tab-trigger">
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                  {journeyCopy.tabs.pendencias}
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      </div>

      <main className={cn(
        "container max-w-5xl mx-auto px-4 py-5 md:py-8",
        'pb-safe',
      )}>
        {/* Jornada tab content */}
        {activeTab === 'jornada' && (
          <div className="grid gap-6 md:gap-8 lg:grid-cols-[280px_1fr]">
            {/* Sidebar with Timeline (desktop only) */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground mb-4">
                    {journeyCopy.page.sidebarTitle}
                  </h2>
                  <JourneyTimeline
                    stages={allStagesForStepper}
                    activeStageId={selectedStageId}
                    onStageClick={handleTimelineClick}
                  />
                </div>
              </div>
            </aside>

            {/* Main content */}
            <div className="space-y-5 md:space-y-8">

              {/* Mobile Stepper */}
              <JourneyMobileStepper
                stages={allStagesForStepper}
                activeStageId={selectedStageId}
                onStageClick={handleTimelineClick}
              />


              {/* Welcome Stage (Stage 0) — always visible inline */}
              <JourneyWelcomeStage
                hero={journey.hero}
                projectId={projectId!}
                isAdmin={isAdmin}
              />

              {/* Stage Cards */}
              <div className="space-y-3 md:space-y-4">
                {journey.stages.map((stage, idx) => (
                  <JourneyStageCard
                    key={stage.id}
                    stage={stage}
                    isActive={selectedStageId === stage.id && sheetOpen}
                    isBlocked={isStageBlocked(stage, idx, journey.stages)}
                    onSelect={() => handleStageSelect(stage.id)}
                    nextStageName={journey.stages[idx + 1]?.name ?? null}
                  />
                ))}
              </div>

              <Separator />

              {/* Footer */}
              {journey.footer && (
                <JourneyFooterSection
                  footer={journey.footer}
                  projectId={projectId!}
                  isAdmin={isAdmin}
                />
              )}
            </div>
          </div>
        )}

        {/* Other tabs */}
        {activeTab === 'financeiro' && (
          <Suspense fallback={<ContentSkeleton variant="cards" rows={3} />}>
            <FinanceiroContent />
          </Suspense>
        )}

        {activeTab === 'documentos' && (
          <Suspense fallback={<ContentSkeleton variant="cards" rows={6} />}>
            <DocumentosContent />
          </Suspense>
        )}

        {activeTab === 'formalizacoes' && (
          <Suspense fallback={<ContentSkeleton variant="cards" rows={4} />}>
            <FormalizacoesContent />
          </Suspense>
        )}

        {activeTab === 'pendencias' && (
          <Suspense fallback={<ContentSkeleton variant="list" rows={5} />}>
            <PendenciasContent />
          </Suspense>
        )}
      </main>

      {/* Stage Detail Sheet */}
      <StageDetailSheet
        stage={selectedStage}
        projectId={projectId!}
        isAdmin={isAdmin}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        nextStageName={selectedStageNextName}
      />

    </div>
  );
}
