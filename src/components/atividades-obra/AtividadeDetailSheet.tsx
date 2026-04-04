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
import { cn } from '@/lib/utils';

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
  pendente: 'bg-yellow-500/15 text-yellow-700 border-yellow-400/30',
  em_andamento: 'bg-blue-500/15 text-blue-700 border-blue-400/30',
  pausado: 'bg-orange-500/15 text-orange-700 border-orange-400/30',
  concluido: 'bg-green-500/15 text-green-700 border-green-400/30',
};

const statusDots: Record<string, string> = {
  pendente: 'bg-yellow-500',
  em_andamento: 'bg-blue-500',
  pausado: 'bg-orange-500',
  concluido: 'bg-green-500',
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
      <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col h-full">
        {/* Header with colored status bar */}
        <div className={cn(
          "h-1 w-full shrink-0",
          statusDots[task.status] || 'bg-muted'
        )} />
        
        <SheetHeader className="px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-left text-lg font-bold leading-tight flex-1">{task.title}</SheetTitle>
            <Badge variant="outline" className={cn('shrink-0 text-xs font-semibold', statusColors[task.status] || '')}>
              {statusLabels[task.status] || task.status}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 pb-4">
            {/* Task Details — card style */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3 mb-5">
              {task.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <DetailItem
                  icon={<User className="h-4 w-4" />}
                  label="Responsável"
                  value={getMemberName(task.responsible_user_id)}
                />
                <DetailItem
                  icon={<Calendar className="h-4 w-4" />}
                  label="Prazo"
                  value={task.due_date ? format(new Date(task.due_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                  danger={!!isOverdue}
                />
                {task.cost != null && (
                  <DetailItem
                    icon={<DollarSign className="h-4 w-4" />}
                    label="Custo"
                    value={`R$ ${task.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                )}
                {task.status === 'concluido' && task.completed_at && (
                  <DetailItem
                    icon={<Clock className="h-4 w-4" />}
                    label="Concluído"
                    value={format(new Date(task.completed_at), 'dd/MM/yy', { locale: ptBR })}
                    extra={task.days_overdue != null ? (
                      <span className={cn(
                        'text-[10px] font-semibold',
                        task.days_overdue > 0 ? 'text-destructive' : 'text-green-600'
                      )}>
                        {task.days_overdue > 0 ? `${task.days_overdue}d atraso` : task.days_overdue === 0 ? 'no prazo' : `${Math.abs(task.days_overdue)}d antecipado`}
                      </span>
                    ) : undefined}
                  />
                )}
              </div>
            </div>

            {/* Status History — timeline style */}
            <section className="mb-5">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Histórico
              </h3>
              {historyLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                </div>
              ) : statusHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center">Nenhuma mudança registrada.</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-3">
                    {statusHistory.map(h => (
                      <div key={h.id} className="flex items-start gap-3 relative">
                        <div className={cn(
                          "w-[19px] h-[19px] rounded-full border-2 border-background shrink-0 mt-0.5 z-10",
                          statusDots[h.new_status] || 'bg-muted-foreground'
                        )} />
                        <div className="flex-1 min-w-0 bg-card rounded-lg border border-border/40 p-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            {h.old_status && (
                              <>
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4', statusColors[h.old_status] || '')}>
                                  {statusLabels[h.old_status] || h.old_status}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              </>
                            )}
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4', statusColors[h.new_status] || '')}>
                              {statusLabels[h.new_status] || h.new_status}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {h.changed_by_name || 'Sistema'} · {format(new Date(h.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <Separator className="mb-5" />

            {/* Comments */}
            <section>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Comentários
                {comments.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold">{comments.length}</Badge>
                )}
              </h3>
              {commentsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center mb-3">
                  Nenhum comentário. Seja o primeiro!
                </p>
              ) : (
                <div className="space-y-3 mb-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5 group">
                      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                          {getInitials(c.author_name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 bg-muted/30 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">{c.author_name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {user?.id === c.author_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteComment.mutate(c.id)}
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>

        {/* Comment input — sticky bottom with safe area */}
        <div className="border-t bg-card/95 backdrop-blur-sm p-4 pb-safe shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva um comentário..."
              className="min-h-[44px] max-h-[120px] resize-none text-sm rounded-xl border-border/50 bg-muted/20"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleAddComment}
              disabled={!newComment.trim() || addComment.isPending}
              className="shrink-0 h-11 w-11 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ icon, label, value, danger, extra }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  danger?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className={cn("shrink-0 mt-0.5", danger ? "text-destructive" : "text-muted-foreground")}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className={cn("text-sm font-medium truncate", danger && "text-destructive")}>{value}</p>
        {extra}
      </div>
    </div>
  );
}
