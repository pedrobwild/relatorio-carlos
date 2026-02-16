import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AppHeader } from '@/components/AppHeader';
import { useProjectsQuery } from '@/hooks/useProjectsQuery';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/layout/PageContainer';
import { ProjectCardSummary } from '@/components/ProjectCardSummary';
import type { ProjectWithCustomer } from '@/infra/repositories';

type ProjectData = ProjectWithCustomer & { is_project_phase?: boolean };

export default function MinhasObras() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading: loading, error } = useProjectsQuery();

  const handleProjectClick = useCallback((project: ProjectData) => {
    sessionStorage.setItem('selectedProjectId', project.id);
    if (project.is_project_phase) {
      navigate(`/obra/${project.id}/jornada`);
    } else {
      navigate(`/obra/${project.id}`);
    }
  }, [navigate]);

  // Soft sort: active first, then completed, then rest
  const sortedProjects = useMemo(() => {
    const statusOrder: Record<string, number> = { active: 0, paused: 1, completed: 2, cancelled: 3 };
    return [...projects].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  }, [projects]);

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-primary/5 via-background to-background pb-safe">
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold">Portal do Cliente</h1>
        </div>
      </AppHeader>

      <main className="py-6">
        <PageContainer maxWidth="sm">
          <div className="mb-6">
            <h2 className="text-h2 font-bold mb-1">Minhas Obras</h2>
            <p className="text-caption text-muted-foreground">
              Selecione uma obra para acompanhar o progresso
            </p>
          </div>

          {loading ? (
            <ContentSkeleton variant="list" rows={3} />
          ) : error ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Erro ao carregar obras. Tente novamente.</p>
            </Card>
          ) : sortedProjects.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nenhuma obra encontrada"
              description="Você ainda não possui obras vinculadas ao seu cadastro. Entre em contato com a equipe Bwild."
            />
          ) : (
            <div className="space-y-3" data-testid="obras-list">
              {sortedProjects.map((project) => (
                <ProjectCardSummary
                  key={project.id}
                  project={project}
                  onClick={() => handleProjectClick(project)}
                />
              ))}
            </div>
          )}
        </PageContainer>
      </main>
    </div>
  );
}
