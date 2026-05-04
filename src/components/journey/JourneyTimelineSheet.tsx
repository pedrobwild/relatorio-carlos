import { Check, ChevronRight, Circle, Lock, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { JourneyStage } from "@/hooks/useProjectJourney";
import { journeyCopy } from "@/constants/journeyCopy";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

/* ─── Visual state ─── */

type VisualState =
  | "completed"
  | "current"
  | "next"
  | "blocked"
  | "validating"
  | "future";

function deriveVisualState(
  stage: JourneyStage,
  index: number,
  stages: JourneyStage[],
): VisualState {
  if (stage.status === "completed") return "completed";
  if (stage.status === "in_progress") return "current";
  if (stage.status === "waiting_action") return "validating";
  if (stage.status === "pending") {
    if (stage.dependencies_text) return "blocked";
    const lastNonPendingIdx = stages.reduce(
      (acc, s, i) => (s.status !== "pending" ? i : acc),
      -1,
    );
    if (index === lastNonPendingIdx + 1) return "next";
    if (index > 0 && stages[index - 1].status === "pending") return "blocked";
    return "future";
  }
  return "future";
}

const vsConfig: Record<
  VisualState,
  {
    Icon: React.ElementType;
    dotBg: string;
    iconColor: string;
    label: string;
    badgeClass: string;
    lineColor: string;
  }
> = {
  completed: {
    Icon: Check,
    dotBg: "bg-[hsl(var(--success))]",
    iconColor: "text-success-foreground",
    label: journeyCopy.status.completed.label,
    badgeClass:
      "bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-0",
    lineColor: "bg-[hsl(var(--success))]",
  },
  current: {
    Icon: ChevronRight,
    dotBg: "bg-primary",
    iconColor: "text-primary-foreground",
    label: journeyCopy.status.current.label,
    badgeClass: "bg-accent text-primary border-0",
    lineColor: "bg-primary/40",
  },
  validating: {
    Icon: Eye,
    dotBg: "bg-[hsl(var(--warning))]",
    iconColor: "text-[hsl(var(--warning-foreground))]",
    label: journeyCopy.status.in_review.label,
    badgeClass:
      "bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-0",
    lineColor: "bg-[hsl(var(--warning)/0.4)]",
  },
  next: {
    Icon: Circle,
    dotBg: "bg-accent",
    iconColor: "text-primary",
    label: journeyCopy.status.next.label,
    badgeClass: "bg-accent text-accent-foreground border-0",
    lineColor: "bg-border",
  },
  blocked: {
    Icon: Lock,
    dotBg: "bg-muted",
    iconColor: "text-muted-foreground",
    label: journeyCopy.status.blocked.label,
    badgeClass: "bg-muted text-muted-foreground border-0",
    lineColor: "bg-border",
  },
  future: {
    Icon: Circle,
    dotBg: "bg-muted",
    iconColor: "text-muted-foreground/50",
    label: journeyCopy.status.future.label,
    badgeClass: "bg-muted text-muted-foreground border-0",
    lineColor: "bg-border",
  },
};

/* ─── Component ─── */

interface JourneyTimelineSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: JourneyStage[];
  activeStageId: string | null;
  onStageClick: (stageId: string) => void;
}

export function JourneyTimelineSheet({
  open,
  onOpenChange,
  stages,
  activeStageId,
  onStageClick,
}: JourneyTimelineSheetProps) {
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const currentIdx = stages.findIndex(
    (s) => s.status === "in_progress" || s.status === "waiting_action",
  );
  const displayIdx = currentIdx >= 0 ? currentIdx + 1 : completedCount;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="px-0 pt-2 pb-[env(safe-area-inset-bottom)] max-h-[85dvh] rounded-t-2xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <SheetHeader className="text-left px-5 pb-3">
          <SheetTitle className="text-base">
            Linha do tempo ({displayIdx}/{stages.length})
          </SheetTitle>
          <SheetDescription className="text-xs">
            {completedCount} de {stages.length} etapas concluídas
          </SheetDescription>
        </SheetHeader>

        <nav
          className="overflow-y-auto px-2"
          role="tablist"
          aria-label={`${journeyCopy.a11y.stagesNav}. Etapa ${displayIdx} de ${stages.length}`}
        >
          <ol className="space-y-0 list-none p-0 m-0 relative">
            {stages.map((stage, index) => {
              const vs = deriveVisualState(stage, index, stages);
              const cfg = vsConfig[vs];
              const Icon = cfg.Icon;
              const isActive = stage.id === activeStageId;
              const isLast = index === stages.length - 1;
              const isCompleted = vs === "completed";

              const completionDate =
                isCompleted && stage.confirmed_end
                  ? format(parseISO(stage.confirmed_end), "dd MMM", {
                      locale: ptBR,
                    })
                  : null;

              return (
                <li key={stage.id} className="relative">
                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={cn(
                        "absolute left-[31px] w-0.5 top-[calc(50%+16px)] h-[calc(100%-4px)]",
                        cfg.lineColor,
                      )}
                      aria-hidden
                    />
                  )}

                  <button
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Etapa ${index + 1} de ${stages.length}: ${stage.name}. ${cfg.label}`}
                    onClick={() => {
                      onStageClick(stage.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "relative flex items-center gap-3 w-full px-3 py-3.5 rounded-lg text-left transition-all min-h-[52px]",
                      "focus-visible:outline-2 focus-visible:outline-primary",
                      "active:bg-muted/60",
                      isActive
                        ? "bg-primary/5 ring-1 ring-primary/20"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <div
                      className={cn(
                        "relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-all",
                        cfg.dotBg,
                        (vs === "current" || vs === "validating") &&
                          "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
                      )}
                    >
                      <Icon
                        className={cn("h-4 w-4", cfg.iconColor)}
                        strokeWidth={vs === "completed" ? 3 : 2}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          "block text-sm",
                          isActive
                            ? "font-semibold text-foreground"
                            : "font-medium",
                          isCompleted &&
                            "text-muted-foreground line-through decoration-1",
                          (vs === "blocked" || vs === "future") &&
                            "text-muted-foreground",
                        )}
                      >
                        {stage.name}
                      </span>
                      <span className="text-xs flex items-center gap-1.5">
                        <Badge
                          className={cn(
                            "text-[10px] h-5 px-1.5",
                            cfg.badgeClass,
                          )}
                        >
                          {cfg.label}
                        </Badge>
                        {isCompleted && completionDate && (
                          <span className="text-muted-foreground text-[11px]">
                            {completionDate}
                          </span>
                        )}
                      </span>
                    </div>

                    {isActive && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
