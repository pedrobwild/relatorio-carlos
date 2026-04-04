import { useState } from 'react';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { useObraTasks, ObraTaskInput } from '@/hooks/useObraTasks';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Plus, LayoutList, Columns3 } from 'lucide-react';
import { AtividadesListView } from '@/components/atividades-obra/AtividadesListView';
import { AtividadesKanbanView } from '@/components/atividades-obra/AtividadesKanbanView';
import { AtividadeFormDialog } from '@/components/atividades-obra/AtividadeFormDialog';
import { cn } from '@/lib/utils';

export default function AtividadesObra() {
  const { projectId } = useProjectNavigation();
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useObraTasks(projectId);
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = (input: ObraTaskInput) => {
    createTask.mutate(input);
    setDialogOpen(false);
  };

  const statusCounts = {
    total: tasks.length,
    pendente: tasks.filter(t => t.status === 'pendente').length,
    em_andamento: tasks.filter(t => t.status === 'em_andamento').length,
    concluido: tasks.filter(t => t.status === 'concluido').length,
  };

  return (
    <PageContainer>
      {/* Header — mobile optimized */}
      <div className="flex flex-col gap-3 mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Atividades</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Tarefas internas da equipe</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="h-9 gap-1.5 rounded-lg font-semibold shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Atividade</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>

        {/* Stats + View toggle row */}
        <div className="flex items-center justify-between gap-2">
          {/* Mini stats */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
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
          </div>

          {/* View toggle */}
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
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <AtividadesListView
          tasks={tasks}
          isLoading={isLoading}
          onUpdateStatus={(id, status) => updateTask.mutate({ id, updates: { status } })}
          onDelete={(id) => deleteTask.mutate(id)}
          onUpdate={(id, updates) => updateTask.mutate({ id, updates })}
        />
      ) : (
        <AtividadesKanbanView
          tasks={tasks}
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
