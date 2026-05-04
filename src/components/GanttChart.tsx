import { useState, useRef, useCallback } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGanttData } from "./gantt/useGanttData";
import { useDragHandlers } from "./gantt/useDragHandlers";
import { GanttHeader } from "./gantt/GanttHeader";
import { GanttLegend } from "./gantt/GanttLegend";
import { GanttActivityLabels } from "./gantt/GanttActivityLabels";
import { GanttDebugColumn } from "./gantt/GanttDebugColumn";
import { GanttTimeline } from "./gantt/GanttTimeline";
import type { GanttChartProps, ZoomLevel } from "./gantt/types";

const ZOOM_LEVELS: ZoomLevel[] = ["week", "month", "quarter"];

const GanttChart = ({
  activities,
  reportDate,
  onActivityDateChange,
  editable = false,
  showBaseline = true,
  showFullChart: controlledShowFull,
  onShowFullChartChange,
  selectedActivityId,
  onActivitySelect,
}: GanttChartProps) => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("month");
  const [baselineVisible, setBaselineVisible] = useState(showBaseline);
  const [debugMode, setDebugMode] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const [internalShowFull, setInternalShowFull] = useState(true);
  const showFullChart =
    controlledShowFull !== undefined ? controlledShowFull : internalShowFull;

  const handleToggleFullChart = () => {
    const newValue = !showFullChart;
    if (onShowFullChartChange) {
      onShowFullChartChange(newValue);
    } else {
      setInternalShowFull(newValue);
    }
  };

  const {
    referenceDate,
    ganttTasks,
    startDate,
    endDate,
    totalDays,
    months,
    gridLines,
    todayPercent,
    getBarStyle,
    dependencyLines,
  } = useGanttData(activities, reportDate, showFullChart);

  const { dragState, handleDragStart, handleDragMove, handleDragEnd } =
    useDragHandlers(
      activities,
      totalDays,
      chartRef,
      editable,
      onActivityDateChange,
    );

  const currentZoomIndex = ZOOM_LEVELS.indexOf(zoomLevel);
  const hasAnyBaseline = activities.some(
    (a) => a.baselineStart && a.baselineEnd,
  );

  const handleZoomIn = useCallback(() => {
    const idx = ZOOM_LEVELS.indexOf(zoomLevel);
    if (idx > 0) setZoomLevel(ZOOM_LEVELS[idx - 1]);
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    const idx = ZOOM_LEVELS.indexOf(zoomLevel);
    if (idx < ZOOM_LEVELS.length - 1) setZoomLevel(ZOOM_LEVELS[idx + 1]);
  }, [zoomLevel]);

  const handleToggleBaseline = useCallback(
    () => setBaselineVisible((v) => !v),
    [],
  );
  const handleToggleDebug = useCallback(() => setDebugMode((v) => !v), []);

  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <p className="text-muted-foreground">
          Nenhuma atividade cadastrada no cronograma.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        className="bg-card rounded-lg border border-border overflow-hidden"
        onMouseMove={dragState ? handleDragMove : undefined}
        onMouseUp={dragState ? handleDragEnd : undefined}
        onMouseLeave={dragState ? handleDragEnd : undefined}
      >
        <GanttHeader
          startDate={startDate}
          endDate={endDate}
          editable={editable}
          showFullChart={showFullChart}
          onToggleFullChart={handleToggleFullChart}
          zoomLevel={zoomLevel}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          canZoomIn={currentZoomIndex > 0}
          canZoomOut={currentZoomIndex < ZOOM_LEVELS.length - 1}
        />

        <GanttLegend
          hasAnyBaseline={hasAnyBaseline}
          baselineVisible={baselineVisible}
          onToggleBaseline={handleToggleBaseline}
          hasDependencies={dependencyLines.length > 0}
          debugMode={debugMode}
          onToggleDebug={handleToggleDebug}
        />

        <div
          key={showFullChart ? "full" : "windowed"}
          className="flex animate-fade-in"
        >
          <GanttActivityLabels
            activities={activities}
            ganttTasks={ganttTasks}
            selectedActivityId={selectedActivityId}
            onActivitySelect={onActivitySelect}
          />

          {debugMode && (
            <GanttDebugColumn
              ganttTasks={ganttTasks}
              getBarStyle={getBarStyle}
            />
          )}

          <GanttTimeline
            activities={activities}
            ganttTasks={ganttTasks}
            months={months}
            gridLines={gridLines}
            totalDays={totalDays}
            startDate={startDate}
            endDate={endDate}
            referenceDate={referenceDate}
            todayPercent={todayPercent}
            zoomLevel={zoomLevel}
            getBarStyle={getBarStyle}
            dependencyLines={dependencyLines}
            editable={editable}
            baselineVisible={baselineVisible}
            selectedActivityId={selectedActivityId}
            onActivitySelect={onActivitySelect}
            dragState={dragState}
            onDragStart={handleDragStart}
            chartRef={chartRef}
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default GanttChart;
