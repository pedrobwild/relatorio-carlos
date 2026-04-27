import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, Eye, Settings, Trash2, ChevronDown, ChevronRight, UserCircle, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectsQuery } from '@/hooks/useProjectsQuery';
import { projectsRepo, type ProjectWithCustomer } from '@/infra/repositories';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/activityStatus';
import { matchesSearch } from '@/lib/searchNormalize';
import { ObraCard } from './obras/ObraCard';
import { statusColors, statusLabels } from './obras/obraCardUtils';
import { ObraExpandedRow } from './obras/ObraExpandedRow';

export function ObrasTab() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading: loading, error, refetch } = useProjectsQuery();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [engineerFilter, setEngineerFilter] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Unique engineers for filter dropdown
  const engineers = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p: ProjectWithCustomer) => {
      if (p.engineer_user_id && p.engineer_name) {
        map.set(p.engineer_user_id, p.engineer_name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [projects]);

  const filteredProjects = useMemo(() => projects.filter((p: ProjectWithCustomer) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unit_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || p.status === statusFilter;
    const matchesEngineer = !engineerFilter || p.engineer_user_id === engineerFilter;
    return matchesSearch && matchesStatus && matchesEngineer;
  }), [projects, searchTerm, statusFilter, engineerFilter]);

  const { draftCount, activeCount, completedCount, pausedCount } = useMemo(() => ({
    draftCount: projects.filter((p: ProjectWithCustomer) => p.status === 'draft').length,
    activeCount: projects.filter((p: ProjectWithCustomer) => p.status === 'active').length,
    completedCount: projects.filter((p: ProjectWithCustomer) => p.status === 'completed').length,
    pausedCount: projects.filter((p: ProjectWithCustomer) => p.status === 'paused').length,
  }), [projects]);

  const handleDelete = async (projectId: string) => {
    try {
      const { error } = await projectsRepo.deleteProject(projectId);
      if (error) throw error;
      toast({ title: 'Obra deletada', description: 'A obra foi removida com sucesso' });
      refetch();
    } catch (err: any) {
      console.error('Error deleting project:', err);
      toast({ title: 'Erro', description: err.message || 'Não foi possível deletar a obra', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gerenciar Obras</h2>
        <Button onClick={() => navigate('/gestao/nova-obra')}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Obra
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-h2 font-bold">{projects.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Rascunho</p>
          <p className="text-h2 font-bold text-slate-500">{draftCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Em andamento</p>
          <p className="text-h2 font-bold text-primary">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Concluídas</p>
          <p className="text-h2 font-bold text-accent-foreground">{completedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-tiny text-muted-foreground uppercase tracking-wider">Pausadas</p>
          <p className="text-h2 font-bold text-muted-foreground">{pausedCount}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, cliente ou unidade..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: null, label: 'Todas' },
            { value: 'draft', label: 'Rascunho' },
            { value: 'active', label: 'Em andamento' },
            { value: 'completed', label: 'Concluídas' },
            { value: 'paused', label: 'Pausadas' },
          ].map((opt) => (
            <Button key={opt.label} variant={statusFilter === opt.value ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(opt.value)}>
              {opt.label}
            </Button>
          ))}
        </div>
        {engineers.length > 0 && (
          <Select value={engineerFilter ?? 'all'} onValueChange={(v) => setEngineerFilter(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[200px] shrink-0">
              <UserCircle className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {engineers.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
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
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-3">
            {filteredProjects.map((project) => (
              <ObraCard
                key={project.id}
                project={project}
                onView={() => navigate(`/obra/${project.id}`)}
                onEdit={() => navigate(`/gestao/obra/${project.id}`)}
                onDelete={() => handleDelete(project.id)}
              />
            ))}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => {
                  const isExpanded = expandedRows.has(project.id);
                  return (
                    <>
                      <TableRow key={project.id} className="cursor-pointer" onClick={() => toggleRow(project.id)}>
                        <TableCell className="w-8 px-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{project.name}</p>
                            {project.unit_name && <p className="text-sm text-muted-foreground">{project.unit_name}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{project.customer_name || '—'}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {project.planned_start_date && project.planned_end_date
                              ? `${format(parseLocalDate(project.planned_start_date), 'dd/MM/yy', { locale: ptBR })} - ${format(parseLocalDate(project.planned_end_date), 'dd/MM/yy', { locale: ptBR })}`
                              : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[project.status]}>
                            {statusLabels[project.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/obra/${project.id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/gestao/obra/${project.id}`)}>
                              <Settings className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deletar obra?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. A obra <strong>{project.name}</strong> e todos os dados associados serão permanentemente removidos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(project.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Deletar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${project.id}-expanded`}>
                          <TableCell colSpan={6} className="p-2">
                            <ObraExpandedRow projectId={project.id} contractValue={project.contract_value} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
