import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AppHeader } from '@/components/AppHeader';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/layout/PageContainer';
import { useClientDashboard } from '@/hooks/useClientDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardActivities } from '@/hooks/useDashboardActivities';
import { DashboardStatsCards } from '@/pages/minhas-obras/DashboardStatsCards';
import { UpcomingPaymentsCard } from '@/pages/minhas-obras/UpcomingPaymentsCard';
import { ProjectDashboardCard } from '@/pages/minhas-obras/ProjectDashboardCard';
import { NextActionsBlock } from '@/components/cockpit/NextActionsBlock';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

export default function MinhasObras() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, stats, upcomingPayments, isLoading, error } = useClientDashboard();
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const activeIds = useMemo(() => projects.filter(p => p.status === 'active').map(p => p.id), [projects]);
  const { data: activitiesMap } = useDashboardActivities(activeIds);
  const getProjectActivities = useCallback(
    (projectId: string) => (activitiesMap instanceof Map ? activitiesMap.get(projectId) : undefined),
    [activitiesMap]
  );

  const handleProjectClick = useCallback((project: ProjectSummary) => {
    sessionStorage.setItem('selectedProjectId', project.id);
    navigate(`/obra/${project.id}`);
  }, [navigate]);

  const handlePaymentClick = useCallback((projectId: string) => {
    sessionStorage.setItem('selectedProjectId', projectId);
    navigate(`/obra/${projectId}?tab=financeiro`);
  }, [navigate]);

  // Sort: active first, then by progress desc
  const sortedProjects = useMemo(() => {
    const statusOrder: Record<string, number> = { active: 0, paused: 1, completed: 2, cancelled: 3 };
    return [...projects].sort((a, b) => {
      const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return (b.progress_percentage || 0) - (a.progress_percentage || 0);
    });
  }, [projects]);

  const hasMultipleProjects = projects.length > 1;

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-primary/5 via-background to-background pb-safe">
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold">Portal do Cliente</h1>
        </div>
      </AppHeader>

      <main className="py-6">
        <PageContainer maxWidth="md">
          <div className="mb-6">
            <h2 className="text-h2 font-bold mb-1">Meu Painel</h2>
            <p className="text-caption text-muted-foreground">
              Visão geral dos seus projetos e ações pendentes
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="p-4"><div className="h-14 bg-muted animate-pulse rounded-lg" /></Card>
                ))}
              </div>
              <ContentSkeleton variant="list" rows={3} />
            </div>
          ) : error ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Erro ao carregar dados. Tente novamente.</p>
            </Card>
          ) : sortedProjects.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={displayName ? `Olá, ${displayName}! Sua jornada começa aqui.` : 'Sua jornada começa aqui'}
              description="Sua primeira obra será exibida aqui assim que nosso time iniciar o projeto. Você receberá um e-mail de confirmação com os próximos passos."
              hint="Se você já recebeu um convite por e-mail, verifique se está logado com o mesmo endereço de e-mail."
              action={{
                label: 'Falar com a equipe',
                onClick: () => window.open('mailto:contato@bwild.com.br', '_blank'),
                icon: Mail,
              }}
            />
          ) : (
            <div className="space-y-6">
              {/* Cockpit "Ação necessária" — sempre acima dos stats/projetos */}
              <ErrorBoundary name="NextActionsBlock" feature="general" fallback={null}>
                <NextActionsBlock />
              </ErrorBoundary>

              {/* Stats Cards - only show if multiple projects for a richer overview */}
              {hasMultipleProjects && <DashboardStatsCards stats={stats} />}

              {/* Main layout: projects list + sidebar */}
              <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                {/* Projects List */}
                <div className="space-y-3">
                  <h3 className="text-caption font-semibold text-muted-foreground uppercase tracking-wider">
                    {hasMultipleProjects ? 'Meus Projetos' : 'Meu Projeto'}
                  </h3>
                  {sortedProjects.map((project) => (
                    <ErrorBoundary key={project.id} name={`ProjectCard-${project.id}`} feature="general" fallback={
                      <Card className="p-4 border-destructive/20">
                        <p className="text-sm text-muted-foreground">Erro ao exibir projeto. <button className="underline text-primary" onClick={() => handleProjectClick(project)}>Abrir mesmo assim</button></p>
                      </Card>
                    }>
                      <ProjectDashboardCard
                        project={project}
                        onClick={() => handleProjectClick(project)}
                        activities={getProjectActivities(project.id)}
                      />
                    </ErrorBoundary>
                  ))}
                </div>

                {/* Sidebar: Upcoming Payments */}
                {upcomingPayments.length > 0 && (
                  <div className="space-y-3">
                    <ErrorBoundary name="UpcomingPayments" feature="general" fallback={null}>
                      <UpcomingPaymentsCard
                        payments={upcomingPayments}
                        onPaymentClick={handlePaymentClick}
                      />
                    </ErrorBoundary>
                  </div>
                )}
              </div>
            </div>
          )}
        </PageContainer>
      </main>
    </div>
  );
}
