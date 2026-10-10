import { JourneyStage } from "@/hooks/useProjectJourney";
import { Progress } from "@/components/ui/progress";
import {
  formatJourneyStagePosition,
  getJourneyStagePosition,
} from "@/components/journey/journeyStageDisplay";

/* ─── Component ─── */

interface JourneyStepperCompactProps {
  stages: JourneyStage[];
  activeStageId: string | null;
  onOpenTimeline: () => void;
  onStageClick: (stageId: string) => void;
}

export function JourneyStepperCompact({ stages }: JourneyStepperCompactProps) {
  const position = getJourneyStagePosition(stages);
  const progressPct =
    position.total > 0
      ? Math.round((position.completedCount / position.total) * 100)
      : 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Progress value={progressPct} className="h-2 flex-1 mr-3" />
          {/* Posição da etapa atual (não a contagem de concluídas). */}
          <span className="text-xs font-semibold tabular-nums text-muted-foreground whitespace-nowrap">
            {formatJourneyStagePosition(position)}
          </span>
        </div>
      </div>
    </div>
  );
}
