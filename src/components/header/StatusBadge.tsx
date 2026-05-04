import { TrendingUp, TrendingDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  isOnTrack: boolean;
  progressDiff: number;
  variancePercentage: string;
  isProjectPhase?: boolean;
  isStaff?: boolean;
  size?: "sm" | "default";
}

export function StatusBadge({
  isOnTrack,
  progressDiff,
  variancePercentage,
  isProjectPhase,
  isStaff,
  size = "default",
}: StatusBadgeProps) {
  if (isProjectPhase && !isStaff) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-semibold bg-primary/12 text-primary border border-primary/20",
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
        )}
        role="status"
        aria-label="Fase de Projeto"
      >
        <FileText className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        <span>Fase de Projeto</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold border",
        isOnTrack
          ? "bg-success/12 text-success border-success/20"
          : "bg-warning/12 text-warning border-warning/20",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
      )}
      role="status"
      aria-label={isOnTrack ? "Projeto no prazo" : "Atenção ao prazo"}
    >
      {isOnTrack ? (
        <TrendingUp className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      ) : (
        <TrendingDown className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      )}
      <span>{isOnTrack ? "No Prazo" : "Atenção"}</span>
      {progressDiff !== 0 && (
        <span
          className={cn(
            "font-bold tabular-nums",
            size === "sm" ? "text-[10px]" : "text-xs opacity-80",
          )}
        >
          {progressDiff >= 0 ? "+" : ""}
          {variancePercentage}%
        </span>
      )}
    </div>
  );
}
