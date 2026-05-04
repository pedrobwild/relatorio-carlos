import { ArrowRight, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { JourneyStage } from "@/hooks/useProjectJourney";
import { motion, AnimatePresence } from "framer-motion";

interface JourneyProgressBarProps {
  stages: JourneyStage[];
  activeStageId: string;
  onNextClick?: () => void;
}

export function JourneyProgressBar({
  stages,
  activeStageId,
  onNextClick,
}: JourneyProgressBarProps) {
  const totalStages = stages.length;
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const progressPct =
    totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : 0;
  const allDone = completedCount === totalStages;

  // Find current stage (first non-completed)
  const currentStage = stages.find((s) => s.status !== "completed");
  const currentIndex = currentStage
    ? stages.indexOf(currentStage)
    : totalStages;

  // Find next stage after the active one
  const activeIndex = stages.findIndex((s) => s.id === activeStageId);
  const nextStage =
    activeIndex >= 0 && activeIndex < totalStages - 1
      ? stages[activeIndex + 1]
      : null;

  // Only show "next step" hint when looking at a completed stage
  const activeStage = stages.find((s) => s.id === activeStageId);
  const showNextHint =
    activeStage?.status === "completed" &&
    nextStage &&
    nextStage.status !== "completed";

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Progress value={progressPct} className="h-2" />
        </div>
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap tabular-nums">
          {allDone ? (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[hsl(var(--success))] inline-flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" />
              Concluída!
            </motion.span>
          ) : (
            <>
              Etapa {currentIndex + 1} de {totalStages}
            </>
          )}
        </span>
      </div>

      {/* Next step hint — hidden on mobile to avoid redundancy with stepper */}
      <AnimatePresence mode="wait">
        {showNextHint && nextStage && onNextClick && (
          <motion.button
            key={nextStage.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            onClick={onNextClick}
            className={cn(
              "hidden md:flex w-full items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5",
              "hover:bg-primary/10 transition-colors text-left group cursor-pointer",
            )}
          >
            <div className="p-1.5 rounded-full bg-primary/10 shrink-0">
              <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">Próxima etapa</p>
              <p className="text-sm font-semibold text-foreground truncate">
                {nextStage.name}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
