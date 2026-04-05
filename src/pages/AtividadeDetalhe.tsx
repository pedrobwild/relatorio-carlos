import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useObraTasks, TASK_STATUSES, type ObraTaskStatus, type ObraTaskInput } from '@/hooks/useObraTasks';
import { useObraTaskComments } from '@/hooks/useObraTaskComments';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AtividadeFormDialog } from '@/components/atividades-obra/AtividadeFormDialog';
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Calendar,
  DollarSign,
  User,
  Clock,
  MessageSquare,
  Send,
  Trash2,
  ArrowRight,
  Pencil,
  MoreHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

export default function AtividadeDetalhe() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { tasks, isLoading, updateTask, deleteTask } = useObraTasks(projectId);
  const task = tasks.find(t => t.id === taskId);
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  const { comments, commentsLoading, statusHistory, historyLoading, addComment, deleteComment } =
    useObraTaskComments(taskId);
  const { data: staffUsers = [] } = useStaffUsers();

  const [newComment, setNewComment] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const goBack = () => navigate(`/obra/${projectId}/atividades`);

  const getMemberName = (userId: string | null) => {
    if (!userId) return null;
    const u = staffUsers.find(u => u.id === userId);
    return u?.nome || u?.email || null;
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

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

  const handleStatusChange = (status: ObraTaskStatus) => {
    if (task) updateTask.mutate({ id: task.id, updates: { status } });
  };

  const handleUpdate = (id: string, updates: Partial<ObraTaskInput>) => {
    updateTask.mutate({ id, updates });
  };

  const navigateTask = (dir: -1 | 1) => {
    const next = tasks[taskIndex + dir];
    if (next) navigate(`/obra/${projectId}/atividades/${next.id}`, { replace: true });
  };

  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  if (!task) {
    return (
      <PageContainer>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Atividade não encontrada.</p>
          <Button variant="ghost" onClick={goBack} className="mt-4">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
      </PageContainer>
    );
  }

  const isOverdue = task.due_date && task.status !== 'concluido' && task.due_date < new Date().toISOString().slice(0, 10);
  const responsibleName = getMemberName(task.responsible_user_id);

  // --- SIDEBAR CONTENT (reused on mobile as stacked section) ---
  const sidebarContent = (
    <div className="space-y-5">
      {/* Status buttons */}
      {task.status !== 'concluido' && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alterar status</p>
          <div className="flex flex-wrap gap-1.5">
            {TASK_STATUSES.filter(s => s.value !== task.status).map(s => (
              <Button
                key={s.value}
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg gap-1.5"
                onClick={() => handleStatusChange(s.value)}
              >
                <div className={cn('w-2 h-2 rounded-full', statusDots[s.value])} />
                {s.value === 'concluido' ? 'Concluir' : s.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Info section */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
        <h3 className="text-sm font-bold">Informações</h3>

        <InfoRow
          icon={<User className="h-4 w-4" />}
          label="Responsável"
          value={responsibleName || 'Não atribuído'}
          muted={!responsibleName}
        />

        <InfoRow
          icon={<Calendar className="h-4 w-4" />}
          label="Data limite"
          value={task.due_date
            ? format(new Date(task.due_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
            : 'Nenhum'}
          danger={!!isOverdue}
          muted={!task.due_date}
        />

        {task.cost != null && (
          <InfoRow
            icon={<DollarSign className="h-4 w-4" />}
            label="Custo"
            value={`R$ ${task.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          />
        )}

        {task.status === 'concluido' && task.completed_at && (
          <InfoRow
            icon={<Clock className="h-4 w-4" />}
            label="Concluído em"
            value={format(new Date(task.completed_at), 'dd/MM/yyyy', { locale: ptBR })}
            extra={task.days_overdue != null ? (
              <span className={cn(
                'text-[10px] font-semibold',
                task.days_overdue > 0 ? 'text-destructive' : 'text-green-600'
              )}>
                {task.days_overdue > 0 ? `${task.days_overdue}d atraso` : task.days_overdue === 0 ? 'No prazo' : `${Math.abs(task.days_overdue)}d antecipado`}
              </span>
            ) : undefined}
          />
        )}
      </div>
    </div>
  );

  // --- MAIN CONTENT (description, history, comments) ---
  const mainContent = (
    <div className="space-y-6">
      {/* Description */}
      <section>
        <h3 className="text-sm font-bold mb-2">Descrição</h3>
        {task.description ? (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{task.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">Sem descrição</p>
        )}
      </section>

      {/* History */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 touch-target">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Histórico
            {statusHistory.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold">{statusHistory.length}</Badge>
            )}
          </h3>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', historyOpen && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : statusHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center">Nenhuma mudança registrada.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-2.5">
                {statusHistory.map(h => (
                  <div key={h.id} className="flex items-start gap-3 relative">
                    <div className={cn(
                      'w-[19px] h-[19px] rounded-full border-2 border-background shrink-0 mt-0.5 z-10',
                      statusDots[h.new_status] || 'bg-muted-foreground'
                    )} />
                    <div className="flex-1 min-w-0 bg-card rounded-lg border border-border/40 p-2">
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
        </CollapsibleContent>
      </Collapsible>

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
            {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center mb-3">
            Nenhum comentário. Seja o primeiro!
          </p>
        ) : (
          <div className="space-y-2.5 mb-3">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2 group">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                    {getInitials(c.author_name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 bg-muted/30 rounded-xl p-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold">{c.author_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {user?.id === c.author_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
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

        {/* Comment input */}
        <div className="flex gap-2 items-end">
          <Textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Adicionar comentário..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm rounded-xl border-border/50 bg-muted/20"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleAddComment}
            disabled={!newComment.trim() || addComment.isPending}
            className="shrink-0 h-10 w-10 rounded-xl"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 -ml-2 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>

        <Badge variant="outline" className={cn('text-xs font-semibold', statusColors[task.status])}>
          {statusLabels[task.status]}
        </Badge>

        {/* Prev / Next nav */}
        <div className="flex items-center gap-0.5 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={taskIndex <= 0}
            onClick={() => navigateTask(-1)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={taskIndex >= tasks.length - 1}
            onClick={() => navigateTask(1)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                deleteTask.mutate(task.id);
                goBack();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <h1 className={cn(
        'font-bold tracking-tight mb-5',
        isMobile ? 'text-xl' : 'text-2xl',
        task.status === 'concluido' && 'line-through opacity-60'
      )}>
        {task.title}
      </h1>

      {/* Two-column layout (desktop) / stacked (mobile) */}
      {isMobile ? (
        <div className="space-y-6 pb-bottom-nav">
          {sidebarContent}
          <div className="border-t border-border/40 pt-5">
            {mainContent}
          </div>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            {mainContent}
          </div>
          <aside className="w-72 shrink-0 sticky top-4">
            {sidebarContent}
          </aside>
        </div>
      )}

      <AtividadeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={(input) => {
          handleUpdate(task.id, input);
          setEditOpen(false);
        }}
        initialData={task}
      />
    </PageContainer>
  );
}

function InfoRow({ icon, label, value, danger, muted, extra }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  danger?: boolean;
  muted?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('shrink-0 mt-0.5', danger ? 'text-destructive' : 'text-muted-foreground')}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className={cn('text-sm font-medium', danger && 'text-destructive', muted && 'text-muted-foreground/50')}>{value}</p>
        {extra}
      </div>
    </div>
  );
}
