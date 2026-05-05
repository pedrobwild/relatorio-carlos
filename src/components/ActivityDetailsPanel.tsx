import { useMemo } from "react";
import {
  X,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  GitBranch,
  Percent,
  FileText,
  Layers,
} from "lucide-react";
import { Activity } from "@/types/report";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { parseLocalDate } from "@/lib/activityStatus";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityDetailsPanelProps {
  activity: Activity | null;
  activities: Activity[];
  onClose: () => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<
    string,
    { icon: typeof CheckCircle2; label: string; className: string }
  > = {
    completed: {
      icon: CheckCircle2,
      label: "Concluído",
      className: "bg-success/10 text-success border-success/30",
    },
    delayed: {
      icon: AlertTriangle,
      label: "Atrasado",
      className: "bg-destructive/10 text-destructive border-destructive/30",
    },
    "in-progress": {
      icon: Clock,
      label: "Em andamento",
      className: "bg-info/10 text-info border-info/30",
    },
    pending: {
      icon: Clock,
      label: "Pendente",
      className: "bg-muted text-muted-foreground border-border",
    },
  };

  const { icon: Icon, label, className } = config[status] || config.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};

const _formatDateFull = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  const date = parseLocalDate(dateStr);
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
};

const formatDateShort = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  const date = parseLocalDate(dateStr);
  return format(date, "dd/MM/yyyy");
};

const ActivityDetailsPanel = ({
  activity,
  activities,
  onClose,
}: ActivityDetailsPanelProps) => {
  const today = useMemo(() => new Date(), []);

  const computed = useMemo(() => {
    if (!activity) return null;

    const hasActualStart = !!activity.actualStart;
    const hasActualEnd = !!activity.actualEnd;
    const plannedStart = parseLocalDate(activity.plannedStart);
    const plannedEnd = parseLocalDate(activity.plannedEnd);
    const actualStart = activity.actualStart
      ? parseLocalDate(activity.actualStart)
      : null;
    const actualEnd = activity.actualEnd
      ? parseLocalDate(activity.actualEnd)
      : null;

    // Calculate status
    let status: "completed" | "in-progress" | "delayed" | "pending" = "pending";
    let progress = 0;

    if (hasActualEnd) {
      status = "completed";
      progress = 100;
    } else if (hasActualStart && actualStart) {
      status = today > plannedEnd ? "delayed" : "in-progress";
      const totalPlanned = differenceInDays(plannedEnd, actualStart) + 1;
      const elapsed = differenceInDays(today, actualStart) + 1;
      progress = Math.min(
        100,
        Math.max(0, Math.round((elapsed / Math.max(totalPlanned, 1)) * 100)),
      );
    } else {
      status = today > plannedStart ? "delayed" : "pending";
      progress = 0;
    }

    // Calculate delays
    let delayDays = 0;
    if (hasActualEnd && actualEnd) {
      delayDays = differenceInDays(actualEnd, plannedEnd);
    } else if (hasActualStart && today > plannedEnd) {
      delayDays = differenceInDays(today, plannedEnd);
    }

    // Duration calculations
    const plannedDuration = differenceInDays(plannedEnd, plannedStart) + 1;
    const actualDuration =
      hasActualEnd && actualStart && actualEnd
        ? differenceInDays(actualEnd, actualStart) + 1
        : hasActualStart && actualStart
          ? differenceInDays(today, actualStart) + 1
          : null;

    return {
      status,
      progress,
      delayDays,
      plannedDuration,
      actualDuration,
      hasActualStart,
      hasActualEnd,
      plannedStart,
      plannedEnd,
      actualStart,
      actualEnd,
    };
  }, [activity, today]);

  // Get predecessor activities
  const predecessors = useMemo(() => {
    if (!activity?.predecessorIds || activity.predecessorIds.length === 0)
      return [];
    return activities.filter((a) =>
      activity.predecessorIds?.includes(a.id || ""),
    );
  }, [activity, activities]);

  // Get successor activities (activities that depend on this one)
  const successors = useMemo(() => {
    if (!activity?.id) return [];
    return activities.filter((a) =>
      a.predecessorIds?.includes(activity.id || ""),
    );
  }, [activity, activities]);

  if (!activity || !computed) {
    return null;
  }

  const activityIndex = activities.findIndex((a) => a.id === activity.id) + 1;

  return (
    <div className="bg-card border-l border-border h-full flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-primary text-primary-foreground shrink-0">
                {activityIndex}
              </span>
              <StatusBadge status={computed.status} />
            </div>
            <h3 className="font-semibold text-foreground leading-snug">
              {activity.description}
            </h3>
            {activity.etapa && (
              <span className="inline-flex mt-1 px-2 py-0.5 text-[10px] font-medium rounded bg-accent text-accent-foreground">
                <Layers className="w-3 h-3 mr-1" />
                {activity.etapa}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 -mt-1 -mr-1"
            onClick={onClose}
            aria-label="Fechar detalhes da atividade"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Detailed Description */}
        {activity.detailed_description?.trim() && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <FileText className="w-4 h-4 text-primary" />
              Descrição
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-secondary/30 rounded-lg p-3">
              {activity.detailed_description}
            </p>
          </div>
        )}

        {/* Progress */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
            <Percent className="w-4 h-4 text-primary" />
            Progresso
          </div>
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-foreground">
                {computed.progress}%
              </span>
              <span className="text-xs text-muted-foreground">
                Peso: {activity.weight || 0}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  computed.status === "completed"
                    ? "bg-success"
                    : computed.status === "delayed"
                      ? "bg-destructive"
                      : computed.status === "in-progress"
                        ? "bg-info"
                        : "bg-muted-foreground",
                )}
                style={{ width: `${computed.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Delay Alert */}
        {computed.delayDays > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">
                {computed.delayDays} {computed.delayDays === 1 ? "dia" : "dias"}{" "}
                de atraso
              </p>
              <p className="text-xs text-destructive/80 mt-0.5">
                {computed.hasActualEnd
                  ? "Concluído após o prazo previsto"
                  : "Em andamento além do prazo previsto"}
              </p>
            </div>
          </div>
        )}

        {/* Ahead of schedule */}
        {computed.delayDays < 0 && (
          <div className="bg-success/10 border border-success/30 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-success">
                {Math.abs(computed.delayDays)}{" "}
                {Math.abs(computed.delayDays) === 1 ? "dia" : "dias"} adiantado
              </p>
              <p className="text-xs text-success/80 mt-0.5">
                Concluído antes do prazo previsto
              </p>
            </div>
          </div>
        )}

        <Separator />

        {/* Dates - Planned */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            Datas Previstas
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                Início
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formatDateShort(activity.plannedStart)}
              </p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                Término
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formatDateShort(activity.plannedEnd)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Duração prevista:{" "}
            <span className="font-medium">
              {computed.plannedDuration}{" "}
              {computed.plannedDuration === 1 ? "dia" : "dias"}
            </span>
          </p>
        </div>

        {/* Dates - Actual */}
        {computed.hasActualStart && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
              <Clock className="w-4 h-4 text-primary" />
              Datas Reais
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  Início
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatDateShort(activity.actualStart)}
                </p>
              </div>
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  Término
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {computed.hasActualEnd
                    ? formatDateShort(activity.actualEnd)
                    : "Em andamento"}
                </p>
              </div>
            </div>
            {computed.actualDuration && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Duração real:{" "}
                <span className="font-medium">
                  {computed.actualDuration}{" "}
                  {computed.actualDuration === 1 ? "dia" : "dias"}
                </span>
                {computed.hasActualEnd &&
                  computed.actualDuration !== computed.plannedDuration && (
                    <span
                      className={cn(
                        "ml-1",
                        computed.actualDuration > computed.plannedDuration
                          ? "text-destructive"
                          : "text-success",
                      )}
                    >
                      (
                      {computed.actualDuration > computed.plannedDuration
                        ? "+"
                        : ""}
                      {computed.actualDuration - computed.plannedDuration}d)
                    </span>
                  )}
              </p>
            )}
          </div>
        )}

        <Separator />

        {/* Predecessors */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
            <GitBranch className="w-4 h-4 text-primary" />
            Dependências
          </div>

          {predecessors.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Predecessores ({predecessors.length})
              </p>
              {predecessors.map((pred, idx) => {
                const predIndex =
                  activities.findIndex((a) => a.id === pred.id) + 1;
                return (
                  <div
                    key={pred.id || idx}
                    className="bg-secondary/50 rounded-lg p-2.5 flex items-center gap-2"
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground shrink-0">
                      {predIndex}
                    </span>
                    <span className="text-xs text-foreground truncate">
                      {pred.description}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Nenhum predecessor
            </p>
          )}

          {successors.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Sucessores ({successors.length})
              </p>
              {successors.map((succ, idx) => {
                const succIndex =
                  activities.findIndex((a) => a.id === succ.id) + 1;
                return (
                  <div
                    key={succ.id || idx}
                    className="bg-secondary/50 rounded-lg p-2.5 flex items-center gap-2"
                  >
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground shrink-0">
                      {succIndex}
                    </span>
                    <span className="text-xs text-foreground truncate">
                      {succ.description}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Baseline comparison if available */}
        {(activity.baselineStart || activity.baselineEnd) && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Baseline Original
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                    Início
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateShort(activity.baselineStart)}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                    Término
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateShort(activity.baselineEnd)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityDetailsPanel;
