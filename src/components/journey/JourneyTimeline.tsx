import { Check, Circle, Lock, Eye, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { JourneyStage } from "@/hooks/useProjectJourney";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { journeyCopy } from "@/constants/journeyCopy";
import { deriveVisualState, type VisualState } from "./deriveVisualState";

interface JourneyTimelineProps {
  stages: JourneyStage[];
  activeStageId: string | null;
  onStageClick: (stageId: string) => void;
}

const statusLabels: Record<VisualState, string> = {
  completed: journeyCopy.status.completed.label,
  current: journeyCopy.status.current.label,
  validating: journeyCopy.status.in_review.label,
  next: journeyCopy.status.next.label,
  blocked: journeyCopy.status.blocked.label,
  future: journeyCopy.status.future.label,
};

const visualConfig: Record<
  VisualState,
  {
    icon: React.ElementType;
    iconColor: string;
    bgColor: string;
    ringColor: string;
    lineColor: string;
  }
> = {
  completed: {
    icon: Check,
    iconColor: "text-success-foreground",
    bgColor: "bg-[hsl(var(--success))]",
    ringColor: "",
    lineColor: "bg-[hsl(var(--success))]",
  },
  current: {
    icon: ChevronRight,
    iconColor: "text-primary-foreground",
    bgColor: "bg-primary",
    ringColor: "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
    lineColor: "bg-primary/40",
  },
  validating: {
    icon: Eye,
    iconColor: "text-[hsl(var(--warning-foreground))]",
    bgColor: "bg-[hsl(var(--warning))]",
    ringColor:
      "ring-2 ring-[hsl(var(--warning)/0.3)] ring-offset-2 ring-offset-background",
    lineColor: "bg-[hsl(var(--warning)/0.4)]",
  },
  next: {
    icon: Circle,
    iconColor: "text-primary",
    bgColor: "bg-accent",
    ringColor: "",
    lineColor: "bg-border",
  },
  blocked: {
    icon: Lock,
    iconColor: "text-muted-foreground",
    bgColor: "bg-muted",
    ringColor: "",
    lineColor: "bg-border",
  },
  future: {
    icon: Circle,
    iconColor: "text-muted-foreground/50",
    bgColor: "bg-muted",
    ringColor: "",
    lineColor: "bg-border",
  },
};

function getBlockedByName(
  stage: JourneyStage,
  index: number,
  stages: JourneyStage[],
): string | null {
  if (stage.dependencies_text) return stage.dependencies_text;
  if (index > 0 && stages[index - 1].status !== "completed") {
    return stages[index - 1].name;
  }
  return null;
}

/* ───────────── Component ───────────── */

export function JourneyTimeline({
  stages,
  activeStageId,
  onStageClick,
}: JourneyTimelineProps) {
  // Icon size for lg: w-8 h-8 → 32px, padding top of first item ~12px
  // Center line on the icons: left = padding-left + icon-width/2 = 12px + 16px = 28px (for lg)
  // For mobile: w-10 h-10 → 40px, left = 12px + 20px = 32px
  return (
    <TooltipProvider delayDuration={300}>
      <nav aria-label={journeyCopy.a11y.stagesNav} className="relative">
        <ol className="space-y-0 list-none p-0 m-0 relative">
          {stages.map((stage, index) => {
            const vs = deriveVisualState(stage, index, stages);
            const config = visualConfig[vs];
            const label = statusLabels[vs];
            const Icon = config.icon;
            const isActive = stage.id === activeStageId;
            const isBlocked = vs === "blocked";
            const blockedBy = isBlocked
              ? getBlockedByName(stage, index, stages)
              : null;
            const isCompleted = vs === "completed";
            const isCurrent = vs === "current" || vs === "validating";
            const isLast = index === stages.length - 1;

            // Format completion date for completed stages (skip welcome/virtual stages)
            const completionDate =
              isCompleted && stage.confirmed_end
                ? format(parseISO(stage.confirmed_end), "dd MMM", {
                    locale: ptBR,
                  })
                : null;

            const buttonContent = (
              <button
                onClick={() => onStageClick(stage.id)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "relative flex items-center gap-3 w-full py-3 px-3 rounded-lg text-left transition-colors",
                  "hover:bg-muted/50 active:bg-muted/70 focus-visible:outline-2 focus-visible:outline-primary",
                  "min-h-[56px]",
                )}
              >
                {/* Active indicator — animated */}
                {isActive && (
                  <motion.div
                    layoutId="timeline-active-indicator"
                    className="absolute inset-0 rounded-lg bg-primary/5 ring-1 ring-primary/20"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {/* Connector line — positioned at center of the icon */}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute left-[32px] lg:left-[28px] w-0.5 hidden lg:block",
                      // Start from bottom of current icon, extend to top of next icon
                      "top-[calc(50%+16px)] lg:top-[calc(50%+16px)] h-[calc(100%-4px)]",
                      config.lineColor,
                    )}
                    aria-hidden
                  />
                )}

                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center w-10 h-10 lg:w-8 lg:h-8 rounded-full shrink-0 transition-all",
                    config.bgColor,
                    config.ringColor,
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 lg:h-3.5 lg:w-3.5",
                      config.iconColor,
                    )}
                    strokeWidth={vs === "completed" ? 3 : 2}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "block font-medium text-sm truncate",
                      isCompleted &&
                        "text-muted-foreground line-through decoration-1",
                      isCurrent && "text-foreground font-semibold",
                      isBlocked && "text-muted-foreground",
                    )}
                  >
                    {stage.name}
                  </span>
                  <span
                    className={cn(
                      "text-xs flex items-center gap-1",
                      vs === "current" && "text-primary font-medium",
                      vs === "validating" &&
                        "text-[hsl(var(--warning))] font-medium",
                      vs === "completed" && "text-[hsl(var(--success))]",
                      vs === "next" && "text-accent-foreground",
                      (vs === "blocked" || vs === "future") &&
                        "text-muted-foreground",
                    )}
                  >
                    {label}
                    {isCompleted && completionDate && (
                      <span className="text-muted-foreground font-normal">
                        · {completionDate}
                      </span>
                    )}
                    {isBlocked && blockedBy && (
                      <span className="lg:hidden ml-1 text-muted-foreground">
                        · {blockedBy}
                      </span>
                    )}
                  </span>
                </div>
              </button>
            );

            if (isBlocked && blockedBy) {
              return (
                <li key={stage.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px]">
                      <p className="text-xs">
                        <Lock className="inline h-3 w-3 mr-1 -mt-0.5" />
                        {journeyCopy.stageSummary.dependsOn}{" "}
                        <strong>{blockedBy}</strong>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            }

            return <li key={stage.id}>{buttonContent}</li>;
          })}
        </ol>
      </nav>
    </TooltipProvider>
  );
}
