import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Activity } from "@/types/report";
import { GanttActivityBar } from "./GanttActivityBar";
import { GanttDependencyLines } from "./GanttDependencyLines";
import type {
  GanttTask,
  MonthInfo,
  GridLine,
  DependencyLine,
  BarStyle,
  DragState,
  ZoomLevel,
} from "./types";

interface GanttTimelineProps {
  activities: Activity[];
  ganttTasks: GanttTask[];
  months: MonthInfo[];
  gridLines: GridLine[];
  totalDays: number;
  startDate: Date;
  endDate: Date;
  referenceDate: Date;
  todayPercent: number;
  zoomLevel: ZoomLevel;
  getBarStyle: (start: string, end: string) => BarStyle;
  dependencyLines: DependencyLine[];
  editable: boolean;
  baselineVisible: boolean;
  selectedActivityId?: string | null;
  onActivitySelect?: (activityId: string | null) => void;
  dragState: DragState | null;
  onDragStart: (
    e: React.MouseEvent,
    index: number,
    dragType: DragState["dragType"],
  ) => void;
  chartRef: React.RefObject<HTMLDivElement | null>;
}

export function GanttTimeline({
  activities,
  ganttTasks,
  months,
  gridLines,
  totalDays,
  startDate,
  endDate,
  referenceDate,
  todayPercent,
  zoomLevel,
  getBarStyle,
  dependencyLines,
  editable,
  baselineVisible,
  selectedActivityId,
  onActivitySelect,
  dragState,
  onDragStart,
  chartRef,
}: GanttTimelineProps) {
  const chartWidth = useMemo(() => {
    switch (zoomLevel) {
      case "week":
        return Math.max(totalDays * 30, 100);
      case "month":
        return Math.max(totalDays * 15, 100);
      case "quarter":
        return Math.max(totalDays * 8, 100);
    }
  }, [zoomLevel, totalDays]);

  return (
    <div className="flex-1 overflow-x-auto">
      <div
        style={{ minWidth: `${chartWidth}%` }}
        ref={chartRef as React.RefObject<HTMLDivElement>}
      >
        {/* Month headers */}
        <div className="h-8 flex border-b border-border bg-muted/20">
          {months.map((month, idx) => {
            const width = (month.days / totalDays) * 100;
            return (
              <div
                key={idx}
                className="border-r border-border flex items-center justify-center text-xs font-medium text-muted-foreground capitalize"
                style={{ width: `${width}%` }}
              >
                {month.label}
              </div>
            );
          })}
        </div>

        {/* Activity bars */}
        <div className="relative">
          {/* Grid lines */}
          {gridLines.map((line, idx) => {
            const percent = (line.offset / totalDays) * 100;
            const isWeekStart = line.date.getDay() === 1;
            const isMonthStart = line.date.getDate() <= 3;

            return (
              <Tooltip key={`grid-${idx}`}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "absolute top-0 bottom-0 w-3 -ml-1.5 cursor-default z-[1]",
                      "hover:bg-primary/5 transition-colors",
                    )}
                    style={{ left: `${percent}%` }}
                  >
                    <div
                      className={cn(
                        "absolute left-1/2 top-0 bottom-0 w-px",
                        isMonthStart
                          ? "bg-border/60"
                          : isWeekStart
                            ? "bg-border/30"
                            : "bg-border/15",
                      )}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">
                    {format(line.date, "dd/MM/yyyy")}
                  </p>
                  <p className="text-muted-foreground capitalize">
                    {format(line.date, "EEEE", { locale: ptBR })}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Today marker */}
          {todayPercent >= 0 && todayPercent <= 100 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
              style={{ left: `${todayPercent}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-[10px] px-1 rounded whitespace-nowrap">
                Hoje
              </div>
            </div>
          )}

          {/* Activity bars */}
          {ganttTasks.map((task, index) => (
            <GanttActivityBar
              key={activities[index]?.id || index}
              task={task}
              activity={activities[index]}
              index={index}
              referenceDate={referenceDate}
              getBarStyle={getBarStyle}
              editable={editable}
              isDragging={dragState?.activityId === activities[index]?.id}
              dragType={
                dragState?.activityId === activities[index]?.id
                  ? dragState?.dragType
                  : undefined
              }
              baselineVisible={baselineVisible}
              selectedActivityId={selectedActivityId}
              onActivitySelect={onActivitySelect}
              onDragStart={onDragStart}
            />
          ))}

          <GanttDependencyLines
            dependencyLines={dependencyLines}
            getBarStyle={getBarStyle}
          />
        </div>

        {/* Bottom date axis */}
        <div className="h-8 flex border-t border-border bg-muted/20 relative">
          <div className="absolute left-0 top-0 h-full flex items-center pl-2">
            <span className="text-xs font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
              {format(startDate, "dd/MM/yyyy")}
            </span>
          </div>
          <div className="absolute right-0 top-0 h-full flex items-center pr-2">
            <span className="text-xs font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
              {format(endDate, "dd/MM/yyyy")}
            </span>
          </div>
          {todayPercent >= 0 && todayPercent <= 100 && (
            <div
              className="absolute top-0 h-full flex items-center"
              style={{
                left: `${todayPercent}%`,
                transform: "translateX(-50%)",
              }}
            >
              <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1 py-0.5 rounded border border-destructive/30">
                {format(referenceDate, "dd/MM")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
