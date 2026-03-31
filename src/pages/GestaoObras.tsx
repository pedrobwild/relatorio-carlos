import { useState, useCallback, useMemo, useEffect } from 'react';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Building2, Calendar, User, Search, Settings, Copy, Users, LayoutGrid, List, HardHat, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppHeader } from '@/components/AppHeader';
import { useProjectsQuery } from '@/hooks/useProjectsQuery';
import { DuplicateProjectModal } from '@/components/DuplicateProjectModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/activityStatus';
import type { ProjectWithCustomer } from '@/infra/repositories';
import { ProjectsListView } from '@/components/gestao/ProjectsListView';
import { ProjectsListViewProjetos } from '@/components/gestao/ProjectsListViewProjetos';

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

function ProjectCard({ 
  project, 
  onClick, 
  onEdit,
  onDuplicate 
}: { 
  project: ProjectWithCustomer; 
  onClick: () => void; 
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const daysRemaining = useMemo(() => {
    if (!project.planned_end_date) return null;
    return Math.ceil(
      (new Date(project.planned_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }, [project.planned_end_date]);

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
      onClick={onClick}
    >
      <CardHeader className="p-3 md:p-4 pb-0 md:pb-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-body font-semibold truncate">{project.name}</CardTitle>
            {project.unit_name && (
              <p className="text-caption text-muted-foreground truncate">{project.unit_name}</p>
            )}
          </div>
          <Badge variant="outline" className={`${statusColors[project.status]} shrink-0 whitespace-nowrap text-[10px] md:text-xs`}>
            {statusLabels[project.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-2 md:pt-2 space-y-2">
        {project.customer_name && (
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{project.customer_name}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span className="tabular-nums">
            {(project.planned_start_date || project.planned_end_date) ? (
              <>
                {project.planned_start_date 
                  ? format(parseLocalDate(project.planned_start_date), 'dd/MM/yy', { locale: ptBR }) 
                  : 'A definir'} – {project.planned_end_date 
                  ? format(parseLocalDate(project.planned_end_date), 'dd/MM/yy', { locale: ptBR }) 
                  : 'A definir'}
              </>
            ) : 'Datas em definição'}
          </span>
        </div>

        {/* Actions row + days remaining */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 min-h-[36px]"
              title="Duplicar obra"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 min-h-[36px]"
              title="Editar obra"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          {project.status === 'active' && daysRemaining !== null && daysRemaining > 0 && (
            <p className="text-tiny text-muted-foreground">
              <span className="font-medium text-foreground">{daysRemaining}</span>d restantes
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function GestaoObras() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: projects = [], isLoading: loading, error, refetch } = useProjectsQuery();

  // Persist filters in URL search params
  const searchTerm = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || null;
  const phaseFilter = (searchParams.get('phase') as 'all' | 'project' | 'execution') || 'execution';
  const engineerFilter = searchParams.get('engineer') || null;

  const setSearchTerm = useCallback((value: string) => {
    setSearchParams(prev => {
      if (value) prev.set('q', value); else prev.delete('q');
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const setStatusFilter = useCallback((value: string | null) => {
    setSearchParams(prev => {
      if (value) prev.set('status', value); else prev.delete('status');
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const setPhaseFilter = useCallback((value: 'all' | 'project' | 'execution') => {
    setSearchParams(prev => {
      if (value !== 'all') prev.set('phase', value); else prev.delete('phase');
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const setEngineerFilter = useCallback((value: string | null) => {
    setSearchParams(prev => {
      if (value) prev.set('engineer', value); else prev.delete('engineer');
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithCustomer | null>(null);

  // View mode: persist in localStorage
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    return (localStorage.getItem('gestao-view-mode') as 'cards' | 'list') || 'cards';
  });
  const toggleViewMode = useCallback((mode: 'cards' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('gestao-view-mode', mode);
  }, []);

  const handleProjectClick = useCallback((projectId: string) => {
    navigate(`/obra/${projectId}`);
  }, [navigate]);

  const handleProjectEdit = useCallback((projectId: string) => {
    navigate(`/gestao/obra/${projectId}`);
  }, [navigate]);

  const handleDuplicateProject = useCallback((project: ProjectWithCustomer) => {
    setSelectedProject(project);
    setDuplicateModalOpen(true);
  }, []);

  // Extract unique engineers for filter buttons
  const engineers = useMemo(() => {
    const engineerMap = new Map<string, string>();
    projects.forEach(p => {
      if (p.engineer_user_id && p.engineer_name) {
        engineerMap.set(p.engineer_user_id, p.engineer_name);
      }
    });
    return Array.from(engineerMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filteredProjects = useMemo(() => projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unit_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || p.status === statusFilter;
    const matchesEngineer = !engineerFilter || p.engineer_user_id === engineerFilter;
    const matchesPhase = phaseFilter === 'all' || 
      (phaseFilter === 'project' && p.is_project_phase) || 
      (phaseFilter === 'execution' && !p.is_project_phase);
    return matchesSearch && matchesStatus && matchesEngineer && matchesPhase;
  }), [projects, searchTerm, statusFilter, engineerFilter, phaseFilter]);

  const { activeCount, completedCount } = useMemo(() => ({
    activeCount: projects.filter(p => p.status === 'active').length,
    completedCount: projects.filter(p => p.status === 'completed').length,
  }), [projects]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold">Gestão de Obras</h1>
        </div>
      </AppHeader>

      <main className={`mx-auto px-4 py-4 md:py-6 ${viewMode === 'list' ? 'max-w-[1400px]' : 'max-w-6xl'}`}>
        {/* Stats + Action row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 md:gap-4 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-card-value">{projects.length}</span>
              <span className="text-tiny uppercase tracking-wider">Total</span>
            </div>
            <div className="w-px h-6 bg-border shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-card-value text-success">{activeCount}</span>
              <span className="text-tiny uppercase tracking-wider">Ativas</span>
            </div>
            <div className="w-px h-6 bg-border shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-card-value text-primary">{completedCount}</span>
              <span className="text-tiny uppercase tracking-wider">Concluídas</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {/* View toggle */}
            <div className="hidden md:flex items-center border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-none px-2"
                onClick={() => toggleViewMode('cards')}
                title="Visualização em cards"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-none px-2"
                onClick={() => toggleViewMode('list')}
                title="Visualização em lista"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/gestao/calendario-compras')}>
              <span className="hidden sm:inline">Calendário Compras</span>
              <span className="sm:hidden">Compras</span>
            </Button>
            <Button onClick={() => navigate('/gestao/nova-obra')} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Nova Obra</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cliente ou unidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters — horizontal scroll on mobile */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          {/* Primary: Obras vs Projetos toggle */}
          <div className="flex items-center border rounded-md overflow-hidden shrink-0 mr-2">
            <Button
              variant={phaseFilter !== 'project' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 min-h-[32px] text-xs rounded-none gap-1.5"
              onClick={() => setPhaseFilter('execution')}
            >
              <HardHat className="h-3.5 w-3.5" />
              Obras
            </Button>
            <Button
              variant={phaseFilter === 'project' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 min-h-[32px] text-xs rounded-none gap-1.5"
              onClick={() => setPhaseFilter('project')}
            >
              <Compass className="h-3.5 w-3.5" />
              Projetos
            </Button>
          </div>
          <div className="w-px h-7 bg-border shrink-0 self-center" />
          <Button variant={statusFilter === null ? 'default' : 'outline'} size="sm" className="shrink-0 h-8 min-h-[32px] text-xs" onClick={() => setStatusFilter(null)}>
            Todas
          </Button>
          <Button variant={statusFilter === 'active' ? 'default' : 'outline'} size="sm" className="shrink-0 h-8 min-h-[32px] text-xs" onClick={() => setStatusFilter('active')}>
            Ativas
          </Button>
          <Button variant={statusFilter === 'paused' ? 'default' : 'outline'} size="sm" className="shrink-0 h-8 min-h-[32px] text-xs" onClick={() => setStatusFilter('paused')}>
            Pausadas
          </Button>
          <Button variant={statusFilter === 'completed' ? 'default' : 'outline'} size="sm" className="shrink-0 h-8 min-h-[32px] text-xs" onClick={() => setStatusFilter('completed')}>
            Concluídas
          </Button>
          <Button variant={statusFilter === 'cancelled' ? 'default' : 'outline'} size="sm" className="shrink-0 h-8 min-h-[32px] text-xs" onClick={() => setStatusFilter('cancelled')}>
            Canceladas
          </Button>
        </div>

        {/* Engineer Filter — compact pills */}
        {engineers.length > 0 && (
          <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex items-center gap-1.5 mr-1 shrink-0">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Eng:</span>
            </div>
            <Button variant={engineerFilter === null ? 'default' : 'outline'} size="sm" className="shrink-0 h-7 min-h-[28px] text-xs px-2.5" onClick={() => setEngineerFilter(null)}>
              Todos
            </Button>
            {engineers.map(engineer => (
              <Button
                key={engineer.id}
                variant={engineerFilter === engineer.id ? 'default' : 'outline'}
                size="sm"
                className="shrink-0 h-7 min-h-[28px] text-xs px-2.5"
                onClick={() => setEngineerFilter(engineer.id)}
              >
                {engineer.name.split(' ')[0]}
              </Button>
            ))}
          </div>
        )}

        {/* Projects Grid */}
        {loading ? (
          <ContentSkeleton variant="cards" rows={3} />
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Erro ao carregar obras: {String(error)}</p>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-6" />
          {searchTerm || statusFilter || engineerFilter || phaseFilter !== 'all' ? (
              <>
                <h3 className="text-body font-semibold mb-2">Nenhuma obra encontrada</h3>
                <p className="text-caption text-muted-foreground mb-4">
                  Nenhum resultado para os filtros selecionados. Tente ajustar sua busca.
                </p>
                <Button variant="outline" onClick={() => setSearchParams({}, { replace: true })}>
                  Limpar filtros
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-2">Cadastre sua primeira obra</h3>
                <p className="text-caption text-muted-foreground mb-6 max-w-md mx-auto">
                  Gerencie cronogramas, documentos, financeiro e a jornada completa do seu projeto — tudo em um só lugar.
                </p>
                <Button size="lg" onClick={() => navigate('/gestao/nova-obra')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar nova obra
                </Button>
              </>
            )}
          </Card>
        ) : viewMode === 'list' ? (
          phaseFilter === 'project' ? (
            <ProjectsListViewProjetos projects={filteredProjects} />
          ) : (
            <ProjectsListView projects={filteredProjects} />
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="gestao-obras-list">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project.id)}
                onEdit={() => handleProjectEdit(project.id)}
                onDuplicate={() => handleDuplicateProject(project)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Duplicate Modal */}
      <DuplicateProjectModal
        project={selectedProject}
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
