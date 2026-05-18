/**
 * WeekActionsList — lista de ações da semana dentro do registro do
 * Painel de Obras. Auto-save por linha (criar/editar/concluir/excluir
 * vão direto ao banco). Disponível só após o registro ter sido salvo
 * (precisa de daily_log_id).
 *
 * Espelha o padrão de ServiceTasksList — mas vinculado ao registro da
 * semana inteiro, não a um serviço específico.
 */
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock,
  ListChecks,
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
  useDailyLogActions,
  DAILY_LOG_ACTION_STATUS_OPTIONS,
  type DailyLogAction,
  type DailyLogActionStatus,
} from "@/hooks/useDailyLogActions";
import { useStaffUsers } from "@/hooks/useStaffUsers";

const NONE = "__none__";

const statusIcon = (s: DailyLogActionStatus) => {
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

const statusBadgeClass = (s: DailyLogActionStatus): string => {
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

type DueUrgency = "overdue" | "today" | "soon" | "normal" | "none";

function getDueUrgency(
  dueDate: string | null,
  status: DailyLogActionStatus,
): { level: DueUrgency; label: string } {
  if (!dueDate || status === "concluido" || status === "cancelado") {
    return { level: "none", label: "" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseISO(dueDate);
  const diff = differenceInCalendarDays(due, today);
  if (diff < 0)
    return {
      level: "overdue",
      label: `Atrasada ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dia" : "dias"}`,
    };
  if (diff === 0) return { level: "today", label: "Vence hoje" };
  if (diff <= 2)
    return {
      level: "soon",
      label: `Vence em ${diff} ${diff === 1 ? "dia" : "dias"}`,
    };
  return { level: "normal", label: `Vence em ${diff} dias` };
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
  dailyLogId: string | null;
}

export function WeekActionsList({ dailyLogId }: Props) {
  const {
    actions,
    isLoading,
    addAction,
    updateAction,
    deleteAction,
    completedCount,
    totalCount,
    progress,
  } = useDailyLogActions(dailyLogId);
  const { data: staffUsers = [] } = useStaffUsers();
  const [newTitle, setNewTitle] = useState("");

  if (!dailyLogId) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground italic">
        Salve o registro da semana para começar a adicionar ações.
      </div>
    );
  }

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    addAction.mutate({ title });
    setNewTitle("");
  };

  const overdue = actions.filter(
    (a) => getDueUrgency(a.due_date, a.status).level === "overdue",
  ).length;
  const dueToday = actions.filter(
    (a) => getDueUrgency(a.due_date, a.status).level === "today",
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {totalCount > 0 && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[10px] tabular-nums"
            >
              {completedCount}/{totalCount}
            </Badge>
          )}
          {overdue > 0 && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[10px] tabular-nums gap-0.5 bg-destructive/10 text-destructive border-destructive/30"
              title={`${overdue} ação${overdue > 1 ? "ões" : ""} com prazo vencido`}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {overdue} atrasada{overdue > 1 ? "s" : ""}
            </Badge>
          )}
          {dueToday > 0 && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[10px] tabular-nums gap-0.5 bg-warning/10 text-warning border-warning/30"
              title={`${dueToday} ação${dueToday > 1 ? "ões" : ""} vence${dueToday > 1 ? "m" : ""} hoje`}
            >
              <Clock className="h-2.5 w-2.5" />
              {dueToday} hoje
            </Badge>
          )}
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-1.5 flex-1 max-w-[140px]">
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
        <Skeleton className="h-16 w-full" />
      ) : (
        <>
          {actions.length > 0 && (
            <div className="space-y-1">
              {actions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  staffUsers={staffUsers}
                  onUpdate={(updates) =>
                    updateAction.mutate({ id: action.id, updates })
                  }
                  onDelete={() => deleteAction.mutate(action.id)}
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
              placeholder="Adicionar ação (ex.: Cobrar laudo elétrico do fornecedor)"
              className="h-8 text-xs flex-1"
              disabled={addAction.isPending}
              aria-label="Descrição da nova ação"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAdd}
              disabled={!newTitle.trim() || addAction.isPending}
              className="h-8 px-2.5 text-xs shrink-0"
            >
              {addAction.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface ActionRowProps {
  action: DailyLogAction;
  staffUsers: { id: string; nome: string; email: string; perfil: string }[];
  onUpdate: (updates: Partial<DailyLogAction>) => void;
  onDelete: () => void;
}

function ActionRow({ action, staffUsers, onUpdate, onDelete }: ActionRowProps) {
  const [title, setTitle] = useState(action.title);
  const isCompleted = action.status === "concluido";
  const isCancelled = action.status === "cancelado";

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== action.title) {
      onUpdate({ title: trimmed });
    } else if (!trimmed) {
      setTitle(action.title);
    }
  };

  return (
    <div
      className={cn(
        "group flex flex-wrap sm:flex-nowrap items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 transition-colors",
        isCompleted && "bg-success/5",
        isCancelled && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() =>
          onUpdate({ status: isCompleted ? "pendente" : "concluido" })
        }
        className="shrink-0 hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
        title={isCompleted ? "Marcar como pendente" : "Marcar como concluída"}
        aria-label={
          isCompleted ? "Marcar como pendente" : "Marcar como concluída"
        }
      >
        {statusIcon(action.status)}
      </button>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setTitle(action.title);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "h-7 border-0 bg-transparent px-1 text-xs flex-1 min-w-[160px] focus-visible:ring-1 focus-visible:bg-background",
          isCompleted && "line-through text-muted-foreground",
        )}
        aria-label="Descrição da ação"
      />

      <Select
        value={action.responsible_user_id ?? NONE}
        onValueChange={(v) =>
          onUpdate({ responsible_user_id: v === NONE ? null : v })
        }
      >
        <SelectTrigger
          className="h-7 w-[120px] text-[11px] px-1.5 shrink-0"
          aria-label="Responsável"
        >
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={NONE}>Sem responsável</SelectItem>
          {staffUsers.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.nome || u.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(() => {
        const urgency = getDueUrgency(action.due_date, action.status);
        const showAlert =
          urgency.level === "overdue" || urgency.level === "today";
        const dateLabel = action.due_date
          ? format(parseISO(action.due_date), "dd/MM/yyyy", { locale: ptBR })
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
                    ? "text-destructive animate-pulse"
                    : "text-warning",
                )}
                aria-label={urgency.label}
              />
            )}
            <Input
              type="date"
              value={action.due_date ?? ""}
              onChange={(e) => onUpdate({ due_date: e.target.value || null })}
              className={cn(
                "h-7 w-[130px] text-[11px] px-1.5 tabular-nums transition-colors",
                dueInputClass(urgency.level),
              )}
              aria-label={`Prazo. ${fullTitle}`}
            />
          </div>
        );
      })()}

      <Select
        value={action.status}
        onValueChange={(v) => onUpdate({ status: v as DailyLogActionStatus })}
      >
        <SelectTrigger
          className={cn(
            "h-7 w-[120px] text-[11px] px-1.5 shrink-0 border",
            statusBadgeClass(action.status),
          )}
          aria-label="Status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {DAILY_LOG_ACTION_STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onDelete}
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 transition-opacity"
        title="Remover ação"
        aria-label="Remover ação"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
