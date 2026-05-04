import { useState } from'react';
import { useNavigate } from'react-router-dom';
import { Card, CardContent } from'@/components/ui/card';
import { Badge } from'@/components/ui/badge';
import { Button } from'@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from'@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Calendar, User, CheckSquare } from'lucide-react';
import { format } from'date-fns';
import { ptBR } from'date-fns/locale';
import { TASK_STATUSES, type ObraTask, type ObraTaskStatus, type ObraTaskInput } from'@/hooks/useObraTasks';
import { useStaffUsers } from'@/hooks/useStaffUsers';
import { AtividadeFormDialog } from'./AtividadeFormDialog';
import { DeleteTaskDialog } from'./DeleteTaskDialog';
import { Skeleton } from'@/components/ui/skeleton';
import { useProjectNavigation } from'@/hooks/useProjectNavigation';
import { cn } from'@/lib/utils';
import { getMemberName, isTaskOverdue, priorityConfig } from'@/lib/taskUtils';

interface Props {
 tasks: ObraTask[];
 isLoading: boolean;
 onUpdateStatus: (id: string, status: ObraTaskStatus) => void;
 onDelete: (id: string) => void;
 onUpdate: (id: string, updates: Partial<ObraTaskInput>) => void;
}

const columnColors: Record<ObraTaskStatus, string> = {
 pendente:'border-t-yellow-500',
 em_andamento:'border-t-blue-500',
 pausado:'border-t-orange-500',
 concluido:'border-t-green-500',
};

const columnBg: Record<ObraTaskStatus, string> = {
 pendente:'bg-yellow-50/60',
 em_andamento:'bg-blue-50/60',
 pausado:'bg-orange-50/60',
 concluido:'bg-green-50/60',
};

const dotColors: Record<ObraTaskStatus, string> = {
 pendente:'bg-yellow-500',
 em_andamento:'bg-blue-500',
 pausado:'bg-orange-500',
 concluido:'bg-green-500',
};

export function AtividadesKanbanView({ tasks, isLoading, onUpdateStatus, onDelete, onUpdate }: Props) {
 const [editTask, setEditTask] = useState<ObraTask | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<ObraTask | null>(null);
 const navigate = useNavigate();
 const { projectId } = useProjectNavigation();
 const [dragOverColumn, setDragOverColumn] = useState<ObraTaskStatus | null>(null);
 const { data: staffUsers = [] } = useStaffUsers();

 if (isLoading) {
 return (
 <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4">
 {[1, 2, 3, 4].map(i => (
 <div key={i} className="min-w-[260px] md:min-w-0 space-y-3">
 <Skeleton className="h-10 w-full rounded-xl" />
 <Skeleton className="h-24 w-full rounded-xl" />
 <Skeleton className="h-24 w-full rounded-xl" />
 </div>
 ))}
 </div>
 );
 }

 const handleDragStart = (e: React.DragEvent, taskId: string) => {
 e.dataTransfer.setData('taskId', taskId);
 e.dataTransfer.effectAllowed ='move';
 };

 const handleDragOver = (e: React.DragEvent, status: ObraTaskStatus) => {
 e.preventDefault();
 e.dataTransfer.dropEffect ='move';
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
 {/* Horizontal scroll on mobile, grid on desktop */}
 <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 min-h-[calc(100vh-220px)] scrollbar-hide">
 {TASK_STATUSES.map(col => {
 const colTasks = tasks.filter(t => t.status === col.value);
 return (
 <div
 key={col.value}
 className={cn(
'min-w-[260px] md:min-w-0 rounded-2xl border-t-[3px] transition-all flex flex-col',
 columnColors[col.value],
 dragOverColumn === col.value &&'ring-2 ring-primary/40 shadow-lg',
 )}
 onDragOver={(e) => handleDragOver(e, col.value)}
 onDragLeave={handleDragLeave}
 onDrop={(e) => handleDrop(e, col.value)}
 >
 <div className={cn('px-2.5 py-2 rounded-t-xl', columnBg[col.value])}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className={cn('w-2.5 h-2.5 rounded-full', dotColors[col.value])} />
 <h3 className="font-bold text-sm">{col.label}</h3>
 </div>
 <Badge variant="secondary" className="text-[10px] font-bold h-5 min-w-[20px] justify-center">{colTasks.length}</Badge>
 </div>
 </div>
 <div className="p-1.5 space-y-1.5 flex-1 bg-muted/20 rounded-b-2xl">
 {colTasks.map(task => {
 const responsible = getMemberName(staffUsers, task.responsible_user_id);
 const overdue = isTaskOverdue(task);
 const prio = priorityConfig[task.priority];
 return (
 <Card
 key={task.id}
 draggable
 onDragStart={(e) => handleDragStart(e, task.id)}
 className="cursor-grab active:cursor-grabbing hover:shadow-md transition-all rounded-xl border-border/40 active:scale-[0.98]"
 onClick={() => navigate(`/obra/${projectId}/atividades/${task.id}`)}
 >
 <CardContent className="p-2.5 space-y-1.5">
 <div className="flex items-start justify-between gap-1">
 <span className={cn(
'font-semibold text-sm leading-tight',
 task.status ==='concluido' &&'line-through opacity-60'
 )}>
 {task.title}
 </span>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-lg" onClick={e => e.stopPropagation()}>
 <MoreHorizontal className="h-3.5 w-3.5" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditTask(task); }}>
 <Pencil className="h-4 w-4 mr-2" /> Editar
 </DropdownMenuItem>
 <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(task); }}>
 <Trash2 className="h-4 w-4 mr-2" /> Excluir
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 {task.description && (
 <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{task.description}</p>
 )}
 <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
 {/* Priority indicator */}
 <span className={cn('flex items-center gap-0.5 font-medium', prio.color)}>
 <span className="text-xs">{prio.icon}</span> {prio.label}
 </span>
 {responsible && (
 <span className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5">
 <User className="h-3 w-3" /> {responsible}
 </span>
 )}
 {task.due_date && (
 <span className={cn(
'flex items-center gap-1 rounded-md px-1.5 py-0.5',
 overdue ?'bg-destructive/10 text-destructive font-semibold' :'bg-muted/50'
 )}>
 <Calendar className="h-3 w-3" />
 {format(new Date(task.due_date +'T00:00:00'),'dd/MM', { locale: ptBR })}
 </span>
 )}
 {task.cost != null && (
 <span className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5">
 R$ {task.cost.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
 </span>
 )}
 {(task.subtask_total ?? 0) > 0 && (
 <span className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5">
 <CheckSquare className="h-3 w-3" /> {task.subtask_total}
 </span>
 )}
 </div>
 {task.status ==='concluido' && task.completed_at && task.days_overdue != null && (
 <p className={cn(
'text-[11px] font-semibold',
 task.days_overdue > 0 ?'text-destructive' :'text-green-600'
 )}>
 {task.days_overdue > 0 ?`${task.days_overdue}d atraso` : task.days_overdue === 0 ?'✓ No prazo' :`✓ ${Math.abs(task.days_overdue)}d antecipado`}
 </p>
 )}
 </CardContent>
 </Card>
 );
 })}
 {colTasks.length === 0 && (
 <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50 border-2 border-dashed border-border/30 rounded-xl">
 Arraste aqui
 </div>
 )}
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
 initialData={editTask}
 draftScope={projectId}
 />

 <DeleteTaskDialog
 open={!!deleteTarget}
 onOpenChange={(open) => !open && setDeleteTarget(null)}
 taskTitle={deleteTarget?.title ||''}
 onConfirm={() => {
 if (deleteTarget) {
 onDelete(deleteTarget.id);
 setDeleteTarget(null);
 }
 }}
 />
 </>
 );
}
