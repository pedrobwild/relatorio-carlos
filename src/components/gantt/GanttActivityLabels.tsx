import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getStatusLabel } from '@/lib/activityStatus';
import { Activity } from '@/types/report';
import { getTaskDisplayData } from './utils';
import type { GanttTask } from './types';

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
  return (
    <div className="flex-shrink-0 w-48 border-r border-border">
      <div className="h-8 border-b border-border bg-muted/20" />
      {ganttTasks.map((task, index) => {
        const activity = activities[index];
        const computed = getTaskDisplayData(task);
        const isSelected = selectedActivityId === activity?.id;
        return (
          <div
            key={activity.id || index}
            className={cn(
              "h-12 px-3 flex items-center border-b border-border transition-colors",
              onActivitySelect && "cursor-pointer",
              isSelected
                ? "bg-primary/10 border-l-2 border-l-primary"
                : "hover:bg-muted/20"
            )}
            onClick={() => onActivitySelect?.(isSelected ? null : activity.id || null)}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs font-medium truncate cursor-default flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-primary/60">{index + 1}</span>
                  <span className="truncate">
                    {activity.description}
                    {(activity as any).etapa && (
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                        [{(activity as any).etapa}]
                      </span>
                    )}
                  </span>
                  {activity.predecessorIds && activity.predecessorIds.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">←{activity.predecessorIds.length}</span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="font-medium">{activity.description}</p>
                {(activity as any).etapa && (
                  <p className="text-xs text-muted-foreground">Etapa: {(activity as any).etapa}</p>
                )}
                <p className="text-xs text-muted-foreground">Peso: {activity.weight}%</p>
                <p className="text-xs text-muted-foreground">
                  Status: {getStatusLabel(computed.status)}
                  {computed.isDelayed && computed.delayDays > 0 && ` (${computed.delayDays} dias)`}
                </p>
                <p className="text-xs text-muted-foreground">Progresso: {computed.progress}%</p>
                {(activity as any).detailed_description && (
                  <p className="text-xs text-muted-foreground mt-1 border-t border-border/40 pt-1">
                    {(activity as any).detailed_description}
                  </p>
                )}
                {activity.predecessorIds && activity.predecessorIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Depende de: {activity.predecessorIds.length} atividade(s)
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
