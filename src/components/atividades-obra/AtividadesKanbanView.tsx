import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Calendar, DollarSign, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TASK_STATUSES, type ObraTask, type ObraTaskStatus, type ObraTaskInput } from '@/hooks/useObraTasks';
import { AtividadeFormDialog } from './AtividadeFormDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  tasks: ObraTask[];
  isLoading: boolean;
  members: any[];
  onUpdateStatus: (id: string, status: ObraTaskStatus) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ObraTaskInput>) => void;
}

const columnColors: Record<ObraTaskStatus, string> = {
  pendente: 'border-t-yellow-500',
  em_andamento: 'border-t-blue-500',
  pausado: 'border-t-orange-500',
  concluido: 'border-t-green-500',
};

const columnBg: Record<ObraTaskStatus, string> = {
  pendente: 'bg-yellow-50 dark:bg-yellow-950/20',
  em_andamento: 'bg-blue-50 dark:bg-blue-950/20',
  pausado: 'bg-orange-50 dark:bg-orange-950/20',
  concluido: 'bg-green-50 dark:bg-green-950/20',
};

export function AtividadesKanbanView({ tasks, isLoading, members, onUpdateStatus, onDelete, onUpdate }: Props) {
  const [editTask, setEditTask] = useState<ObraTask | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ObraTaskStatus | null>(null);

  const getMemberName = (userId: string | null) => {
    if (!userId) return null;
    const m = members?.find((m: any) => m.user_id === userId);
    return m?.user_name || m?.user_email || null;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: ObraTaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (e: React.DragEvent, status: ObraTaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) onUpdateStatus(taskId, status);
    setDragOverColumn(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[400px]">
        {TASK_STATUSES.map(col => {
          const colTasks = tasks.filter(t => t.status === col.value);
          return (
            <div
              key={col.value}
              className={`rounded-lg border-t-4 ${columnColors[col.value]} ${
                dragOverColumn === col.value ? 'ring-2 ring-primary/40' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, col.value)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.value)}
            >
              <div className={`p-3 rounded-t-lg ${columnBg[col.value]}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{col.label}</h3>
                  <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-[200px] bg-muted/30 rounded-b-lg">
                {colTasks.map(task => {
                  const responsible = getMemberName(task.responsible_user_id);
                  const isOverdue = task.due_date && task.status !== 'concluido' && task.due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <span className={`font-medium text-sm leading-tight ${task.status === 'concluido' ? 'line-through opacity-60' : ''}`}>
                            {task.title}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditTask(task)}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {responsible && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {responsible}
                            </span>
                          )}
                          {task.due_date && (
                            <span className={`flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
                              <Calendar className="h-3 w-3" />
                              {format(new Date(task.due_date + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
                            </span>
                          )}
                          {task.cost != null && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {task.cost.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AtividadeFormDialog
        open={!!editTask}
        onOpenChange={(open) => !open && setEditTask(null)}
        onSubmit={(input) => {
          if (editTask) {
            onUpdate(editTask.id, input);
            setEditTask(null);
          }
        }}
        members={members}
        initialData={editTask}
      />
    </>
  );
}
