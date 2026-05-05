import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { Activity } from "@/types/report";
import { format, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface Milestone {
  label: string;
  expectedPercent: number;
  position: number; // 0-100 on the bar timeline
}

/** Calculate monthly milestones: expected % complete at each month boundary */
function computeMilestones(
  activities: Activity[],
  startDate: string,
  endDate: string,
): Milestone[] {
  if (!activities.length || !startDate || !endDate) return [];

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const totalDuration = end.getTime() - start.getTime();
  if (totalDuration <= 0) return [];

  const hasWeights = activities.some((a) => a.weight !== undefined);
  const totalWeight = hasWeights
    ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
    : activities.length;
  if (totalWeight === 0) return [];

  const milestones: Milestone[] = [];

  // Generate one milestone per month boundary
  let current = addMonths(startOfMonth(start), 1); // first full month end
  while (current < end) {
    const position =
      ((current.getTime() - start.getTime()) / totalDuration) * 100;

    // Calculate expected % at this date based on planned end dates
    const plannedWeight = activities.reduce((sum, a) => {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      if (plannedEnd <= current) {
        return sum + (hasWeights ? a.weight || 0 : 1);
      }
      return sum;
    }, 0);
    const expectedPercent = Math.round((plannedWeight / totalWeight) * 100);

    milestones.push({
      label: format(current, "MMM", { locale: ptBR }),
      expectedPercent,
      position: Math.min(position, 100),
    });

    current = addMonths(current, 1);
  }

  return milestones;
}

interface ProgressSectionProps {
  elapsedWorkingDays: number;
  totalWorkingDays: number;
  remainingWorkingDays: number;
  actualProgress: number;
  plannedProgress: number;
  isOnTrack: boolean;
  isStaff: boolean;
  hasActivities: boolean;
  cronogramaPath: string;
  isProjectPhase?: boolean;
  activities?: Activity[];
  projectStartDate?: string;
  projectEndDate?: string;
}

export function ProgressSection({
  actualProgress,
  plannedProgress,
  isOnTrack,
  isStaff,
  hasActivities,
  cronogramaPath,
  isProjectPhase,
  activities = [],
  projectStartDate,
  projectEndDate,
}: ProgressSectionProps) {
  const milestones = useMemo(
    () =>
      computeMilestones(
        activities,
        projectStartDate || "",
        projectEndDate || "",
      ),
    [activities, projectStartDate, projectEndDate],
  );

  // HOJE position = planned progress at today, same scale as green bar
  const _todayPosition = useMemo(() => {
    if (!projectStartDate || !projectEndDate || activities.length === 0)
      return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(projectStartDate + "T00:00:00");
    if (now < start) return null;

    const hasWeights = activities.some((a) => a.weight !== undefined);
    const totalWeight = hasWeights
      ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
      : activities.length;
    if (totalWeight === 0) return null;

    const plannedWeightByNow = activities.reduce((sum, a) => {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      if (plannedEnd <= now) {
        return sum + (hasWeights ? a.weight || 0 : 1);
      }
      return sum;
    }, 0);

    return Math.min((plannedWeightByNow / totalWeight) * 100, 100);
  }, [projectStartDate, projectEndDate, activities]);

  if (isProjectPhase && !isStaff) return null;

  return (
    <section className="mt-4" aria-label="Progresso">
      <div
        role="progressbar"
        aria-valuenow={Math.round(actualProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-card-label">Progresso de obra</h3>
          <div className="flex items-center gap-3">
            {isStaff && hasActivities && (
              <Link
                to={cronogramaPath}
                className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-accent"
                title="Editar cronograma"
                aria-label="Editar cronograma"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Link>
            )}
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                isOnTrack ? "text-success" : "text-warning",
              )}
            >
              {actualProgress}%
            </span>
          </div>
        </div>

        {/* Progress bar with milestones */}
        <div className="relative">
          {/* Bar */}
          <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                isOnTrack ? "bg-success" : "bg-warning",
              )}
              style={{ width: `${Math.min(actualProgress, 100)}%` }}
            />
          </div>

          {/* Milestone markers */}
          <TooltipProvider delayDuration={100}>
            {milestones.map((m, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className="absolute top-0 flex flex-col items-center"
                    style={{
                      left: `${m.position}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {/* Tick mark on bar */}
                    <div className="w-px h-3 bg-foreground/20" />
                    {/* Label below */}
                    <span className="text-[9px] text-muted-foreground mt-0.5 uppercase font-medium whitespace-nowrap">
                      {m.label}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-semibold">{m.label.toUpperCase()}</p>
                  <p>Previsto: {m.expectedPercent}%</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>

        {/* Labels */}
        <div className="flex items-center justify-between text-caption mt-4 tabular-nums">
          <span>Previsto: {plannedProgress}%</span>
          <span>Realizado: {actualProgress}%</span>
        </div>
      </div>
    </section>
  );
}
