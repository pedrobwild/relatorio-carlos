import { useMemo, useState, useRef, useCallback } from 'react';
import { format, differenceInDays, eachMonthOfInterval, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity } from '@/types/report';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, GripHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { 
  computeEffectiveStatus, 
  parseLocalDate, 
  getTodayLocal,
  getStatusColorClass,
  getStatusLabel,
  type ActivityStatus 
} from '@/lib/activityStatus';

interface GanttChartProps {
  activities: Activity[];
  reportDate?: string;
  onActivityDateChange?: (activityId: string, newPlannedStart: string, newPlannedEnd: string) => void;
  editable?: boolean;
  showBaseline?: boolean;
  showFullChart?: boolean;
  onShowFullChartChange?: (showFull: boolean) => void;
}

type ZoomLevel = 'week' | 'month' | 'quarter';

interface DragState {
  activityIndex: number;
  dragType: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  originalStart: string;
  originalEnd: string;
}

const GanttChart = ({ 
  activities, 
  reportDate, 
  onActivityDateChange, 
  editable = false, 
  showBaseline = true,
  showFullChart: controlledShowFull,
  onShowFullChartChange
}: GanttChartProps) => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [baselineVisible, setBaselineVisible] = useState(showBaseline);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Controlled or uncontrolled full chart view
  const [internalShowFull, setInternalShowFull] = useState(false);
  const showFullChart = controlledShowFull !== undefined ? controlledShowFull : internalShowFull;
  
  const handleToggleFullChart = () => {
    const newValue = !showFullChart;
    if (onShowFullChartChange) {
      onShowFullChartChange(newValue);
    } else {
      setInternalShowFull(newValue);
    }
  };

  const hasAnyBaseline = activities.some(a => a.baselineStart && a.baselineEnd);

  // Interval for grid lines (matching S-Curve's 3-day interval)
  const GRID_INTERVAL_DAYS = 3;

  // Reference date for status calculations
  const referenceDate = useMemo(() => {
    return reportDate ? parseLocalDate(reportDate) : getTodayLocal();
  }, [reportDate]);

  const { startDate, endDate, totalDays, months, gridLines } = useMemo(() => {
    const today = referenceDate;
    
    if (activities.length === 0) {
      return {
        startDate: today,
        endDate: today,
        totalDays: 30,
        months: [{ date: today, label: format(today, 'MMM yyyy', { locale: ptBR }), days: 30 }],
        gridLines: []
      };
    }

    const allDates = activities.flatMap(a => [
      parseLocalDate(a.plannedStart),
      parseLocalDate(a.plannedEnd),
      ...(a.actualStart ? [parseLocalDate(a.actualStart)] : []),
      ...(a.actualEnd ? [parseLocalDate(a.actualEnd)] : []),
    ]);

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    // Apply 45-day window (-30 to +15 days from today) when not showing full chart
    let start: Date;
    let end: Date;
    
    if (showFullChart) {
      start = startOfMonth(minDate);
      end = endOfMonth(maxDate);
    } else {
      // 45-day window matching S-Curve behavior
      const windowStart = addDays(today, -30);
      const windowEnd = addDays(today, 15);
      
      // Use the intersection of project range and window
      start = windowStart < minDate ? minDate : windowStart;
      end = windowEnd > maxDate ? maxDate : windowEnd;
      
      // Expand to month boundaries for cleaner display
      start = startOfMonth(start);
      end = endOfMonth(end);
    }
    
    const months = eachMonthOfInterval({ start, end }).map(date => ({
      date,
      label: format(date, 'MMM yyyy', { locale: ptBR }),
      days: differenceInDays(endOfMonth(date), startOfMonth(date)) + 1,
    }));

    const totalDaysValue = differenceInDays(end, start) + 1;

    // Generate grid lines at regular intervals (every 3 days like S-Curve)
    const gridLinesArray: { date: Date; offset: number }[] = [];
    let currentDate = start;
    while (currentDate <= end) {
      const offset = differenceInDays(currentDate, start);
      gridLinesArray.push({ date: currentDate, offset });
      currentDate = addDays(currentDate, GRID_INTERVAL_DAYS);
    }

    return {
      startDate: start,
      endDate: end,
      totalDays: totalDaysValue,
      months,
      gridLines: gridLinesArray,
    };
  }, [activities, referenceDate, showFullChart]);

  const todayOffset = differenceInDays(referenceDate, startDate);
  const todayPercent = (todayOffset / totalDays) * 100;

  const getBarStyle = (start: string, end: string) => {
    const startD = parseLocalDate(start);
    const endD = parseLocalDate(end);
    
    const leftDays = differenceInDays(startD, startDate);
    const widthDays = differenceInDays(endD, startD) + 1;
    
    const left = (leftDays / totalDays) * 100;
    const width = (widthDays / totalDays) * 100;
    
    return { left: `${left}%`, width: `${Math.max(width, 0.5)}%` };
  };

  // Use centralized status computation
  const getActivityStatusAndProgress = (activity: Activity) => {
    return computeEffectiveStatus(
      {
        plannedStart: activity.plannedStart,
        plannedEnd: activity.plannedEnd,
        actualStart: activity.actualStart || null,
        actualEnd: activity.actualEnd || null,
      },
      referenceDate
    );
  };

  const statusColors: Record<ActivityStatus, string> = {
    completed: 'bg-green-500',
    'in-progress': 'bg-primary',
    delayed: 'bg-destructive',
    pending: 'bg-primary/30',
  };

  const zoomLevels: ZoomLevel[] = ['week', 'month', 'quarter'];
  const currentZoomIndex = zoomLevels.indexOf(zoomLevel);

  const handleZoomIn = () => {
    if (currentZoomIndex > 0) {
      setZoomLevel(zoomLevels[currentZoomIndex - 1]);
    }
  };

  const handleZoomOut = () => {
    if (currentZoomIndex < zoomLevels.length - 1) {
      setZoomLevel(zoomLevels[currentZoomIndex + 1]);
    }
  };

  const chartWidth = useMemo(() => {
    switch (zoomLevel) {
      case 'week': return Math.max(totalDays * 30, 100);
      case 'month': return Math.max(totalDays * 15, 100);
      case 'quarter': return Math.max(totalDays * 8, 100);
    }
  }, [zoomLevel, totalDays]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent, activityIndex: number, dragType: DragState['dragType']) => {
    if (!editable || !onActivityDateChange) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const activity = activities[activityIndex];
    setDragState({
      activityIndex,
      dragType,
      startX: e.clientX,
      originalStart: activity.plannedStart,
      originalEnd: activity.plannedEnd,
    });
  }, [editable, onActivityDateChange, activities]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!dragState || !chartRef.current || !onActivityDateChange) return;

    const chartRect = chartRef.current.getBoundingClientRect();
    const chartWidthPx = chartRect.width;
    const deltaX = e.clientX - dragState.startX;
    const deltaDays = Math.round((deltaX / chartWidthPx) * totalDays);

    if (deltaDays === 0) return;

    const activity = activities[dragState.activityIndex];
    const originalStartDate = new Date(dragState.originalStart + 'T00:00:00');
    const originalEndDate = new Date(dragState.originalEnd + 'T00:00:00');

    let newStart: Date;
    let newEnd: Date;

    if (dragState.dragType === 'move') {
      newStart = addDays(originalStartDate, deltaDays);
      newEnd = addDays(originalEndDate, deltaDays);
    } else if (dragState.dragType === 'resize-start') {
      newStart = addDays(originalStartDate, deltaDays);
      newEnd = originalEndDate;
      if (newStart >= newEnd) return;
    } else {
      newStart = originalStartDate;
      newEnd = addDays(originalEndDate, deltaDays);
      if (newEnd <= newStart) return;
    }

    const newStartStr = format(newStart, 'yyyy-MM-dd');
    const newEndStr = format(newEnd, 'yyyy-MM-dd');

    if (activity.id) {
      onActivityDateChange(activity.id, newStartStr, newEndStr);
    }
  }, [dragState, activities, totalDays, onActivityDateChange]);

  const handleDragEnd = useCallback(() => {
    if (dragState) {
      toast.success('Datas atualizadas');
    }
    setDragState(null);
  }, [dragState]);

  // Calculate dependency lines
  const dependencyLines = useMemo(() => {
    const lines: { fromIndex: number; toIndex: number; fromActivity: Activity; toActivity: Activity }[] = [];
    
    activities.forEach((activity, toIndex) => {
      if (activity.predecessorIds && activity.predecessorIds.length > 0) {
        activity.predecessorIds.forEach(predId => {
          const fromIndex = activities.findIndex(a => a.id === predId);
          if (fromIndex >= 0) {
            lines.push({
              fromIndex,
              toIndex,
              fromActivity: activities[fromIndex],
              toActivity: activity,
            });
          }
        });
      }
    });
    
    return lines;
  }, [activities]);

  const renderDependencyLines = () => {
    return dependencyLines.map((line, idx) => {
      const fromStyle = getBarStyle(line.fromActivity.plannedStart, line.fromActivity.plannedEnd);
      const toStyle = getBarStyle(line.toActivity.plannedStart, line.toActivity.plannedEnd);
      
      const fromLeft = parseFloat(fromStyle.left) + parseFloat(fromStyle.width);
      const fromTop = line.fromIndex * 48 + 24;
      const toLeft = parseFloat(toStyle.left);
      const toTop = line.toIndex * 48 + 12;

      // Create SVG path for dependency arrow
      const pathD = `M ${fromLeft}% ${fromTop} L ${fromLeft + 1}% ${fromTop} L ${fromLeft + 1}% ${toTop - 6} L ${toLeft - 1}% ${toTop - 6} L ${toLeft - 1}% ${toTop} L ${toLeft}% ${toTop}`;

      return (
        <svg
          key={`dep-${idx}`}
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{ zIndex: 5 }}
        >
          <path
            d={pathD}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeDasharray="4,2"
            opacity="0.6"
          />
          {/* Arrow head */}
          <polygon
            points={`${toLeft}%,${toTop} ${toLeft - 0.5}%,${toTop - 4} ${toLeft - 0.5}%,${toTop + 4}`}
            fill="hsl(var(--primary))"
            opacity="0.6"
          />
        </svg>
      );
    });
  };

  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <p className="text-muted-foreground">Nenhuma atividade cadastrada no cronograma.</p>
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
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-sm shrink-0">Gráfico de Gantt</h3>
            {/* Period indicator */}
            <span 
              key={`${format(startDate, 'yyyyMM')}-${format(endDate, 'yyyyMM')}`}
              className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded hidden sm:inline-flex items-center gap-1 animate-fade-in"
            >
              <span className="capitalize">{format(startDate, 'MMM yyyy', { locale: ptBR })}</span>
              <span>→</span>
              <span className="capitalize">{format(endDate, 'MMM yyyy', { locale: ptBR })}</span>
            </span>
            {editable && (
              <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded hidden md:inline">
                Arraste para editar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs gap-1 px-2"
              onClick={handleToggleFullChart}
            >
              {showFullChart ? (
                <>
                  <Minimize2 className="h-3 w-3" />
                  <span className="hidden sm:inline">45 dias</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Ver tudo</span>
                </>
              )}
            </Button>
            
            <div className="h-4 w-px bg-border" />
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={handleZoomIn}
              disabled={currentZoomIndex === 0}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground capitalize">{zoomLevel}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={handleZoomOut}
              disabled={currentZoomIndex === zoomLevels.length - 1}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-3 py-2 border-b border-border text-xs flex-wrap">
          {hasAnyBaseline && (
            <button
              onClick={() => setBaselineVisible(!baselineVisible)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
                baselineVisible ? "bg-slate-500/20" : "bg-muted hover:bg-muted/80"
              )}
            >
              <div className="w-3 h-1 bg-slate-400 rounded-full" />
              <span className={baselineVisible ? "text-foreground" : "text-muted-foreground"}>
                Baseline {baselineVisible ? '✓' : ''}
              </span>
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-primary/30 border border-primary/50" />
            <span className="text-muted-foreground">Previsto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span className="text-muted-foreground">Concluído</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span className="text-muted-foreground">Em andamento</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-destructive" />
            <span className="text-muted-foreground">Atrasado</span>
          </div>
          {dependencyLines.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 border-t-2 border-dashed border-primary" />
              <span className="text-muted-foreground">Dependência</span>
            </div>
          )}
        </div>

        {/* Chart container */}
        <div 
          key={showFullChart ? 'full' : 'windowed'}
          className="flex animate-fade-in"
        >
          {/* Activity names column */}
          <div className="flex-shrink-0 w-48 border-r border-border">
            {/* Month header placeholder */}
            <div className="h-8 border-b border-border bg-muted/20" />
            
            {/* Activity labels */}
            {activities.map((activity, index) => {
              const computed = getActivityStatusAndProgress(activity);
              return (
                <div 
                  key={index}
                  className="h-12 px-3 flex items-center border-b border-border hover:bg-muted/20 transition-colors"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs font-medium truncate cursor-default flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-primary/60">
                          {index + 1}
                        </span>
                        {activity.description}
                        {activity.predecessorIds && activity.predecessorIds.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            ←{activity.predecessorIds.length}
                          </span>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">Peso: {activity.weight}%</p>
                      <p className="text-xs text-muted-foreground">
                        Status: {getStatusLabel(computed.status)}
                        {computed.isDelayedAuto && computed.delayDays > 0 && ` (${computed.delayDays} dias)`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Progresso: {computed.progress}%
                      </p>
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

          {/* Timeline area */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ minWidth: `${chartWidth}%` }} ref={chartRef}>
              {/* Month headers */}
              <div className="h-8 flex border-b border-border bg-muted/20">
                {months.map((month, idx) => {
                  const monthDays = month.days;
                  const width = (monthDays / totalDays) * 100;
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
                {/* Grid lines at 3-day intervals (matching S-Curve) */}
                {gridLines.map((line, idx) => {
                  const percent = (line.offset / totalDays) * 100;
                  const isWeekStart = line.date.getDay() === 1; // Monday
                  const isMonthStart = line.date.getDate() <= 3;
                  
                  return (
                    <Tooltip key={`grid-${idx}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "absolute top-0 bottom-0 w-3 -ml-1.5 cursor-default z-[1]",
                            "hover:bg-primary/5 transition-colors"
                          )}
                          style={{ left: `${percent}%` }}
                        >
                          <div
                            className={cn(
                              "absolute left-1/2 top-0 bottom-0 w-px",
                              isMonthStart ? "bg-border/60" : 
                              isWeekStart ? "bg-border/30" : 
                              "bg-border/15"
                            )}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-medium">{format(line.date, 'dd/MM/yyyy')}</p>
                        <p className="text-muted-foreground capitalize">
                          {format(line.date, 'EEEE', { locale: ptBR })}
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

                {activities.map((activity, index) => {
                  const plannedStyle = getBarStyle(activity.plannedStart, activity.plannedEnd);
                  const hasActual = activity.actualStart;
                  const actualStyle = hasActual 
                    ? getBarStyle(activity.actualStart!, activity.actualEnd || reportDate || format(new Date(), 'yyyy-MM-dd'))
                    : null;
                  
                  // Use centralized status computation
                  const computed = getActivityStatusAndProgress(activity);
                  const status = computed.status;
                  const activityProgress = computed.progress;
                  
                  const isDragging = dragState?.activityIndex === index;
                  const hasBaseline = activity.baselineStart && activity.baselineEnd;
                  const baselineStyle = hasBaseline 
                    ? getBarStyle(activity.baselineStart!, activity.baselineEnd!)
                    : null;

                  const showProgressLabel = parseFloat(plannedStyle.width) > 3; // Only show if bar is wide enough

                  return (
                    <div 
                      key={index}
                      className="h-12 relative border-b border-border hover:bg-muted/10 transition-colors"
                    >
                      {/* Baseline bar (shown behind planned bar) */}
                      {baselineVisible && baselineStyle && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className="absolute top-1.5 h-2 rounded-full bg-slate-400/40 border border-slate-400/60"
                              style={baselineStyle}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium text-slate-600">Baseline (Original)</p>
                            <p className="text-xs">
                              {format(new Date(activity.baselineStart!), 'dd/MM/yyyy')} - {format(new Date(activity.baselineEnd!), 'dd/MM/yyyy')}
                            </p>
                            {(activity.baselineStart !== activity.plannedStart || activity.baselineEnd !== activity.plannedEnd) && (
                              <p className="text-xs text-amber-600 mt-1">
                                ⚠ Datas alteradas desde o baseline
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {/* Planned bar - always visible with stronger styling */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className={cn(
                              "absolute top-3 h-5 rounded-sm transition-colors group border-2",
                              hasActual 
                                ? "bg-primary/15 border-primary/30" 
                                : "bg-primary/25 border-primary/50",
                              editable && "cursor-move hover:bg-primary/35",
                              isDragging && dragState?.dragType === 'move' && "ring-2 ring-primary"
                            )}
                            style={plannedStyle}
                            onMouseDown={(e) => handleDragStart(e, index, 'move')}
                          >
                            {/* Show progress label for activities without actual dates */}
                            {!hasActual && showProgressLabel && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-semibold text-primary/70">
                                  {activityProgress}%
                                </span>
                              </div>
                            )}
                            {editable && (
                              <>
                                {/* Resize handle - start */}
                                <div 
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-primary/50 rounded-l-sm"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, index, 'resize-start');
                                  }}
                                />
                                {/* Resize handle - end */}
                                <div 
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-primary/50 rounded-r-sm"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, index, 'resize-end');
                                  }}
                                />
                                {/* Drag indicator */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-50">
                                  <GripHorizontal className="h-2.5 w-2.5 text-primary" />
                                </div>
                              </>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">Previsto</p>
                          <p className="text-xs">
                            {format(parseLocalDate(activity.plannedStart), 'dd/MM/yyyy')} - {format(parseLocalDate(activity.plannedEnd), 'dd/MM/yyyy')}
                          </p>
                          {editable && <p className="text-xs text-muted-foreground mt-1">Arraste para mover ou redimensionar</p>}
                        </TooltipContent>
                      </Tooltip>

                      {/* Actual bar overlaid on planned bar */}
                      {hasActual && actualStyle && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className={cn(
                                "absolute top-3 h-5 rounded-sm cursor-pointer transition-colors flex items-center overflow-hidden",
                                statusColors[status]
                              )}
                              style={actualStyle}
                            >
                              {/* Progress percentage label inside bar */}
                              {showProgressLabel && (
                                <span className={cn(
                                  "text-[10px] font-bold px-1.5 whitespace-nowrap drop-shadow-sm text-white"
                                )}>
                                  {activityProgress}%
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">Real</p>
                            <p className="text-xs">
                              {format(parseLocalDate(activity.actualStart!), 'dd/MM/yyyy')} - {activity.actualEnd ? format(parseLocalDate(activity.actualEnd), 'dd/MM/yyyy') : 'Em andamento'}
                            </p>
                            <p className={cn(
                              "text-xs font-semibold mt-1",
                              activityProgress === 100 ? "text-green-600" :
                              activityProgress >= 50 ? "text-primary" :
                              "text-muted-foreground"
                            )}>
                              Progresso: {activityProgress}%
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}

                {/* Dependency lines */}
                {dependencyLines.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {dependencyLines.map((line, idx) => {
                      const fromEnd = getBarStyle(line.fromActivity.plannedStart, line.fromActivity.plannedEnd);
                      const toStart = getBarStyle(line.toActivity.plannedStart, line.toActivity.plannedEnd);
                      
                      const fromX = parseFloat(fromEnd.left) + parseFloat(fromEnd.width);
                      const toX = parseFloat(toStart.left);
                      const fromY = line.fromIndex * 48 + 14;
                      const toY = line.toIndex * 48 + 14;

                      const strokeColor = "hsl(var(--primary))";
                      const markerId = `arrowhead-${idx}`;

                      return (
                        <svg
                          key={`line-${idx}`}
                          className="absolute inset-0 w-full h-full overflow-visible"
                          style={{ zIndex: 5 }}
                          preserveAspectRatio="none"
                        >
                          <line
                            x1={`${fromX}%`}
                            y1={fromY}
                            x2={`${toX}%`}
                            y2={toY}
                            stroke={strokeColor}
                            strokeWidth="1.5"
                            strokeDasharray="4,3"
                            opacity="0.5"
                            markerEnd={`url(#${markerId})`}
                          />
                          <defs>
                            <marker
                              id={markerId}
                              markerWidth="6"
                              markerHeight="6"
                              refX="5"
                              refY="3"
                              orient="auto"
                            >
                              <polygon
                                points="0 0, 6 3, 0 6"
                                fill={strokeColor}
                                opacity="0.5"
                              />
                            </marker>
                          </defs>
                        </svg>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default GanttChart;