import { useState, useMemo } from 'react';
import { Plus, Search, LayoutList, Columns3, AlertTriangle, Building2, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { NcManagementPanel } from '@/components/vistorias/NcManagementPanel';
import { NcKanbanView } from '@/components/vistorias/NcKanbanView';
import { NcDetailDialog } from '@/components/vistorias/NcDetailDialog';
import { CreateNcDialog } from '@/components/vistorias/CreateNcDialog';
import { PageSkeleton } from '@/components/ui-premium';
import { useAllNonConformities } from '@/hooks/useAllNonConformities';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/utils';
import { matchesSearch } from '@/lib/searchNormalize';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { NonConformity, NcSeverity } from '@/hooks/useNonConformities';

type DeadlineFilter = 'all' | 'overdue' | 'today' | 'this_week' | 'no_deadline';

export default function NaoConformidadesGlobal() {
  const { data: allNcs = [], projects, isLoading } = useAllNonConformities();
  const { data: staffUsers = [] } = useStaffUsers();
  const { can } = useCan();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNc, setSelectedNc] = useState<NonConformity | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createProjectId, setCreateProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterResponsible, setFilterResponsible] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterDeadline, setFilterDeadline] = useState<DeadlineFilter>('all');

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterProject !== 'all') count++;
    if (filterResponsible !== 'all') count++;
    if (filterSeverity !== 'all') count++;
    if (filterDeadline !== 'all') count++;
    return count;
  }, [filterProject, filterResponsible, filterSeverity, filterDeadline]);

  // Get end of week (Sunday)
  const endOfWeek = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = 7 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }, []);

  const filteredNcs = useMemo(() => {
    let result = allNcs;

    if (filterProject !== 'all') {
      result = result.filter(nc => nc.project_id === filterProject);
    }
    if (filterResponsible !== 'all') {
      result = result.filter(nc => nc.responsible_user_id === filterResponsible);
    }
    if (filterSeverity !== 'all') {
      result = result.filter(nc => nc.severity === filterSeverity);
    }
    if (filterDeadline === 'overdue') {
      result = result.filter(nc => nc.deadline && nc.deadline < today && nc.status !== 'closed');
    } else if (filterDeadline === 'today') {
      result = result.filter(nc => nc.deadline === today);
    } else if (filterDeadline === 'this_week') {
      result = result.filter(nc => nc.deadline && nc.deadline >= today && nc.deadline <= endOfWeek);
    } else if (filterDeadline === 'no_deadline') {
      result = result.filter(nc => !nc.deadline);
    }

    if (searchQuery.trim()) {
      result = result.filter((nc) =>
        matchesSearch(searchQuery, [
          nc.title,
          nc.description,
          nc.category,
          nc.responsible_user_name,
          nc.project_name,
        ]),
      );
    }

    return result;
  }, [allNcs, filterProject, filterResponsible, filterSeverity, filterDeadline, searchQuery, today, endOfWeek]);

  const clearFilters = () => {
    setFilterProject('all');
    setFilterResponsible('all');
    setFilterSeverity('all');
    setFilterDeadline('all');
  };

  // Unique responsible users from NCs
  const responsibleUsers = useMemo(() => {
    const map = new Map<string, string>();
    allNcs.forEach(nc => {
      if (nc.responsible_user_id && nc.responsible_user_name) {
        map.set(nc.responsible_user_id, nc.responsible_user_name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allNcs]);

  const handleCreateNc = () => {
    if (projects.length === 1) {
      setCreateProjectId(projects[0].id);
    } else {
      setCreateProjectId(filterProject !== 'all' ? filterProject : null);
    }
    setShowCreateDialog(true);
  };

  if (isLoading) {
    return (
      <div className="py-6">
        <PageContainer maxWidth="full">
          <PageSkeleton metrics content="cards" />
        </PageContainer>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Não Conformidades"
        maxWidth="full"
        showLogo={false}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/40 bg-muted/30 p-0.5" role="radiogroup">
            {([
              { mode: 'list' as const, icon: LayoutList, label: 'Lista' },
              { mode: 'kanban' as const, icon: Columns3, label: 'Kanban' },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                role="radio"
                aria-checked={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-all',
                  viewMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {can('ncs:create') && (
            <Button onClick={handleCreateNc} size="sm" className="gap-2 h-10 min-w-[44px]">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova NC</span>
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="py-4 md:py-6">
        <PageContainer maxWidth="full">
          <div className="space-y-4">
            {/* Search + Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar NC, obra..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>

              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge variant="default" className="h-5 w-5 p-0 justify-center text-[10px]">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 space-y-3" align="start">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Filtros</h4>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1">
                        <X className="h-3 w-3" /> Limpar
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Obra</label>
                    <Select value={filterProject} onValueChange={setFilterProject}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as obras</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                    <Select value={filterResponsible} onValueChange={setFilterResponsible}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {responsibleUsers.map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Severidade</label>
                    <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Prazo</label>
                    <Select value={filterDeadline} onValueChange={(v) => setFilterDeadline(v as DeadlineFilter)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="overdue">Atrasadas</SelectItem>
                        <SelectItem value="today">Vence hoje</SelectItem>
                        <SelectItem value="this_week">Esta semana</SelectItem>
                        <SelectItem value="no_deadline">Sem prazo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Active filter chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {filterProject !== 'all' && (
                    <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setFilterProject('all')}>
                      <Building2 className="h-3 w-3" />
                      {projects.find(p => p.id === filterProject)?.name || 'Obra'}
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                  {filterResponsible !== 'all' && (
                    <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setFilterResponsible('all')}>
                      {responsibleUsers.find(([id]) => id === filterResponsible)?.[1] || 'Resp.'}
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                  {filterSeverity !== 'all' && (
                    <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setFilterSeverity('all')}>
                      {filterSeverity === 'critical' ? 'Crítica' : filterSeverity === 'high' ? 'Alta' : filterSeverity === 'medium' ? 'Média' : 'Baixa'}
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                  {filterDeadline !== 'all' && (
                    <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setFilterDeadline('all')}>
                      {filterDeadline === 'overdue' ? 'Atrasadas' : filterDeadline === 'today' ? 'Hoje' : filterDeadline === 'this_week' ? 'Semana' : 'Sem prazo'}
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* NC count summary */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>
                <strong className="text-foreground">{filteredNcs.length}</strong> não conformidade{filteredNcs.length !== 1 ? 's' : ''}
                {activeFilterCount > 0 && <span> (filtradas de {allNcs.length})</span>}
                {' · '}
                <strong className="text-foreground">{projects.length}</strong> obra{projects.length !== 1 ? 's' : ''}
              </span>
            </div>

            {viewMode === 'list' ? (
              <NcManagementPanel
                nonConformities={filteredNcs}
                searchQuery=""
                onSelect={setSelectedNc}
                onCreateNc={handleCreateNc}
                canCreate={can('ncs:create')}
                showProjectBadge
              />
            ) : (
              <NcKanbanView
                nonConformities={filteredNcs}
                searchQuery=""
                onSelect={setSelectedNc}
                showProjectBadge
              />
            )}
          </div>
        </PageContainer>
      </div>

      {selectedNc && (
        <NcDetailDialog
          nc={selectedNc}
          open={!!selectedNc}
          onOpenChange={(open) => !open && setSelectedNc(null)}
        />
      )}

      {showCreateDialog && createProjectId && (
        <CreateNcDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          projectId={createProjectId}
          onSuccess={() => setShowCreateDialog(false)}
        />
      )}

      {/* If no project selected for create, show project picker */}
      {showCreateDialog && !createProjectId && (
        <ProjectPickerForNc
          projects={projects}
          open={showCreateDialog}
          onSelect={(projectId) => {
            setCreateProjectId(projectId);
          }}
          onOpenChange={(open) => {
            if (!open) {
              setShowCreateDialog(false);
              setCreateProjectId(null);
            }
          }}
        />
      )}
    </>
  );
}

// Simple project picker dialog
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function ProjectPickerForNc({
  projects,
  open,
  onSelect,
  onOpenChange,
}: {
  projects: { id: string; name: string }[];
  open: boolean;
  onSelect: (id: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Obra</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
