import { JourneyStage } from "@/hooks/useProjectJourney";
import { Progress } from "@/components/ui/progress";

/* ─── Component ─── */

interface JourneyStepperCompactProps {
  stages: JourneyStage[];
  activeStageId: string | null;
  onOpenTimeline: () => void;
  onStageClick: (stageId: string) => void;
}

export function JourneyStepperCompact({ stages }: JourneyStepperCompactProps) {
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const progressPct =
    stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Progress value={progressPct} className="h-2 flex-1 mr-3" />
          <span className="text-xs font-semibold tabular-nums text-muted-foreground whitespace-nowrap">
            Etapa {completedCount} de {stages.length}
          </span>
        </div>
      </div>
    </div>
  );
}
