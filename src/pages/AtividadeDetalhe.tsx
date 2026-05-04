import { useState, useRef } from "react";
import { DeleteTaskDialog } from "@/components/atividades-obra/DeleteTaskDialog";
import { useParams, useNavigate } from "react-router-dom";
import {
  useObraTasks,
  TASK_STATUSES,
  type ObraTaskStatus,
  type ObraTaskInput,
  type ObraTaskPriority,
} from "@/hooks/useObraTasks";
import { useObraTaskComments } from "@/hooks/useObraTaskComments";
import { useObraTaskSubtasks } from "@/hooks/useObraTaskSubtasks";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { AtividadeFormDialog } from "@/components/atividades-obra/AtividadeFormDialog";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Calendar,
  User,
  Clock,
  MessageSquare,
  Send,
  Trash2,
  ArrowRight,
  Pencil,
  MoreHorizontal,
  Plus,
  X,
  Flag,
  CalendarClock,
  CheckSquare,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getMemberName as getMemberNameUtil,
  getInitials as getInitialsUtil,
  priorityConfig,
  statusVariant as statusColors,
  statusDots,
} from "@/lib/taskUtils";

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
};

const QUICK_COMMENTS = [
  { emoji: "🎉", text: "Ficou bom!" },
  { emoji: "👋", text: "Precisa de ajuda?" },
  { emoji: "✅", text: "Concluído!" },
  { emoji: "⚠️", text: "Atenção necessária" },
];

export default function AtividadeDetalhe() {
  const { projectId, taskId } = useParams<{
    projectId: string;
    taskId: string;
  }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { tasks, isLoading, updateTask, deleteTask } = useObraTasks(projectId);
  const task = tasks.find((t) => t.id === taskId);
  const taskIndex = tasks.findIndex((t) => t.id === taskId);
  const {
    comments,
    commentsLoading,
    statusHistory,
    historyLoading,
    addComment,
    deleteComment,
  } = useObraTaskComments(taskId);
  const {
    subtasks,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    completedCount,
    totalCount,
    progress,
  } = useObraTaskSubtasks(taskId);
  const { data: staffUsers = [] } = useStaffUsers();

  const [newComment, setNewComment] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const goBack = () => navigate(`/obra/${projectId}/atividades`);

  const getMemberName = (userId: string | null) =>
    getMemberNameUtil(staffUsers, userId);
  const getInitials = (name: string) => getInitialsUtil(name);

  const handleAddComment = (text?: string) => {
    const content = text || newComment.trim();
    if (!content) return;
    addComment.mutate(content);
    if (!text) setNewComment("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const handleStatusChange = (status: ObraTaskStatus) => {
    if (task) updateTask.mutate({ id: task.id, updates: { status } });
  };

  const handleUpdate = (_id: string, updates: Partial<ObraTaskInput>) => {
    if (task) updateTask.mutate({ id: task.id, updates });
  };

  const handleAssignToMe = () => {
    if (task && user)
      updateTask.mutate({
        id: task.id,
        updates: { responsible_user_id: user.id },
      });
  };

  const handleSaveDescription = () => {
    if (task) {
      updateTask.mutate({
        id: task.id,
        updates: { description: descriptionDraft || null },
      });
      setEditingDescription(false);
    }
  };

  const handleSaveTitle = () => {
    if (task && titleDraft.trim()) {
      updateTask.mutate({ id: task.id, updates: { title: titleDraft.trim() } });
    }
    setEditingTitle(false);
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    addSubtask.mutate(newSubtaskTitle.trim());
    setNewSubtaskTitle("");
    subtaskInputRef.current?.focus();
  };

  const navigateTask = (dir: -1 | 1) => {
    const next = tasks[taskIndex + dir];
    if (next)
      navigate(`/obra/${projectId}/atividades/${next.id}`, { replace: true });
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

  const isOverdue =
    task.due_date &&
    task.status !== "concluido" &&
    task.due_date < new Date().toISOString().slice(0, 10);
  const responsibleName = getMemberName(task.responsible_user_id);
  const creatorName = getMemberName(task.created_by);
  const prio = priorityConfig[task.priority] || priorityConfig.media;

  // ─── SIDEBAR ───────────────────────────────────────────────
  const sidebarContent = (
    <div className="space-y-5">
      {/* Quick status buttons */}
      {task.status !== "concluido" && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Alterar status
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TASK_STATUSES.filter((s) => s.value !== task.status).map((s) => (
              <Button
                key={s.value}
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg gap-1.5"
                onClick={() => handleStatusChange(s.value)}
              >
                <div
                  className={cn("w-2 h-2 rounded-full", statusDots[s.value])}
                />
                {s.value === "concluido" ? "Concluir" : s.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
        <h3 className="text-sm font-bold">Informações</h3>

        {/* Responsável + Atribuir a mim */}
        <div className="flex items-start gap-3">
          <User className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Responsável
            </p>
            {responsibleName ? (
              <div className="flex items-center gap-2 mt-0.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">
                    {getInitials(responsibleName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{responsibleName}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/50">Não atribuído</p>
            )}
            {(!task.responsible_user_id ||
              task.responsible_user_id !== user?.id) && (
              <button
                onClick={handleAssignToMe}
                className="text-xs text-primary hover:underline mt-1 font-medium"
              >
                Atribuir a mim
              </button>
            )}
          </div>
        </div>

        {/* Relator (Reporter) */}
        <div className="flex items-start gap-3">
          <User className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Relator
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {creatorName && (
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">
                    {getInitials(creatorName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="text-sm font-medium">
                {creatorName || "Desconhecido"}
              </span>
            </div>
          </div>
        </div>

        {/* Data limite */}
        <InfoRow
          icon={<Calendar className="h-4 w-4" />}
          label="Data limite"
          value={
            task.due_date
              ? format(new Date(task.due_date + "T00:00:00"), "dd/MM/yyyy", {
                  locale: ptBR,
                })
              : "Nenhum"
          }
          danger={!!isOverdue}
          muted={!task.due_date}
        />

        {/* Data início */}
        <InfoRow
          icon={<CalendarClock className="h-4 w-4" />}
          label="Data início"
          value={
            task.start_date
              ? format(new Date(task.start_date + "T00:00:00"), "dd/MM/yyyy", {
                  locale: ptBR,
                })
              : "Nenhum"
          }
          muted={!task.start_date}
        />

        {/* Prioridade */}
        <div className="flex items-start gap-3">
          <Flag className={cn("h-4 w-4 shrink-0 mt-0.5", prio.color)} />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Prioridade
            </p>
            <Select
              value={task.priority}
              onValueChange={(v) =>
                handleUpdate(task.id, { priority: v as ObraTaskPriority })
              }
            >
              <SelectTrigger className="h-7 w-auto border-0 p-0 focus:ring-0 shadow-none">
                <span
                  className={cn(
                    "text-sm font-medium flex items-center gap-1.5",
                    prio.color,
                  )}
                >
                  <span>{prio.icon}</span> {prio.label}
                </span>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(priorityConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span
                      className={cn("flex items-center gap-1.5", cfg.color)}
                    >
                      <span>{cfg.icon}</span> {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custo */}
        {task.cost != null && (
          <InfoRow
            icon={
              <span className="text-xs font-bold text-muted-foreground">
                R$
              </span>
            }
            label="Custo"
            value={`R$ ${task.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          />
        )}

        {/* Conclusão */}
        {task.status === "concluido" && task.completed_at && (
          <InfoRow
            icon={<Clock className="h-4 w-4" />}
            label="Concluído em"
            value={format(new Date(task.completed_at), "dd/MM/yyyy", {
              locale: ptBR,
            })}
            extra={
              task.days_overdue != null ? (
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    task.days_overdue > 0
                      ? "text-destructive"
                      : "text-green-600",
                  )}
                >
                  {task.days_overdue > 0
                    ? `${task.days_overdue}d atraso`
                    : task.days_overdue === 0
                      ? "No prazo"
                      : `${Math.abs(task.days_overdue)}d antecipado`}
                </span>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );

  // ─── MAIN CONTENT ──────────────────────────────────────────
  const mainContent = (
    <div className="space-y-6">
      {/* ── Description (inline editable) ── */}
      <section>
        <h3 className="text-sm font-bold mb-2">Descrição</h3>
        {editingDescription ? (
          <div className="space-y-2">
            <Textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              placeholder="Adicione uma descrição detalhada..."
              className="min-h-[100px] text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveDescription}>
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingDescription(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setDescriptionDraft(task.description || "");
              setEditingDescription(true);
            }}
            className={cn(
              "w-full text-left rounded-lg p-3 min-h-[60px] transition-colors border border-transparent",
              "hover:bg-muted/40 hover:border-border/50",
              task.description
                ? "text-sm text-foreground"
                : "text-sm text-muted-foreground/50 italic",
            )}
          >
            {task.description ? (
              <p className="whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            ) : (
              "Editar descrição"
            )}
          </button>
        )}
      </section>

      {/* ── Subtarefas (Checklist) ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            Subtarefas
            {totalCount > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 font-bold"
              >
                {completedCount}/{totalCount}
              </Badge>
            )}
          </h3>
          {!showSubtaskInput && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                setShowSubtaskInput(true);
                setTimeout(() => subtaskInputRef.current?.focus(), 50);
              }}
            >
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          )}
        </div>

        {totalCount > 0 && <Progress value={progress} className="h-1.5 mb-3" />}

        <div className="space-y-1">
          {subtasks.map((st) => (
            <div
              key={st.id}
              className="flex items-center gap-2 group rounded-lg px-2 py-1.5 hover:bg-muted/30 transition-colors"
            >
              <Checkbox
                checked={st.completed}
                onCheckedChange={(checked) =>
                  toggleSubtask.mutate({ id: st.id, completed: !!checked })
                }
                className="shrink-0"
              />
              <span
                className={cn(
                  "text-sm flex-1 min-w-0 truncate",
                  st.completed && "line-through text-muted-foreground",
                )}
              >
                {st.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => deleteSubtask.mutate(st.id)}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        {showSubtaskInput && (
          <div className="flex gap-2 mt-2">
            <Input
              ref={subtaskInputRef}
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Adicionar subtarefa..."
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSubtask();
                if (e.key === "Escape") {
                  setShowSubtaskInput(false);
                  setNewSubtaskTitle("");
                }
              }}
            />
            <Button
              size="sm"
              className="h-8 px-3"
              onClick={handleAddSubtask}
              disabled={!newSubtaskTitle.trim()}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => {
                setShowSubtaskInput(false);
                setNewSubtaskTitle("");
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {totalCount === 0 && !showSubtaskInput && (
          <button
            onClick={() => {
              setShowSubtaskInput(true);
              setTimeout(() => subtaskInputRef.current?.focus(), 50);
            }}
            className="text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors italic"
          >
            Adicionar subtarefa
          </button>
        )}
      </section>

      {/* ── History (collapsible) ── */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 touch-target">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Histórico
            {statusHistory.length > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 font-bold"
              >
                {statusHistory.length}
              </Badge>
            )}
          </h3>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              historyOpen && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : statusHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center">
              Nenhuma mudança registrada.
            </p>
          ) : (
            <div className="relative">
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-2.5">
                {statusHistory.map((h) => (
                  <div key={h.id} className="flex items-start gap-3 relative">
                    <div
                      className={cn(
                        "w-[19px] h-[19px] rounded-full border-2 border-background shrink-0 mt-0.5 z-10",
                        statusDots[h.new_status] || "bg-muted-foreground",
                      )}
                    />
                    <div className="flex-1 min-w-0 bg-card rounded-lg border border-border/40 p-2">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {h.old_status && (
                          <>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 h-4",
                                statusColors[h.old_status] || "",
                              )}
                            >
                              {statusLabels[h.old_status] || h.old_status}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-4",
                            statusColors[h.new_status] || "",
                          )}
                        >
                          {statusLabels[h.new_status] || h.new_status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {h.changed_by_name || "Sistema"} ·{" "}
                        {format(new Date(h.created_at), "dd/MM 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ── Comments ── */}
      <section>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Comentários
          {comments.length > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-bold"
            >
              {comments.length}
            </Badge>
          )}
        </h3>

        {commentsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center mb-3">
            Nenhum comentário. Seja o primeiro!
          </p>
        ) : (
          <div className="space-y-2.5 mb-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2 group">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                    {getInitials(c.author_name || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 bg-muted/30 rounded-xl p-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold">
                      {c.author_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(c.created_at), "dd/MM 'às' HH:mm", {
                        locale: ptBR,
                      })}
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
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {c.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment input + quick suggestions */}
        <div className="space-y-2">
          <div className="flex gap-2 items-end">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Adicionar comentário..."
              className="min-h-[40px] max-h-[100px] resize-none text-sm rounded-xl border-border/50 bg-muted/20"
              rows={1}
            />
            <Button
              size="icon"
              onClick={() => handleAddComment()}
              disabled={!newComment.trim() || addComment.isPending}
              className="shrink-0 h-10 w-10 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {QUICK_COMMENTS.map((qc) => (
              <button
                key={qc.text}
                onClick={() => handleAddComment(`${qc.emoji} ${qc.text}`)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0"
              >
                <span>{qc.emoji}</span>
                <span>{qc.text}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="gap-1 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>

        <Badge
          variant="outline"
          className={cn("text-xs font-semibold", statusColors[task.status])}
        >
          {statusLabels[task.status]}
        </Badge>

        {/* Prev / Next */}
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
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title — inline editable */}
      {editingTitle ? (
        <div className="mb-5">
          <Input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            className={cn(
              "font-bold tracking-tight border-0 border-b-2 border-primary/40 rounded-none px-0 focus-visible:ring-0 bg-transparent",
              isMobile ? "text-xl h-auto" : "text-2xl h-auto",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTitle();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            onBlur={handleSaveTitle}
            autoFocus
          />
        </div>
      ) : (
        <h1
          className={cn(
            "font-bold tracking-tight mb-5 cursor-text rounded-lg px-1 -mx-1 transition-colors hover:bg-muted/40",
            isMobile ? "text-xl" : "text-2xl",
            task.status === "concluido" && "line-through opacity-60",
          )}
          onClick={() => {
            setTitleDraft(task.title);
            setEditingTitle(true);
          }}
          title="Clique para editar"
        >
          {task.title}
        </h1>
      )}

      {/* Two-column (desktop) / stacked (mobile) */}
      {isMobile ? (
        <div className="space-y-6 pb-bottom-nav">
          {sidebarContent}
          <div className="border-t border-border/40 pt-5">{mainContent}</div>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">{mainContent}</div>
          <aside className="w-72 shrink-0 sticky top-4">{sidebarContent}</aside>
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
        draftScope={projectId}
      />

      <DeleteTaskDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        taskTitle={task.title}
        onConfirm={() => {
          deleteTask
            .mutateAsync(task.id)
            .then(goBack)
            .catch(() => {});
        }}
      />
    </PageContainer>
  );
}

function InfoRow({
  icon,
  label,
  value,
  danger,
  muted,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  danger?: boolean;
  muted?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "shrink-0 mt-0.5",
          danger ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </p>
        <p
          className={cn(
            "text-sm font-medium",
            danger && "text-destructive",
            muted && "text-muted-foreground/50",
          )}
        >
          {value}
        </p>
        {extra}
      </div>
    </div>
  );
}
