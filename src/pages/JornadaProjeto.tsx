import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { journeyCopy } from '@/constants/journeyCopy';
import { cn } from '@/lib/utils';
import { useProject } from '@/contexts/ProjectContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProjectJourney, useInitializeJourney } from '@/hooks/useProjectJourney';
import { PageHeader } from '@/components/layout/PageHeader';
import { useProjectLayout } from '@/components/layout/ProjectLayoutContext';
import { useTabKeyboardNav } from '@/hooks/useKeyboardShortcuts';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePendencias } from '@/hooks/usePendencias';
import { JornadaTabsBar } from './jornada/JornadaTabsBar';
import { JornadaTabContent } from './jornada/JornadaTabContent';
import { MobileNavDrawer } from './jornada/MobileNavDrawer';
import { ProjectPhaseCompletionBanner } from '@/components/journey/ProjectPhaseCompletionBanner';

export default function JornadaProjeto() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project, loading: projectLoading } = useProject();
  const { role, loading: roleLoading } = useUserRole();
  const { hasShell } = useProjectLayout();
  const { data: journey, isLoading: journeyLoading, refetch } = useProjectJourney(projectId);
  const initializeJourney = useInitializeJourney();

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

  const welcomeKey = projectId ? `journey_welcome_${projectId}` : '';
  const hasRealProgress = journey?.stages?.some(s => s.status === 'completed' || s.status === 'waiting_action') ?? false;
  const [welcomeCompleted, setWelcomeCompleted] = useState(() => {
    if (welcomeKey && localStorage.getItem(welcomeKey)) return true;
    return false;
  });

  useEffect(() => {
    if (hasRealProgress && !welcomeCompleted) {
      setWelcomeCompleted(true);
      if (welcomeKey) localStorage.setItem(welcomeKey, '1');
    }
  }, [hasRealProgress, welcomeCompleted, welcomeKey]);

  const isMobile = useIsMobile();
  const isAdmin = role === 'admin' || role === 'manager' || role === 'engineer';
  const isLoading = projectLoading || roleLoading || journeyLoading;

  const { stats: pendingStats } = usePendencias({ projectId });
  const TABS = useMemo(() => validTabs, []);
  useTabKeyboardNav(TABS, activeTab, handleTabChange);

  const { pulling, refreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => { await refetch(); },
    enabled: isMobile && activeTab === 'jornada',
  });

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    if (!journeyLoading && journey && !journey.hero && projectId && !initializeJourney.isPending) {
      initRef.current = true;
      initializeJourney.mutate(projectId, { onSuccess: () => refetch() });
    }
  }, [journeyLoading, journey, projectId, initializeJourney, refetch]);

  // Reset guard when projectId changes
  useEffect(() => {
    initRef.current = false;
  }, [projectId]);

  // Welcome toast
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
      <PageHeader title={journeyCopy.page.title} backTo="/minhas-obras">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-right min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{project.name}</p>
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
              {project.unit_name && <span className="text-xs text-muted-foreground">{project.unit_name}</span>}
              {project.customer_name && <span className="text-xs text-muted-foreground hidden sm:inline">• {project.customer_name}</span>}
            </div>
          </div>
          {isMobile && (
            <MobileNavDrawer
              activeTab={activeTab}
              onTabChange={handleTabChange}
              pendingCount={pendingStats.total}
            />
          )}
        </div>
      </PageHeader>

      {!hasShell && !isMobile && (
        <JornadaTabsBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          projectId={projectId}
          pendingCount={pendingStats.total}
        />
      )}

      <main
        className={cn('max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-4 md:py-8 w-full overflow-x-hidden', 'pb-safe')}
        role="region"
        aria-label={`Conteúdo da aba ${activeTab === 'jornada' ? 'Jornada' : activeTab === 'financeiro' ? 'Financeiro' : activeTab === 'documentos' ? 'Documentos' : activeTab === 'formalizacoes' ? 'Formalizações' : 'Pendências'}`}
      >
        {activeTab === 'jornada' && (
          <ProjectPhaseCompletionBanner
            projectId={projectId!}
            projectName={project.name}
            isProjectPhase={!!project.is_project_phase}
            stages={journey.stages}
            isStaff={isAdmin}
          />
        )}
        <JornadaTabContent
          activeTab={activeTab}
          handleTabChange={handleTabChange}
          projectId={projectId!}
          projectName={project.name}
          isAdmin={isAdmin}
          journey={journey}
          welcomeCompleted={welcomeCompleted}
          setWelcomeCompleted={setWelcomeCompleted}
          welcomeKey={welcomeKey}
          hasRealProgress={hasRealProgress}
          pulling={pulling}
          refreshing={refreshing}
          pullDistance={pullDistance}
          threshold={threshold}
        />
      </main>
    </div>
  );
}
