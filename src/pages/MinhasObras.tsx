import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Calendar, ChevronRight, FileCode } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppHeader } from '@/components/AppHeader';
import { useProjectsQuery } from '@/hooks/useProjectsQuery';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ProjectWithCustomer } from '@/infra/repositories';

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-500/20',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  paused: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const statusLabels: Record<string, string> = {
  active: 'Em andamento',
  completed: 'Concluída',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

function ProjectCard({ project, onClick }: { project: ProjectWithCustomer & { is_project_phase?: boolean }; onClick: () => void }) {
  const startDate = new Date(project.actual_start_date || project.planned_start_date);
  const endDate = new Date(project.planned_end_date);
  const now = Date.now();
  const hasStarted = now >= startDate.getTime();

  // Dias restantes só contam a partir da data de início oficial
  const daysRemaining = useMemo(() => {
    if (!hasStarted) return null; // Ainda não começou
    return Math.ceil((endDate.getTime() - now) / (1000 * 60 * 60 * 24));
  }, [hasStarted, endDate, now]);

  const progress = useMemo(() => {
    if (!hasStarted) return 0;
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = now - startDate.getTime();
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [hasStarted, startDate, endDate, now]);

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-body font-semibold group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.unit_name && (
              <p className="text-caption text-muted-foreground">{project.unit_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusColors[project.status]}>
              {statusLabels[project.status]}
            </Badge>
            {project.is_project_phase && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                <FileCode className="h-3 w-3 mr-1" />
                Fase de Projeto
              </Badge>
            )}
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>

        <div className="flex items-center gap-2 text-caption text-muted-foreground mb-3">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {format(new Date(project.planned_start_date), 'dd/MM/yy', { locale: ptBR })} - {' '}
            {format(new Date(project.planned_end_date), 'dd/MM/yy', { locale: ptBR })}
          </span>
        </div>

        {project.status === 'active' && !project.is_project_phase && (
          <>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-tiny text-muted-foreground">
              <span>{Math.round(progress)}% concluído</span>
              {daysRemaining !== null && daysRemaining > 0 && <span>{daysRemaining} dias restantes</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function MinhasObras() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading: loading, error } = useProjectsQuery();

  const handleProjectClick = useCallback((projectId: string) => {
    sessionStorage.setItem('selectedProjectId', projectId);
    navigate(`/obra/${projectId}`);
  }, [navigate]);

  return (
    <div className="min-h-screen min-h-[100dvh] max-h-[100dvh] overflow-y-auto overflow-x-hidden bg-gradient-to-b from-primary/5 via-background to-background pb-safe"> 
      {/* Header */}
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold">Portal do Cliente</h1>
        </div>
      </AppHeader>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-h2 font-bold mb-1">Minhas Obras</h2>
          <p className="text-caption text-muted-foreground">
            Selecione uma obra para acompanhar o progresso
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="h-32 animate-pulse bg-muted" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Erro ao carregar obras: {String(error)}</p>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-body font-semibold mb-2">Nenhuma obra encontrada</h3>
            <p className="text-caption text-muted-foreground">
              Você ainda não possui obras vinculadas ao seu cadastro.
              Entre em contato com a equipe Bwild.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
