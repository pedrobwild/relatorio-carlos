import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Circle,
  ClipboardList,
  Box,
  Ruler,
  FileText,
  FileCheck,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Check,
  Lock,
  Eye,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { JourneyStage } from "@/hooks/useProjectJourney";
import { journeyCopy } from "@/constants/journeyCopy";
import {
  deriveVisualStateStandalone,
  type VisualState,
} from "./deriveVisualState";

const vsConfig: Record<
  VisualState,
  {
    label: string;
    badgeClass: string;
    iconBg: string;
    iconColor: string;
    Icon: React.ElementType;
  }
> = {
  completed: {
    label: journeyCopy.status.completed.label,
    badgeClass: "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]",
    iconBg: "bg-[hsl(var(--success-light))]",
    iconColor: "text-[hsl(var(--success))]",
    Icon: Check,
  },
  current: {
    label: journeyCopy.status.current.label,
    badgeClass: "bg-accent text-primary",
    iconBg: "bg-accent",
    iconColor: "text-primary",
    Icon: ChevronRight,
  },
  validating: {
    label: journeyCopy.status.in_review.label,
    badgeClass: "bg-accent text-primary",
    iconBg: "bg-accent",
    iconColor: "text-primary",
    Icon: Eye,
  },
  next: {
    label: journeyCopy.status.next.label,
    badgeClass: "bg-accent text-accent-foreground",
    iconBg: "bg-accent",
    iconColor: "text-accent-foreground",
    Icon: Circle,
  },
  blocked: {
    label: journeyCopy.status.blocked.label,
    badgeClass: "bg-muted text-muted-foreground",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    Icon: Lock,
  },
  future: {
    label: journeyCopy.status.future.label,
    badgeClass: "bg-muted text-muted-foreground",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    Icon: Circle,
  },
};

const stageIconMap: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "clipboard-list": ClipboardList,
  box: Box,
  ruler: Ruler,
  "file-text": FileText,
  "file-check": FileCheck,
  "check-circle": CheckCircle,
  circle: Circle,
};

function getStageIcon(
  iconName: string | null,
): React.ComponentType<{ className?: string }> {
  return (iconName && stageIconMap[iconName]) || Circle;
}

function getDisplayDate(stage: JourneyStage): string | null {
  const dateStr = stage.confirmed_start || stage.proposed_start;
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), "dd/MM", { locale: ptBR });
  } catch {
    return null;
  }
}

/* ─── Component ─── */

interface StageSummaryProps {
  stage: JourneyStage;
  isExpanded: boolean;
  hideChevron?: boolean;
}

export function StageSummary({
  stage,
  isExpanded,
  hideChevron,
}: StageSummaryProps) {
  const vs = deriveVisualStateStandalone(stage);
  const cfg = vsConfig[vs];
  const StageIcon = getStageIcon(stage.icon);
  const displayDate = getDisplayDate(stage);
  const isConfirmed = !!stage.confirmed_start;

  const clientTodos = stage.todos.filter((t) => t.owner === "client");
  const totalTodos = clientTodos.length;
  const completedTodos = clientTodos.filter((t) => t.completed).length;
  const progressPct =
    totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
  const allDone = totalTodos > 0 && completedTodos === totalTodos;

  // Compute waiting days
  const waitingDays = (() => {
    if (stage.status !== "waiting_action") return null;
    const ref = stage.waiting_since;
    if (!ref) return null;
    try {
      const days = differenceInDays(new Date(), parseISO(ref));
      return days > 0 ? days : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="flex items-center gap-3 md:gap-4">
      {/* Icon */}
      <div className={cn("p-2.5 md:p-3 rounded-lg shrink-0", cfg.iconBg)}>
        <StageIcon className={cn("h-5 w-5", cfg.iconColor)} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start md:items-center gap-2 flex-col md:flex-row">
          <span
            className={cn(
              "text-base md:text-lg font-semibold leading-tight",
              vs === "completed" &&
                "text-muted-foreground line-through decoration-1",
            )}
          >
            {stage.name}
          </span>
          {vs !== "validating" && (
            <Badge
              className={cn(
                "text-[10px] md:text-xs whitespace-nowrap border-0",
                cfg.badgeClass,
              )}
            >
              {vs === "current" && <ChevronRight className="h-3 w-3 mr-0.5" />}
              {vs === "blocked" && <Lock className="h-3 w-3 mr-0.5" />}
              {cfg.label}
            </Badge>
          )}
        </div>

        {/* Compact info row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          {/* Waiting days counter */}
          {waitingDays !== null && (
            <span className="text-xs inline-flex items-center gap-1 text-[hsl(var(--warning))] font-medium">
              <Clock className="h-3 w-3" />
              Aguardando você há {waitingDays}{" "}
              {waitingDays === 1 ? "dia" : "dias"}
            </span>
          )}
          {stage.responsible && (
            <span className="text-xs text-muted-foreground">
              {stage.responsible}
            </span>
          )}
          {displayDate && (
            <span
              className={cn(
                "text-xs inline-flex items-center gap-1",
                isConfirmed
                  ? "text-[hsl(var(--success))] font-medium"
                  : "text-muted-foreground",
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {displayDate}
              {isConfirmed && <CheckCircle className="h-3 w-3" />}
            </span>
          )}
          {totalTodos > 0 && (
            <span
              className={cn(
                "text-xs inline-flex items-center gap-1.5",
                allDone
                  ? "text-[hsl(var(--success))] font-medium"
                  : "text-muted-foreground",
              )}
            >
              {allDone && <Check className="h-3 w-3" />}
              {completedTodos}/{totalTodos} {journeyCopy.stageSummary.items}
            </span>
          )}
          {vs === "blocked" && stage.dependencies_text && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {journeyCopy.stageSummary.dependsOn} {stage.dependencies_text}
            </span>
          )}
        </div>

        {/* Mini progress bar — only for active/validating stages with todos */}
        {totalTodos > 0 && vs !== "completed" && vs !== "future" && (
          <div className="mt-1.5 max-w-[180px]">
            <Progress value={progressPct} className="h-1" />
          </div>
        )}
      </div>

      {/* Expand indicator */}
      {!hideChevron && (
        <div className="h-10 w-10 flex items-center justify-center shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
