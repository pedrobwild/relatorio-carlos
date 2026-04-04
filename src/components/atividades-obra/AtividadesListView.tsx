import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TASK_STATUSES, type ObraTask, type ObraTaskStatus, type ObraTaskInput } from '@/hooks/useObraTasks';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { AtividadeFormDialog } from './AtividadeFormDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  tasks: ObraTask[];
  isLoading: boolean;
  onUpdateStatus: (id: string, status: ObraTaskStatus) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ObraTaskInput>) => void;
}

const statusVariant: Record<ObraTaskStatus, string> = {
  pendente: 'bg-yellow-500/15 text-yellow-700 border-yellow-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 border-blue-300',
  pausado: 'bg-orange-500/15 text-orange-700 border-orange-300',
  concluido: 'bg-green-500/15 text-green-700 border-green-300',
};

export function AtividadesListView({ tasks, isLoading, onUpdateStatus, onDelete, onUpdate }: Props) {
  const [editTask, setEditTask] = useState<ObraTask | null>(null);
  const { data: staffUsers = [] } = useStaffUsers();

  const getMemberName = (userId: string | null) => {
    if (!userId) return '—';
    const u = staffUsers.find(u => u.id === userId);
    return u?.nome || u?.email || '—';
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Nenhuma atividade cadastrada</p>
        <p className="text-sm mt-1">Crie a primeira atividade para começar a gerenciar as tarefas internas.</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Ação</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(task => {
              const isOverdue = task.due_date && task.status !== 'concluido' && task.due_date < new Date().toISOString().slice(0, 10);
              return (
                <TableRow key={task.id} className={task.status === 'concluido' ? 'opacity-60' : ''}>
                  <TableCell>
                    <div>
                      <span className={`font-medium ${task.status === 'concluido' ? 'line-through' : ''}`}>{task.title}</span>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{getMemberName(task.responsible_user_id)}</TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <span className={`text-sm flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(task.due_date + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR })}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {task.cost != null ? (
                      <span className="text-sm flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        {task.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.status}
                      onValueChange={(v) => onUpdateStatus(task.id, v as ObraTaskStatus)}
                    >
                      <SelectTrigger className="h-7 w-auto border-0 p-0 focus:ring-0">
                        <Badge variant="outline" className={`${statusVariant[task.status]} text-xs cursor-pointer`}>
                          {TASK_STATUSES.find(s => s.value === task.status)?.label}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
        
        initialData={editTask}
      />
    </>
  );
}
