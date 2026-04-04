import { useState } from 'react';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { useObraTasks, ObraTaskInput } from '@/hooks/useObraTasks';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Plus, LayoutList, Columns3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AtividadesListView } from '@/components/atividades-obra/AtividadesListView';
import { AtividadesKanbanView } from '@/components/atividades-obra/AtividadesKanbanView';
import { AtividadeFormDialog } from '@/components/atividades-obra/AtividadeFormDialog';

export default function AtividadesObra() {
  const { projectId } = useProjectNavigation();
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useObraTasks(projectId);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = (input: ObraTaskInput) => {
    createTask.mutate(input);
    setDialogOpen(false);
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Atividades</h1>
          <p className="text-sm text-muted-foreground">Tarefas internas da obra (uso da equipe)</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'kanban')}>
            <TabsList className="h-9">
              <TabsTrigger value="list" className="gap-1.5 px-3">
                <LayoutList className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5 px-3">
                <Columns3 className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova Atividade
          </Button>
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
