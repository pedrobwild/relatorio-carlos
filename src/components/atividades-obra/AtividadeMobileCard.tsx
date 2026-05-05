import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Calendar,
  User,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TASK_STATUSES, type ObraTask, type ObraTaskStatus, type ObraTaskInput } from "@/hooks/useObraTasks";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Props {
  task: ObraTask;
  responsibleName: string | null;
  onUpdateStatus: (id: string, status: ObraTaskStatus) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (task: ObraTask) => void;
  onEdit: (task: ObraTask) => void;
}

const statusConfig: Record<
  ObraTaskStatus,
  { dot: string; bg: string; label: string }
> = {
  pendente: { dot: "bg-yellow-500", bg: "bg-yellow-500/10", label: "Pendente" },
  em_andamento: {
    dot: "bg-blue-500",
    bg: "bg-blue-500/10",
    label: "Em andamento",
  },
  pausado: { dot: "bg-orange-500", bg: "bg-orange-500/10", label: "Pausado" },
  concluido: { dot: "bg-green-500", bg: "bg-green-500/10", label: "Concluído" },
};

export function AtividadeMobileCard({
  task,
  responsibleName,
  onUpdateStatus,
  onDelete,
  onOpenDetail,
  onEdit,
}: Props) {
  const config = statusConfig[task.status];
  const isOverdue =
    task.due_date &&
    task.status !== "concluido" &&
    task.due_date < new Date().toISOString().slice(0, 10);
  const isDone = task.status === "concluido";

  // Next logical status for quick action
  const nextStatus = (): ObraTaskStatus | null => {
    switch (task.status) {
      case "pendente":
        return "em_andamento";
      case "em_andamento":
        return "concluido";
      case "pausado":
        return "em_andamento";
      default:
        return null;
    }
  };

  const next = nextStatus();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
    >
      <div
        className={cn(
          "relative rounded-xl border border-border/50 bg-card transition-all active:scale-[0.98]",
          isDone && "opacity-60",
        )}
      >
        {/* Status indicator bar */}
        <div
          className={cn(
            "absolute left-0 top-3 bottom-3 w-1 rounded-full",
            config.dot,
          )}
        />

        <div className="pl-4 pr-2 py-3">
          {/* Row 1: Title + menu */}
          <div className="flex items-start gap-2">
            <button
              className="flex-1 min-w-0 text-left touch-target"
              onClick={() => onOpenDetail(task)}
            >
              <span
                className={cn(
                  "text-sm font-semibold leading-snug line-clamp-2",
                  isDone && "line-through",
                )}
              >
                {task.title}
              </span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 -mr-1 rounded-lg"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {TASK_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onClick={() => onUpdateStatus(task.id, s.value)}
                    className={cn(task.status === s.value && "font-bold")}
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full mr-2",
                        statusConfig[s.value].dot,
                      )}
                    />
                    {s.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(task.id)}
                >
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row 2: Meta chips */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {responsibleName && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5">
                <User className="h-3 w-3" /> {responsibleName}
              </span>
            )}
            {task.due_date && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] rounded-md px-1.5 py-0.5",
                  isOverdue
                    ? "bg-destructive/10 text-destructive font-semibold"
                    : "bg-muted/50 text-muted-foreground",
                )}
              >
                {isOverdue && <AlertTriangle className="h-3 w-3" />}
                {!isOverdue && <Calendar className="h-3 w-3" />}
                {format(new Date(task.due_date + "T00:00:00"), "dd/MM", {
                  locale: ptBR,
                })}
              </span>
            )}
            {isDone && task.days_overdue != null && (
              <span
                className={cn(
                  "text-[11px] font-semibold px-1.5 py-0.5 rounded-md",
                  task.days_overdue > 0
                    ? "bg-destructive/10 text-destructive"
                    : "bg-green-500/10 text-green-600",
                )}
              >
                {task.days_overdue > 0
                  ? `${task.days_overdue}d atraso`
                  : task.days_overdue === 0
                    ? "✓ Prazo"
                    : `✓ ${Math.abs(task.days_overdue)}d antes`}
              </span>
            )}
          </div>

          {/* Row 3: Quick action + detail arrow */}
          <div className="flex items-center gap-2 mt-2.5">
            {next && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg gap-1.5 flex-1 max-w-[200px] font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(task.id, next);
                }}
              >
                <div
                  className={cn("w-2 h-2 rounded-full", statusConfig[next].dot)}
                />
                {next === "concluido" ? "Concluir" : statusConfig[next].label}
              </Button>
            )}
            <button
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors touch-target justify-end"
              onClick={() => onOpenDetail(task)}
            >
              Detalhes <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
