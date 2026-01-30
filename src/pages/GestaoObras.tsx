import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Calendar, User, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function ProjectCard({ project, onClick, onEdit }: { project: ProjectWithCustomer; onClick: () => void; onEdit: () => void }) {
  const daysRemaining = useMemo(() => Math.ceil(
    (new Date(project.planned_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ), [project.planned_end_date]);

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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
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
        
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {format(new Date(project.planned_start_date), 'dd/MM/yy', { locale: ptBR })} - {' '}
            {format(new Date(project.planned_end_date), 'dd/MM/yy', { locale: ptBR })}
          </span>
        </div>

        {project.status === 'active' && daysRemaining > 0 && (
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
  const { data: projects = [], isLoading: loading, error } = useProjectsQuery();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const handleProjectClick = useCallback((projectId: string) => {
    navigate(`/obra/${projectId}`);
  }, [navigate]);

  const handleProjectEdit = useCallback((projectId: string) => {
    navigate(`/gestao/obra/${projectId}`);
  }, [navigate]);

  const filteredProjects = useMemo(() => projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unit_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [projects, searchTerm, statusFilter]);

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

      <main className="container max-w-6xl mx-auto px-4 py-6">
        {/* Action Button */}
        <div className="flex justify-end mb-6">
          <Button onClick={() => navigate('/gestao/nova-obra')}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Obra
          </Button>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-h2 font-bold">{projects.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Em andamento</p>
            <p className="text-h2 font-bold text-green-600">{activeCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Concluídas</p>
            <p className="text-h2 font-bold text-blue-600">{completedCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-tiny text-muted-foreground uppercase tracking-wider">Este mês</p>
            <p className="text-h2 font-bold">{thisMonthCount}</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cliente ou unidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
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
              variant={statusFilter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('completed')}
            >
              Concluídas
            </Button>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-40 animate-pulse bg-muted" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Erro ao carregar obras: {String(error)}</p>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter ? 'Nenhuma obra encontrada' : 'Nenhuma obra cadastrada'}
            </p>
            {!searchTerm && !statusFilter && (
              <Button onClick={() => navigate('/gestao/nova-obra')}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar primeira obra
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project.id)}
                onEdit={() => handleProjectEdit(project.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
