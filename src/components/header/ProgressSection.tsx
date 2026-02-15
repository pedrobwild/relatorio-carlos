import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  label: string;
  percentage: number;
  variant?: "primary" | "success" | "warning";
  leftLabel?: string;
  rightLabel?: string;
  titleRight?: React.ReactNode;
  className?: string;
}

function ProgressBar({
  label,
  percentage,
  variant = "primary",
  leftLabel,
  rightLabel,
  titleRight,
  className,
}: ProgressBarProps) {
  const barColor = {
    primary: "bg-primary/70",
    success: "bg-success",
    warning: "bg-warning",
  };

  return (
    <div className={className} role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        {titleRight}
      </div>
      <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            barColor[variant]
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 tabular-nums">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
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
}

export function ProgressSection({
  elapsedWorkingDays,
  totalWorkingDays,
  remainingWorkingDays,
  actualProgress,
  plannedProgress,
  isOnTrack,
  isStaff,
  hasActivities,
  cronogramaPath,
  isProjectPhase,
}: ProgressSectionProps) {
  if (isProjectPhase && !isStaff) return null;

  const timelinePercent =
    totalWorkingDays > 0
      ? (elapsedWorkingDays / totalWorkingDays) * 100
      : 0;

  return (
    <section className="mt-4" aria-label="Progresso">
      {/* Timeline Progress */}
      <ProgressBar
        label="Progresso de obra"
        percentage={actualProgress}
        variant={isOnTrack ? "success" : "warning"}
        leftLabel={`Previsto: ${plannedProgress}%`}
        rightLabel={`Realizado: ${actualProgress}%`}
        titleRight={
          <div className="flex items-center gap-3">
            {isStaff && hasActivities && (
              <Link
                to={cronogramaPath}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Editar cronograma"
                aria-label="Editar cronograma"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Link>
            )}
            <span className={cn(
              "text-sm font-bold tabular-nums",
              isOnTrack ? "text-success" : "text-warning"
            )}>{actualProgress}%</span>
          </div>
        }
      />
    </section>
  );
}
