import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, DollarSign, User, Clock, MessageSquare, Send, Trash2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TASK_STATUSES, type ObraTask } from '@/hooks/useObraTasks';
import { useObraTaskComments } from '@/hooks/useObraTaskComments';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  task: ObraTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  pausado: 'Pausado',
  concluido: 'Concluído',
};

const statusColors: Record<string, string> = {
  pendente: 'bg-yellow-500/15 text-yellow-700 border-yellow-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 border-blue-300',
  pausado: 'bg-orange-500/15 text-orange-700 border-orange-300',
  concluido: 'bg-green-500/15 text-green-700 border-green-300',
};

export function AtividadeDetailSheet({ task, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { comments, commentsLoading, statusHistory, historyLoading, addComment, deleteComment } =
    useObraTaskComments(task?.id);
  const { data: staffUsers = [] } = useStaffUsers();
  const [newComment, setNewComment] = useState('');

  const getMemberName = (userId: string | null) => {
    if (!userId) return '—';
    const u = staffUsers.find(u => u.id === userId);
    return u?.nome || u?.email || '—';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate(newComment.trim());
    setNewComment('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  if (!task) return null;

  const isOverdue = task.due_date && task.status !== 'concluido' && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="text-left text-lg leading-tight">{task.title}</SheetTitle>
          <Badge variant="outline" className={`${statusColors[task.status] || ''} w-fit text-xs mt-1`}>
            {statusLabels[task.status] || task.status}
          </Badge>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          {/* Task Details */}
          <div className="space-y-3 mb-6">
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 shrink-0" />
                <span>{getMemberName(task.responsible_user_id)}</span>
              </div>
              <div className={`flex items-center gap-2 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                <Calendar className="h-4 w-4 shrink-0" />
                <span>{task.due_date ? format(new Date(task.due_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</span>
              </div>
              {task.cost != null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4 shrink-0" />
                  <span>R$ {task.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {task.status === 'concluido' && task.completed_at && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    Concluído em {format(new Date(task.completed_at), 'dd/MM/yy', { locale: ptBR })}
                    {task.days_overdue != null && (
                      <span className={`ml-1 font-medium ${task.days_overdue > 0 ? 'text-destructive' : 'text-green-600'}`}>
                        ({task.days_overdue > 0 ? `${task.days_overdue}d atraso` : task.days_overdue === 0 ? 'no prazo' : `${Math.abs(task.days_overdue)}d antecipado`})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator className="mb-4" />

          {/* Status History */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Histórico de Status
            </h3>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : statusHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma mudança de status registrada.</p>
            ) : (
              <div className="space-y-2">
                {statusHistory.map(h => (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        {h.old_status && (
                          <>
                            <Badge variant="outline" className={`${statusColors[h.old_status] || ''} text-[10px] px-1.5 py-0`}>
                              {statusLabels[h.old_status] || h.old_status}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </>
                        )}
                        <Badge variant="outline" className={`${statusColors[h.new_status] || ''} text-[10px] px-1.5 py-0`}>
                          {statusLabels[h.new_status] || h.new_status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        {h.changed_by_name || 'Sistema'} • {format(new Date(h.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="mb-4" />

          {/* Comments */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comentários
              {comments.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{comments.length}</Badge>
              )}
            </h3>
            {commentsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground mb-3">Nenhum comentário ainda. Seja o primeiro!</p>
            ) : (
              <div className="space-y-3 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2 group">
                    <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(c.author_name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{c.author_name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(c.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {user?.id === c.author_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteComment.mutate(c.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Comment input - fixed at bottom */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva um comentário..."
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleAddComment}
              disabled={!newComment.trim() || addComment.isPending}
              className="shrink-0 h-10 w-10"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}