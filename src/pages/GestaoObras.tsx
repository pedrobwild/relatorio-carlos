import { useState, useCallback, useMemo } from 'react';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Calendar, User, Search, Settings, Copy, Users } from 'lucide-react';
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
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-body font-semibold">{project.name}</CardTitle>
            {project.unit_name && (
              <p className="text-caption text-muted-foreground">{project.unit_name}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
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
              className="h-8 w-8"
              title="Editar obra"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className={statusColors[project.status]}>
              {statusLabels[project.status]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {project.customer_name && (
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>{project.customer_name}</span>
          </div>
        )}
        
        {(project.planned_start_date || project.planned_end_date) ? (
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {project.planned_start_date 
                ? format(parseLocalDate(project.planned_start_date), 'dd/MM/yy', { locale: ptBR }) 
                : 'A definir'} - {' '}
              {project.planned_end_date 
                ? format(parseLocalDate(project.planned_end_date), 'dd/MM/yy', { locale: ptBR }) 
                : 'A definir'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Datas em definição</span>
          </div>
        )}

        {project.status === 'active' && daysRemaining !== null && daysRemaining > 0 && (
          <div className="pt-2 border-t">
            <p className="text-tiny text-muted-foreground">
              <span className="font-medium text-foreground">{daysRemaining}</span> dias restantes
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GestaoObras() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading: loading, error, refetch } = useProjectsQuery();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'project' | 'execution'>('all');
  const [engineerFilter, setEngineerFilter] = useState<string | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithCustomer | null>(null);

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

  const { activeCount, completedCount, thisMonthCount } = useMemo(() => ({
    activeCount: projects.filter(p => p.status === 'active').length,
    completedCount: projects.filter(p => p.status === 'completed').length,
    thisMonthCount: projects.filter(p => {
      const created = new Date(p.created_at);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length,
  }), [projects]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <AppHeader>
        <div className="ml-2">
          <h1 className="text-h3 font-bold">Gestão de Obras</h1>
        </div>
      </AppHeader>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Action Button */}
        <div className="flex justify-end mb-6">
          <Button onClick={() => navigate('/gestao/nova-obra')}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Obra
          </Button>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className={`p-4 ${projects.length === 0 ? 'border-dashed bg-muted/30' : ''}`}>
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-h2 font-bold">{projects.length}</p>
          </Card>
          <Card className={`p-4 ${activeCount === 0 ? 'border-dashed bg-muted/30' : ''}`}>
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Em andamento</p>
            <p className="text-h2 font-bold text-success">{activeCount}</p>
          </Card>
          <Card className={`p-4 ${completedCount === 0 ? 'border-dashed bg-muted/30' : ''}`}>
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Concluídas</p>
            <p className="text-h2 font-bold text-primary">{completedCount}</p>
          </Card>
          <Card className={`p-4 ${thisMonthCount === 0 ? 'border-dashed bg-muted/30' : ''}`}>
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Este mês</p>
            <p className="text-h2 font-bold">{thisMonthCount}</p>
          </Card>
        </div>

        {/* Engineer Filter */}
        {engineers.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filtrar por Engenheiro</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={engineerFilter === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEngineerFilter(null)}
              >
                Todos
              </Button>
              {engineers.map(engineer => (
                <Button
                  key={engineer.id}
                  variant={engineerFilter === engineer.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEngineerFilter(engineer.id)}
                >
                  {engineer.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cliente ou unidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Status filters */}
            <Button
              variant={statusFilter === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(null)}
            >
              Todas
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('active')}
            >
              Em andamento
            </Button>
            <Button
              variant={statusFilter === 'paused' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('paused')}
            >
              Pausadas
            </Button>
            <Button
              variant={statusFilter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('completed')}
            >
              Concluídas
            </Button>
            <Button
              variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('cancelled')}
            >
              Canceladas
            </Button>
            
            {/* Divider */}
            <div className="w-px h-8 bg-border mx-1 hidden sm:block" />
            
            {/* Phase filter */}
            <Button
              variant={phaseFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setPhaseFilter('all')}
            >
              Todas fases
            </Button>
            <Button
              variant={phaseFilter === 'project' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setPhaseFilter('project')}
            >
              🏗️ Fase Projeto
            </Button>
            <Button
              variant={phaseFilter === 'execution' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setPhaseFilter('execution')}
            >
              🔨 Execução
            </Button>
          </div>
        </div>

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
                <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter(null); setEngineerFilter(null); setPhaseFilter('all'); }}>
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
