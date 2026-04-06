import { useState, useMemo } from 'react';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { useObraTasks, ObraTaskInput } from '@/hooks/useObraTasks';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, LayoutList, Columns3, User } from 'lucide-react';
import { AtividadesListView } from '@/components/atividades-obra/AtividadesListView';
import { AtividadesKanbanView } from '@/components/atividades-obra/AtividadesKanbanView';
import { AtividadesMobileListView } from '@/components/atividades-obra/AtividadesMobileListView';
import { AtividadeFormDialog } from '@/components/atividades-obra/AtividadeFormDialog';
import { cn } from '@/lib/utils';

export default function AtividadesObra() {
  const { projectId } = useProjectNavigation();
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useObraTasks(projectId);
  const { data: staffUsers = [] } = useStaffUsers();
  const isMobile = useIsMobile();
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterResponsible, setFilterResponsible] = useState<string>('all');

  const handleCreate = (input: ObraTaskInput) => {
    createTask.mutate(input);
    setDialogOpen(false);
  };

  // Get unique responsible users from current tasks
  const responsibleOptions = useMemo(() => {
    const ids = new Set(tasks.map(t => t.responsible_user_id).filter(Boolean) as string[]);
    return staffUsers.filter(u => ids.has(u.id));
  }, [tasks, staffUsers]);

  const filteredTasks = useMemo(() => {
    if (filterResponsible === 'all') return tasks;
    if (filterResponsible === 'unassigned') return tasks.filter(t => !t.responsible_user_id);
    return tasks.filter(t => t.responsible_user_id === filterResponsible);
  }, [tasks, filterResponsible]);

  const statusCounts = {
    total: filteredTasks.length,
    pendente: filteredTasks.filter(t => t.status === 'pendente').length,
    em_andamento: filteredTasks.filter(t => t.status === 'em_andamento').length,
    concluido: filteredTasks.filter(t => t.status === 'concluido').length,
  };

  const ResponsibleFilter = () => (
    <Select value={filterResponsible} onValueChange={setFilterResponsible}>
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <User className="h-3.5 w-3.5 mr-1.5 shrink-0" />
        <SelectValue placeholder="Responsável" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        <SelectItem value="unassigned">Sem responsável</SelectItem>
        {responsibleOptions.map(u => (
          <SelectItem key={u.id} value={u.id}>
            {u.nome || u.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Mobile
  if (isMobile) {
    return (
      <PageContainer>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">Atividades</h1>
            <p className="text-xs text-muted-foreground">Tarefas internas da equipe</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="h-9 gap-1.5 rounded-lg font-semibold shrink-0">
            <Plus className="h-4 w-4" />
            Nova
          </Button>
        </div>

        <div className="mb-3">
          <ResponsibleFilter />
        </div>

        <AtividadesMobileListView
          tasks={filteredTasks}
          isLoading={isLoading}
          onUpdateStatus={(id, status) => updateTask.mutate({ id, updates: { status } })}
          onDelete={(id) => deleteTask.mutate(id)}
          onUpdate={(id, updates) => updateTask.mutate({ id, updates })}
        />

        <AtividadeFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleCreate}
        />
      </PageContainer>
    );
  }

  // Desktop
  return (
    <PageContainer>
      <div className="flex flex-col gap-3 mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Atividades</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Tarefas internas da equipe</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="h-9 gap-1.5 rounded-lg font-semibold shrink-0">
            <Plus className="h-4 w-4" />
            Nova Atividade
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <span className="font-bold text-foreground tabular-nums">{statusCounts.total}</span> total
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1 text-xs shrink-0">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="tabular-nums font-medium">{statusCounts.pendente}</span>
            </div>
            <div className="flex items-center gap-1 text-xs shrink-0">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="tabular-nums font-medium">{statusCounts.em_andamento}</span>
            </div>
            <div className="flex items-center gap-1 text-xs shrink-0">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="tabular-nums font-medium">{statusCounts.concluido}</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <ResponsibleFilter />
          </div>

          <div className="flex items-center rounded-lg border border-border/40 bg-muted/30 p-0.5 shrink-0" role="radiogroup">
            {([
              { mode: 'list' as const, icon: LayoutList, label: 'Lista' },
              { mode: 'kanban' as const, icon: Columns3, label: 'Kanban' },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                role="radio"
                aria-checked={view === mode}
                onClick={() => setView(mode)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-all',
                  view === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <AtividadesListView
          tasks={filteredTasks}
          isLoading={isLoading}
          onUpdateStatus={(id, status) => updateTask.mutate({ id, updates: { status } })}
          onDelete={(id) => deleteTask.mutate(id)}
          onUpdate={(id, updates) => updateTask.mutate({ id, updates })}
        />
      ) : (
        <AtividadesKanbanView
          tasks={filteredTasks}
          isLoading={isLoading}
          onUpdateStatus={(id, status) => updateTask.mutate({ id, updates: { status } })}
          onDelete={(id) => deleteTask.mutate(id)}
          onUpdate={(id, updates) => updateTask.mutate({ id, updates })}
        />
      )}

      <AtividadeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
      />
    </PageContainer>
  );
}
