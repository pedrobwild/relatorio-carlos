import { forwardRef } from "react";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { journeyCopy } from "@/constants/journeyCopy";
import { JourneyStage } from "@/hooks/useProjectJourney";
import { StageSummary } from "./StageSummary";

interface JourneyStageCardProps {
  stage: JourneyStage;
  isActive: boolean;
  isBlocked: boolean;
  onSelect: () => void;
  nextStageName?: string | null;
}

export const JourneyStageCard = forwardRef<
  HTMLDivElement,
  JourneyStageCardProps
>(function JourneyStageCard(
  { stage, isActive, isBlocked, onSelect, nextStageName },
  ref,
) {
  return (
    <Card
      ref={ref}
      data-stage-id={stage.id}
      className={cn(
        "transition-all duration-200",
        isActive && "ring-2 ring-primary/30",
        stage.status === "waiting_action" &&
          !isActive &&
          "ring-1 ring-[hsl(var(--warning)/0.3)]",
        stage.status === "completed" && "opacity-75",
        isBlocked && "opacity-60",
        !isBlocked && "cursor-pointer hover:shadow-md",
      )}
    >
      <CardHeader
        className={cn(
          "transition-colors p-4 md:p-5",
          !isBlocked && "hover:bg-muted/30 active:bg-muted/50",
        )}
        onClick={() => !isBlocked && onSelect()}
        role="button"
        aria-disabled={isBlocked}
        aria-label={
          isBlocked
            ? `${stage.name} — Bloqueada`
            : journeyCopy.a11y.open_stage.replace("{stageName}", stage.name)
        }
        tabIndex={isBlocked ? -1 : 0}
        onKeyDown={(e) => {
          if (!isBlocked && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <StageSummary stage={stage} isExpanded={false} />
      </CardHeader>

      {/* Completed stage banner */}
      {stage.status === "completed" && nextStageName && (
        <div className="flex items-center gap-2 px-4 py-2.5 md:px-5 border-t border-[hsl(var(--success)/0.15)] bg-[hsl(var(--success)/0.04)]">
          <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />
          <span className="text-xs text-[hsl(var(--success))] font-medium">
            Etapa concluída
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            Próxima:{" "}
            <span className="font-medium text-foreground">{nextStageName}</span>
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      )}

      {/* Blocked indicator */}
      {isBlocked && (
        <div className="flex items-center gap-2 px-4 py-2 md:px-5 border-t border-border bg-muted/20">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {stage.dependencies_text
              ? `Depende de: ${stage.dependencies_text}`
              : "Etapa anterior precisa ser concluída"}
          </span>
        </div>
      )}
    </Card>
  );
});
