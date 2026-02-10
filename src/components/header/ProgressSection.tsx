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
        <h3 className="text-h3">{label}</h3>
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
        <div className="flex items-center justify-between text-tiny mt-1.5">
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
    <section className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4" aria-label="Progresso">
      {/* Timeline Progress */}
      <ProgressBar
        label="Cronograma"
        percentage={timelinePercent}
        variant="primary"
        leftLabel={`Decorridos: ${elapsedWorkingDays} dias`}
        rightLabel={`Restantes: ${remainingWorkingDays} dias`}
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
            <span className="text-caption tabular-nums">
              {elapsedWorkingDays} de {totalWorkingDays} dias úteis
            </span>
          </div>
        }
      />

      {/* Work Progress - Small screens */}
      <div className="xl:hidden">
        <ProgressBar
          label="Progresso da Obra"
          percentage={actualProgress}
          variant={isOnTrack ? "success" : "warning"}
          leftLabel={`Previsto: ${plannedProgress}%`}
          rightLabel={`Realizado: ${actualProgress}%`}
          titleRight={
            <span className="text-h3 tabular-nums">{actualProgress}%</span>
          }
        />
      </div>

      {/* Comparative Progress - XL screens */}
      <div className="hidden xl:block">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-h3">Progresso da Obra</h3>
          <div className="flex items-center gap-4 text-caption">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary/50" />
              Previsto: {plannedProgress}%
            </span>
            <span
              className={cn(
                "flex items-center gap-1.5 font-semibold",
                isOnTrack ? "text-success" : "text-warning"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isOnTrack ? "bg-success" : "bg-warning"
                )}
              />
              Realizado: {actualProgress}%
            </span>
          </div>
        </div>
        <div className="h-2.5 bg-secondary rounded-full overflow-hidden relative" role="progressbar" aria-valuenow={actualProgress} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="absolute top-0 h-full bg-primary/30 rounded-full"
            style={{ width: `${plannedProgress}%` }}
          />
          <div
            className={cn(
              "absolute top-0 h-full rounded-full transition-all duration-700 ease-out",
              isOnTrack ? "bg-success" : "bg-warning"
            )}
            style={{ width: `${actualProgress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
