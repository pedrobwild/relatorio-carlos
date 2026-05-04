/**
 * ServiceTasksList — lista de tarefas de um serviço em execução
 * (dentro do registro diário no Painel de Obras).
 *
 * Auto-save por linha: cada edição vai direto ao banco.
 * Disponível somente após o serviço ter sido salvo (ter um id).
 */
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock,
  ListTodo,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  useDailyLogServiceTasks,
  SERVICE_TASK_STATUS_OPTIONS,
  type ServiceTask,
  type ServiceTaskStatus,
} from "@/hooks/useDailyLogServiceTasks";
import { useStaffUsers } from "@/hooks/useStaffUsers";

const NONE = "__none__";

const statusIcon = (s: ServiceTaskStatus) => {
  switch (s) {
    case "concluido":
      return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    case "em_andamento":
      return <CircleDashed className="h-3.5 w-3.5 text-info animate-pulse" />;
    case "cancelado":
      return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
};

const statusBadgeClass = (s: ServiceTaskStatus): string => {
  switch (s) {
    case "concluido":
      return "bg-success/10 text-success border-success/25";
    case "em_andamento":
      return "bg-info/10 text-info border-info/25";
    case "cancelado":
      return "bg-muted text-muted-foreground border-border line-through";
    default:
      return "bg-warning/10 text-warning border-warning/25";
  }
};

// ----- urgência de prazo -----

type DueUrgency = "overdue" | "today" | "soon" | "normal" | "none";

/** Avalia o prazo da tarefa. Tarefas concluídas/canceladas nunca alertam. */
function getDueUrgency(
  dueDate: string | null,
  status: ServiceTaskStatus,
): { level: DueUrgency; daysDiff: number | null; label: string } {
  if (!dueDate || status === "concluido" || status === "cancelado") {
    return { level: "none", daysDiff: null, label: "" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseISO(dueDate);
  const diff = differenceInCalendarDays(due, today);
  if (diff < 0) {
    return {
      level: "overdue",
      daysDiff: diff,
      label: `Atrasado ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dia" : "dias"}`,
    };
  }
  if (diff === 0) return { level: "today", daysDiff: 0, label: "Vence hoje" };
  if (diff <= 2)
    return {
      level: "soon",
      daysDiff: diff,
      label: `Vence em ${diff} ${diff === 1 ? "dia" : "dias"}`,
    };
  return { level: "normal", daysDiff: diff, label: `Vence em ${diff} dias` };
}

const dueInputClass = (level: DueUrgency): string => {
  switch (level) {
    case "overdue":
      return "border-destructive bg-destructive/10 text-destructive font-medium";
    case "today":
      return "border-warning bg-warning/10 text-warning font-medium";
    case "soon":
      return "border-warning/50 bg-warning/5 text-warning";
    default:
      return "";
  }
};

interface Props {
  serviceId: string | null | undefined;
  serviceSaved: boolean;
}

export function ServiceTasksList({ serviceId, serviceSaved }: Props) {
  const {
    tasks,
    isLoading,
    addTask,
    updateTask,
    deleteTask,
    completedCount,
    totalCount,
    progress,
  } = useDailyLogServiceTasks(serviceSaved ? serviceId : null);
  const { data: staffUsers = [] } = useStaffUsers();
  const [newTitle, setNewTitle] = useState("");

  if (!serviceSaved) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground italic">
        Salve o registro da semana para começar a adicionar tarefas a este
        serviço.
      </div>
    );
  }

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    addTask.mutate({ title });
    setNewTitle("");
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <ListTodo className="h-3.5 w-3.5 text-primary" />
          Tarefas
          {totalCount > 0 && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[10px] tabular-nums"
            >
              {completedCount}/{totalCount}
            </Badge>
          )}
          {(() => {
            const overdue = tasks.filter(
              (t) => getDueUrgency(t.due_date, t.status).level === "overdue",
            ).length;
            const today = tasks.filter(
              (t) => getDueUrgency(t.due_date, t.status).level === "today",
            ).length;
            return (
              <>
                {overdue > 0 && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[10px] tabular-nums gap-0.5 bg-destructive/10 text-destructive border-destructive/30"
                    title={`${overdue} tarefa${overdue > 1 ? "s" : ""} com prazo vencido`}
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {overdue} atrasada{overdue > 1 ? "s" : ""}
                  </Badge>
                )}
                {today > 0 && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[10px] tabular-nums gap-0.5 bg-warning/10 text-warning border-warning/30"
                    title={`${today} tarefa${today > 1 ? "s" : ""} vence${today > 1 ? "m" : ""} hoje`}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {today} hoje
                  </Badge>
                )}
              </>
            );
          })()}
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-1.5 flex-1 max-w-[120px]">
            <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
              {progress}%
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        <>
          {tasks.length > 0 && (
            <div className="space-y-1">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  staffUsers={staffUsers}
                  onUpdate={(updates) =>
                    updateTask.mutate({ id: task.id, updates })
                  }
                  onDelete={() => deleteTask.mutate(task.id)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Adicionar tarefa (ex.: Confirmar prazo de entrega com fornecedor)"
              className="h-7 text-xs flex-1"
              disabled={addTask.isPending}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAdd}
              disabled={!newTitle.trim() || addTask.isPending}
              className="h-7 px-2 text-xs shrink-0"
            >
              {addTask.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ----- linha de tarefa -----

interface TaskRowProps {
  task: ServiceTask;
  staffUsers: { id: string; nome: string; email: string; perfil: string }[];
  onUpdate: (updates: Partial<ServiceTask>) => void;
  onDelete: () => void;
}

function TaskRow({ task, staffUsers, onUpdate, onDelete }: TaskRowProps) {
  const [title, setTitle] = useState(task.title);
  const isCompleted = task.status === "concluido";
  const isCancelled = task.status === "cancelado";

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed });
    } else if (!trimmed) {
      setTitle(task.title);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 transition-colors",
        isCompleted && "bg-success/5",
        isCancelled && "opacity-60",
      )}
    >
      {/* Toggle conclusão */}
      <button
        type="button"
        onClick={() =>
          onUpdate({ status: isCompleted ? "pendente" : "concluido" })
        }
        className="shrink-0 hover:scale-110 transition-transform"
        title={isCompleted ? "Marcar como pendente" : "Marcar como concluído"}
        aria-label={
          isCompleted ? "Marcar como pendente" : "Marcar como concluído"
        }
      >
        {statusIcon(task.status)}
      </button>

      {/* Título inline-editável */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setTitle(task.title);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "h-6 border-0 bg-transparent px-1 text-xs flex-1 min-w-0 focus-visible:ring-1 focus-visible:bg-background",
          isCompleted && "line-through text-muted-foreground",
        )}
      />

      {/* Responsável */}
      <Select
        value={task.responsible_user_id ?? NONE}
        onValueChange={(v) =>
          onUpdate({ responsible_user_id: v === NONE ? null : v })
        }
      >
        <SelectTrigger className="h-6 w-[100px] text-[11px] px-1.5 shrink-0">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={NONE}>Sem responsável</SelectItem>
          {staffUsers.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Prazo (com indicador de urgência) */}
      {(() => {
        const urgency = getDueUrgency(task.due_date, task.status);
        const showAlert =
          urgency.level === "overdue" || urgency.level === "today";
        const dateLabel = task.due_date
          ? format(parseISO(task.due_date), "dd/MM/yyyy", { locale: ptBR })
          : "Sem prazo";
        const fullTitle = urgency.label
          ? `${dateLabel} — ${urgency.label}`
          : dateLabel;
        return (
          <div className="relative shrink-0" title={fullTitle}>
            {showAlert && (
              <AlertTriangle
                className={cn(
                  "absolute -left-1 -top-1 h-3 w-3 z-10 pointer-events-none",
                  urgency.level === "overdue"
                    ? "text-destructive"
                    : "text-warning",
                  urgency.level === "overdue" && "animate-pulse",
                )}
                aria-label={urgency.label}
              />
            )}
            <Input
              type="date"
              value={task.due_date ?? ""}
              onChange={(e) => onUpdate({ due_date: e.target.value || null })}
              className={cn(
                "h-6 w-[110px] text-[11px] px-1.5 tabular-nums transition-colors",
                dueInputClass(urgency.level),
              )}
              aria-label={fullTitle}
            />
          </div>
        );
      })()}

      {/* Status */}
      <Select
        value={task.status}
        onValueChange={(v) => onUpdate({ status: v as ServiceTaskStatus })}
      >
        <SelectTrigger
          className={cn(
            "h-6 w-[110px] text-[11px] px-1.5 shrink-0 border",
            statusBadgeClass(task.status),
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {SERVICE_TASK_STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Excluir */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onDelete}
        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remover tarefa"
        aria-label="Remover tarefa"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
