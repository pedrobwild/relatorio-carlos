import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getStatusLabel } from "@/lib/activityStatus";
import { Activity } from "@/types/report";
import { useResponsive } from "@/hooks/use-mobile";
import { getTaskDisplayData } from "./utils";
import type { GanttTask } from "./types";

interface GanttActivityLabelsProps {
  activities: Activity[];
  ganttTasks: GanttTask[];
  selectedActivityId?: string | null;
  onActivitySelect?: (activityId: string | null) => void;
}

export function GanttActivityLabels({
  activities,
  ganttTasks,
  selectedActivityId,
  onActivitySelect,
}: GanttActivityLabelsProps) {
  // Tooltip hover não funciona bem em touch (tablet/mobile).
  // Nessas telas, mostramos um indicador visual e contamos com o tap
  // que abre o ActivityDetailsPanel (com etapa + descrição detalhada).
  const { isDesktop } = useResponsive();

  return (
    <div className="flex-shrink-0 w-48 border-r border-border">
      <div className="h-8 border-b border-border bg-muted/20" />
      {ganttTasks.map((task, index) => {
        const activity = activities[index];
        const computed = getTaskDisplayData(task);
        const isSelected = selectedActivityId === activity?.id;
        const hasDetail = !!activity.detailed_description?.trim();

        const labelContent = (
          <span className="text-xs font-medium truncate cursor-default flex items-center gap-1.5 flex-1 min-w-0">
            <span className="font-mono text-[10px] text-primary/60 shrink-0">
              {index + 1}
            </span>
            <span className="truncate">
              {activity.description}
              {activity.etapa && (
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                  [{activity.etapa}]
                </span>
              )}
            </span>
            {hasDetail && !isDesktop && (
              <Info
                className="h-3 w-3 text-primary/60 shrink-0"
                aria-label="Possui descrição detalhada — toque para ver"
              />
            )}
            {activity.predecessorIds && activity.predecessorIds.length > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                ←{activity.predecessorIds.length}
              </span>
            )}
          </span>
        );

        return (
          <div
            key={activity.id || index}
            className={cn(
              "h-12 px-3 flex items-center border-b border-border transition-colors",
              onActivitySelect && "cursor-pointer",
              isSelected
                ? "bg-primary/10 border-l-2 border-l-primary"
                : "hover:bg-muted/20",
            )}
            onClick={() =>
              onActivitySelect?.(isSelected ? null : activity.id || null)
            }
          >
            {isDesktop ? (
              <Tooltip>
                <TooltipTrigger asChild>{labelContent}</TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium">{activity.description}</p>
                  {activity.etapa && (
                    <p className="text-xs text-muted-foreground">
                      Etapa: {activity.etapa}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Peso: {activity.weight}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: {getStatusLabel(computed.status)}
                    {computed.isDelayed &&
                      computed.delayDays > 0 &&
                      ` (${computed.delayDays} dias)`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Progresso: {computed.progress}%
                  </p>
                  {hasDetail && (
                    <p className="text-xs text-muted-foreground mt-1 border-t border-border/40 pt-1 line-clamp-3">
                      {activity.detailed_description}
                    </p>
                  )}
                  {activity.predecessorIds &&
                    activity.predecessorIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Depende de: {activity.predecessorIds.length}{" "}
                        atividade(s)
                      </p>
                    )}
                </TooltipContent>
              </Tooltip>
            ) : (
              labelContent
            )}
          </div>
        );
      })}
    </div>
  );
}
