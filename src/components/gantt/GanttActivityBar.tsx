import React, { useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseLocalDate, getStatusLabel } from "@/lib/activityStatus";
import { Activity } from "@/types/report";
import { safeParseLocalDate, getTaskDisplayData } from "./utils";
import type { GanttTask, BarStyle, DragState } from "./types";

interface GanttActivityBarProps {
  task: GanttTask;
  activity: Activity;
  index: number;
  referenceDate: Date;
  getBarStyle: (start: string, end: string) => BarStyle;
  editable: boolean;
  isDragging: boolean;
  dragType?: DragState["dragType"];
  baselineVisible: boolean;
  selectedActivityId?: string | null;
  onActivitySelect?: (activityId: string | null) => void;
  onDragStart: (
    e: React.MouseEvent,
    index: number,
    dragType: DragState["dragType"],
  ) => void;
}

function GanttActivityBarInner({
  task,
  activity,
  index,
  referenceDate,
  getBarStyle,
  editable,
  isDragging,
  dragType,
  baselineVisible,
  selectedActivityId,
  onActivitySelect,
  onDragStart,
}: GanttActivityBarProps) {
  const computed = getTaskDisplayData(task);
  const { status, progress, delayDays, hasActualStart, hasActualEnd } =
    computed;
  const isSelected = selectedActivityId === activity?.id;

  const plannedStyle = useMemo(
    () => getBarStyle(task.plannedStart, task.plannedEnd),
    [getBarStyle, task.plannedStart, task.plannedEnd],
  );
  const plannedEndDate = safeParseLocalDate(task.plannedEnd) ?? referenceDate;
  const plannedStartDate =
    safeParseLocalDate(task.plannedStart) ?? referenceDate;

  const { actualBarStyle, delayBarStyle, remainingPlannedStyle } =
    useMemo(() => {
      let actual: BarStyle | null = null;
      let delay: BarStyle | null = null;
      let remaining: BarStyle | null = null;

      if (hasActualEnd) {
        actual = getBarStyle(task.start, task.end);
        const actualEndDate = parseLocalDate(task.end);
        if (actualEndDate > plannedEndDate) {
          delay = getBarStyle(task.plannedEnd, task.end);
        }
      } else if (hasActualStart) {
        actual = getBarStyle(task.start, task.end);
        if (referenceDate > plannedEndDate) {
          const todayStr = format(referenceDate, "yyyy-MM-dd");
          delay = getBarStyle(task.plannedEnd, todayStr);
        }
        if (referenceDate < plannedEndDate) {
          const todayStr = format(referenceDate, "yyyy-MM-dd");
          remaining = getBarStyle(todayStr, task.plannedEnd);
        }
      }

      return {
        actualBarStyle: actual,
        delayBarStyle: delay,
        remainingPlannedStyle: remaining,
      };
    }, [
      getBarStyle,
      task.start,
      task.end,
      task.plannedEnd,
      hasActualEnd,
      hasActualStart,
      referenceDate,
      plannedEndDate,
    ]);

  const hasBaseline = task.baselineStart && task.baselineEnd;
  const baselineStyle = useMemo(
    () =>
      hasBaseline ? getBarStyle(task.baselineStart!, task.baselineEnd!) : null,
    [getBarStyle, hasBaseline, task.baselineStart, task.baselineEnd],
  );
  const showProgressLabel = parseFloat(plannedStyle.width) > 3;

  return (
    <div
      className={cn(
        "h-12 relative border-b border-border transition-colors overflow-hidden",
        onActivitySelect && "cursor-pointer",
        isSelected
          ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
          : "hover:bg-muted/10",
      )}
      onClick={() =>
        onActivitySelect?.(isSelected ? null : activity.id || null)
      }
    >
      {/* Baseline */}
      {baselineVisible && baselineStyle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute top-1.5 h-2 rounded-full bg-muted-foreground/30 border border-muted-foreground/40"
              style={{ left: baselineStyle.left, width: baselineStyle.width }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium text-muted-foreground">
              Baseline (Original)
            </p>
            <p className="text-xs">
              {format(parseLocalDate(task.baselineStart!), "dd/MM/yyyy")} -{" "}
              {format(parseLocalDate(task.baselineEnd!), "dd/MM/yyyy")}
            </p>
            {(task.baselineStart !== task.plannedStart ||
              task.baselineEnd !== task.plannedEnd) && (
              <p className="text-xs text-[hsl(var(--warning))] mt-1">
                ⚠ Datas alteradas desde o baseline
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Planned bar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute top-2 h-3 rounded-sm transition-colors border",
              "bg-primary/25 border-primary/50",
              editable && "cursor-move hover:bg-primary/35",
              isDragging && dragType === "move" && "ring-2 ring-primary",
            )}
            style={{ left: plannedStyle.left, width: plannedStyle.width }}
            onMouseDown={(e) => onDragStart(e, index, "move")}
          >
            {!hasActualStart && showProgressLabel && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-medium text-primary/70">
                  Previsto
                </span>
              </div>
            )}
            {editable && (
              <>
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-primary/50 rounded-l-sm"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onDragStart(e, index, "resize-start");
                  }}
                />
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-primary/50 rounded-r-sm"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onDragStart(e, index, "resize-end");
                  }}
                />
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{task.titulo}</p>
          <div className="mt-1.5 space-y-1">
            <p className="text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-primary/30 border border-primary/50" />
              <span className="text-muted-foreground">Previsto:</span>
              <span>
                {format(plannedStartDate, "dd/MM")} →{" "}
                {format(plannedEndDate, "dd/MM/yyyy")}
              </span>
              <span className="text-muted-foreground">
                ({differenceInDays(plannedEndDate, plannedStartDate) + 1} dias)
              </span>
            </p>
            {hasActualStart && (
              <p className="text-xs flex items-center gap-1.5">
                <span
                  className={cn(
                    "w-2 h-2 rounded-sm",
                    hasActualEnd ? "bg-success" : "bg-primary",
                  )}
                />
                <span className="text-muted-foreground">Real:</span>
                <span>
                  {format(parseLocalDate(task.start), "dd/MM")} →{" "}
                  {hasActualEnd
                    ? format(parseLocalDate(task.end), "dd/MM/yyyy")
                    : "em andamento"}
                </span>
              </p>
            )}
            {delayDays > 0 && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                ⚠ {delayDays} {delayDays === 1 ? "dia" : "dias"} de atraso
              </p>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
            <span
              className={cn(
                "text-xs font-semibold",
                status === "completed"
                  ? "text-success"
                  : status === "delayed"
                    ? "text-destructive"
                    : status === "in-progress"
                      ? "text-primary"
                      : "text-muted-foreground",
              )}
            >
              {getStatusLabel(status)}
            </span>
            <span className="text-xs text-muted-foreground">
              {progress}% • Peso: {task.weight}%
            </span>
          </div>
          {editable && (
            <p className="text-xs text-muted-foreground mt-1.5 italic">
              Arraste para mover
            </p>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Actual bar */}
      {actualBarStyle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "absolute top-6 h-4 rounded-sm cursor-pointer transition-colors flex items-center overflow-hidden",
                hasActualEnd ? "bg-success" : "bg-primary",
              )}
              style={{ left: actualBarStyle.left, width: actualBarStyle.width }}
            >
              {showProgressLabel && (
                <span className="text-[10px] font-bold px-1.5 whitespace-nowrap drop-shadow-sm text-white">
                  {progress}%
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-medium">
              {hasActualEnd ? "Concluído" : "Em andamento"}
            </p>
            <p className="text-muted-foreground">
              {format(parseLocalDate(task.start), "dd/MM")} →{" "}
              {hasActualEnd
                ? format(parseLocalDate(task.end), "dd/MM/yyyy")
                : "hoje"}
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Delay bar */}
      {delayBarStyle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute top-6 h-4 rounded-sm cursor-pointer bg-destructive"
              style={{ left: delayBarStyle.left, width: delayBarStyle.width }}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-medium text-destructive">Atraso</p>
            <p className="text-muted-foreground">
              {format(plannedEndDate, "dd/MM")} →{" "}
              {hasActualEnd
                ? format(parseLocalDate(task.end), "dd/MM/yyyy")
                : "hoje"}
            </p>
            <p className="text-destructive font-medium">
              +{delayDays} {delayDays === 1 ? "dia" : "dias"}
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Remaining planned bar */}
      {remainingPlannedStyle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute top-6 h-4 rounded-sm cursor-pointer border-2 border-dashed border-primary/60 bg-primary/10"
              style={{
                left: remainingPlannedStyle.left,
                width: remainingPlannedStyle.width,
              }}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-medium">Previsto restante</p>
            <p className="text-muted-foreground">
              Hoje → {format(plannedEndDate, "dd/MM/yyyy")}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export const GanttActivityBar = React.memo(
  GanttActivityBarInner,
  (prev, next) => {
    return (
      prev.task.id === next.task.id &&
      prev.task.plannedStart === next.task.plannedStart &&
      prev.task.plannedEnd === next.task.plannedEnd &&
      prev.task.start === next.task.start &&
      prev.task.end === next.task.end &&
      prev.task.progress === next.task.progress &&
      prev.task.baselineStart === next.task.baselineStart &&
      prev.task.baselineEnd === next.task.baselineEnd &&
      prev.isDragging === next.isDragging &&
      prev.dragType === next.dragType &&
      prev.editable === next.editable &&
      prev.baselineVisible === next.baselineVisible &&
      prev.selectedActivityId === next.selectedActivityId &&
      prev.index === next.index
    );
  },
);
