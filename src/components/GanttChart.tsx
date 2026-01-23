import { useMemo, useState, useRef, useCallback } from 'react';
import { format, differenceInDays, eachMonthOfInterval, startOfMonth, endOfMonth, addDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity } from '@/types/report';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface GanttChartProps {
  activities: Activity[];
  reportDate?: string;
  onActivityDateChange?: (activityId: string, newPlannedStart: string, newPlannedEnd: string) => void;
  editable?: boolean;
  showBaseline?: boolean;
}

type ZoomLevel = 'week' | 'month' | 'quarter';

interface DragState {
  activityIndex: number;
  dragType: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  originalStart: string;
  originalEnd: string;
}

const GanttChart = ({ activities, reportDate, onActivityDateChange, editable = false, showBaseline = true }: GanttChartProps) => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [baselineVisible, setBaselineVisible] = useState(showBaseline);
  const chartRef = useRef<HTMLDivElement>(null);

  const hasAnyBaseline = activities.some(a => a.baselineStart && a.baselineEnd);

  // Interval for grid lines (matching S-Curve's 3-day interval)
  const GRID_INTERVAL_DAYS = 3;

  const { startDate, endDate, totalDays, months, gridLines } = useMemo(() => {
    if (activities.length === 0) {
      const today = new Date();
      return {
        startDate: today,
        endDate: today,
        totalDays: 30,
        months: [{ date: today, label: format(today, 'MMM yyyy', { locale: ptBR }), days: 30 }],
        gridLines: []
      };
    }

    const allDates = activities.flatMap(a => [
      new Date(a.plannedStart + 'T00:00:00'),
      new Date(a.plannedEnd + 'T00:00:00'),
      ...(a.actualStart ? [new Date(a.actualStart + 'T00:00:00')] : []),
      ...(a.actualEnd ? [new Date(a.actualEnd + 'T00:00:00')] : []),
    ]);

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    const start = startOfMonth(minDate);
    const end = endOfMonth(maxDate);
    
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
  }, [activities]);

  const today = reportDate ? new Date(reportDate + 'T00:00:00') : new Date();
  const todayOffset = differenceInDays(today, startDate);
  const todayPercent = (todayOffset / totalDays) * 100;

  const getBarStyle = (start: string, end: string) => {
    const startD = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');
    
    const leftDays = differenceInDays(startD, startDate);
    const widthDays = differenceInDays(endD, startD) + 1;
    
    const left = (leftDays / totalDays) * 100;
    const width = (widthDays / totalDays) * 100;
    
    return { left: `${left}%`, width: `${Math.max(width, 0.5)}%` };
  };

  const getActivityStatus = (activity: Activity): 'completed' | 'in-progress' | 'delayed' | 'pending' => {
    if (activity.actualEnd) return 'completed';
    if (activity.actualStart) {
      const plannedEnd = new Date(activity.plannedEnd + 'T00:00:00');
      if (today > plannedEnd) return 'delayed';
      return 'in-progress';
    }
    const plannedStart = new Date(activity.plannedStart + 'T00:00:00');
    if (today > plannedStart) return 'delayed';
    return 'pending';
  };

  const statusColors = {
    completed: 'bg-green-500',
    'in-progress': 'bg-primary',
    delayed: 'bg-destructive',
    pending: 'bg-muted-foreground/30',
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

  // Calculate critical path using forward/backward pass
  const criticalPath = useMemo(() => {
    if (activities.length === 0) return new Set<string>();

    // Build activity map by id
    const activityMap = new Map(activities.map(a => [a.id, a]));
    
    // Calculate duration for each activity
    const getDuration = (activity: Activity): number => {
      const start = new Date(activity.plannedStart + 'T00:00:00');
      const end = new Date(activity.plannedEnd + 'T00:00:00');
      return differenceInDays(end, start) + 1;
    };

    // Forward pass - calculate earliest start/finish
    const earliestStart = new Map<string, number>();
    const earliestFinish = new Map<string, number>();
    
    // Find activities without predecessors (starting activities)
    const processed = new Set<string>();
    const queue: string[] = [];
    
    activities.forEach(a => {
      if (!a.predecessorIds || a.predecessorIds.length === 0) {
        earliestStart.set(a.id!, 0);
        earliestFinish.set(a.id!, getDuration(a));
        processed.add(a.id!);
        queue.push(a.id!);
      }
    });

    // Process remaining activities
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      // Find successors
      activities.forEach(a => {
        if (a.predecessorIds?.includes(currentId) && !processed.has(a.id!)) {
          // Check if all predecessors are processed
          const allPredecessorsProcessed = a.predecessorIds.every(pid => processed.has(pid));
          if (allPredecessorsProcessed) {
            // Earliest start is max of all predecessors' earliest finish
            const es = Math.max(
              ...a.predecessorIds.map(pid => earliestFinish.get(pid) || 0)
            );
            earliestStart.set(a.id!, es);
            earliestFinish.set(a.id!, es + getDuration(a));
            processed.add(a.id!);
            queue.push(a.id!);
          }
        }
      });
    }

    // Handle any remaining activities (no predecessors but not yet processed)
    activities.forEach(a => {
      if (!processed.has(a.id!)) {
        earliestStart.set(a.id!, 0);
        earliestFinish.set(a.id!, getDuration(a));
      }
    });

    // Project end time (max of all earliest finish times)
    const projectEnd = Math.max(...Array.from(earliestFinish.values()));

    // Backward pass - calculate latest start/finish
    const latestFinish = new Map<string, number>();
    const latestStart = new Map<string, number>();
    
    // Build successor map
    const successors = new Map<string, string[]>();
    activities.forEach(a => {
      successors.set(a.id!, []);
    });
    activities.forEach(a => {
      a.predecessorIds?.forEach(pid => {
        const succs = successors.get(pid) || [];
        succs.push(a.id!);
        successors.set(pid, succs);
      });
    });

    // Find activities without successors (ending activities)
    const processedBack = new Set<string>();
    const queueBack: string[] = [];
    
    activities.forEach(a => {
      const succs = successors.get(a.id!) || [];
      if (succs.length === 0) {
        latestFinish.set(a.id!, projectEnd);
        latestStart.set(a.id!, projectEnd - getDuration(a));
        processedBack.add(a.id!);
        queueBack.push(a.id!);
      }
    });

    // Process remaining activities backwards
    while (queueBack.length > 0) {
      const currentId = queueBack.shift()!;
      const current = activityMap.get(currentId);
      
      if (current?.predecessorIds) {
        current.predecessorIds.forEach(predId => {
          if (!processedBack.has(predId)) {
            // Check if all successors are processed
            const predSuccessors = successors.get(predId) || [];
            const allSuccessorsProcessed = predSuccessors.every(sid => processedBack.has(sid));
            
            if (allSuccessorsProcessed) {
              // Latest finish is min of all successors' latest start
              const lf = Math.min(
                ...predSuccessors.map(sid => latestStart.get(sid) || projectEnd)
              );
              const pred = activityMap.get(predId);
              if (pred) {
                latestFinish.set(predId, lf);
                latestStart.set(predId, lf - getDuration(pred));
                processedBack.add(predId);
                queueBack.push(predId);
              }
            }
          }
        });
      }
    }

    // Handle any remaining activities
    activities.forEach(a => {
      if (!processedBack.has(a.id!)) {
        latestFinish.set(a.id!, projectEnd);
        latestStart.set(a.id!, projectEnd - getDuration(a));
      }
    });

    // Calculate slack and identify critical path (slack = 0)
    const criticalActivities = new Set<string>();
    
    activities.forEach(a => {
      const es = earliestStart.get(a.id!) || 0;
      const ls = latestStart.get(a.id!) || 0;
      const slack = ls - es;
      
      if (slack === 0) {
        criticalActivities.add(a.id!);
      }
    });

    return criticalActivities;
  }, [activities]);

  // Calculate dependency lines
  const dependencyLines = useMemo(() => {
    const lines: { fromIndex: number; toIndex: number; fromActivity: Activity; toActivity: Activity; isCritical: boolean }[] = [];
    
    activities.forEach((activity, toIndex) => {
      if (activity.predecessorIds && activity.predecessorIds.length > 0) {
        activity.predecessorIds.forEach(predId => {
          const fromIndex = activities.findIndex(a => a.id === predId);
          if (fromIndex >= 0) {
            // Check if both activities are on critical path
            const isCritical = criticalPath.has(activity.id!) && criticalPath.has(predId);
            lines.push({
              fromIndex,
              toIndex,
              fromActivity: activities[fromIndex],
              toActivity: activity,
              isCritical,
            });
          }
        });
      }
    });
    
    return lines;
  }, [activities, criticalPath]);

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
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Gráfico de Gantt</h3>
            {editable && (
              <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded">
                Arraste para editar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            <div className="w-3 h-3 rounded-sm bg-primary/30 border border-primary" />
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
          {criticalPath.size > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-500 ring-2 ring-amber-500/50" />
              <span className="text-muted-foreground">Caminho Crítico</span>
            </div>
          )}
          {dependencyLines.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 border-t-2 border-dashed border-primary" />
              <span className="text-muted-foreground">Dependência</span>
            </div>
          )}
        </div>

        {/* Chart container */}
        <div className="flex">
          {/* Activity names column */}
          <div className="flex-shrink-0 w-48 border-r border-border">
            {/* Month header placeholder */}
            <div className="h-8 border-b border-border bg-muted/20" />
            
            {/* Activity labels */}
            {activities.map((activity, index) => {
              const isCritical = criticalPath.has(activity.id!);
              return (
                <div 
                  key={index}
                  className={cn(
                    "h-12 px-3 flex items-center border-b border-border hover:bg-muted/20 transition-colors",
                    isCritical && "bg-amber-500/5"
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs font-medium truncate cursor-default flex items-center gap-1.5">
                        <span className={cn(
                          "font-mono text-[10px]",
                          isCritical ? "text-amber-600 font-bold" : "text-primary/60"
                        )}>
                          {index + 1}
                        </span>
                        {activity.description}
                        {isCritical && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1 rounded">
                            CC
                          </span>
                        )}
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
                      {isCritical && (
                        <p className="text-xs text-amber-600 font-medium">
                          ⚠ Caminho Crítico (folga = 0)
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
                    <div
                      key={`grid-${idx}`}
                      className={cn(
                        "absolute top-0 bottom-0 pointer-events-none",
                        isMonthStart ? "border-l border-border/60" : 
                        isWeekStart ? "border-l border-border/30" : 
                        "border-l border-border/15"
                      )}
                      style={{ left: `${percent}%` }}
                    />
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
                  const status = getActivityStatus(activity);
                  const isDragging = dragState?.activityIndex === index;
                  const isCritical = criticalPath.has(activity.id!);
                  const hasBaseline = activity.baselineStart && activity.baselineEnd;
                  const baselineStyle = hasBaseline 
                    ? getBarStyle(activity.baselineStart!, activity.baselineEnd!)
                    : null;

                  return (
                    <div 
                      key={index}
                      className={cn(
                        "h-12 relative border-b border-border hover:bg-muted/10 transition-colors",
                        isCritical && "bg-amber-500/5"
                      )}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className={cn(
                              "absolute top-2 h-3 rounded-sm transition-colors group",
                              isCritical 
                                ? "bg-amber-500/30 border-2 border-amber-500 ring-1 ring-amber-500/30" 
                                : "bg-primary/20 border border-primary/40",
                              editable && "cursor-move hover:bg-primary/30",
                              isDragging && dragState?.dragType === 'move' && "ring-2 ring-primary"
                            )}
                            style={plannedStyle}
                            onMouseDown={(e) => handleDragStart(e, index, 'move')}
                          >
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
                            {format(new Date(activity.plannedStart), 'dd/MM/yyyy')} - {format(new Date(activity.plannedEnd), 'dd/MM/yyyy')}
                          </p>
                          {editable && <p className="text-xs text-muted-foreground mt-1">Arraste para mover ou redimensionar</p>}
                        </TooltipContent>
                      </Tooltip>

                      {/* Actual bar */}
                      {actualStyle && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className={cn(
                                "absolute top-6 h-3 rounded-sm cursor-pointer transition-colors",
                                statusColors[status],
                                status === 'in-progress' && "animate-pulse"
                              )}
                              style={actualStyle}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">Real</p>
                            <p className="text-xs">
                              {format(new Date(activity.actualStart!), 'dd/MM/yyyy')} - {activity.actualEnd ? format(new Date(activity.actualEnd), 'dd/MM/yyyy') : 'Em andamento'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}

                {/* Dependency lines - rendered as simple indicators for now */}
                {dependencyLines.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {dependencyLines.map((line, idx) => {
                      const fromEnd = getBarStyle(line.fromActivity.plannedStart, line.fromActivity.plannedEnd);
                      const toStart = getBarStyle(line.toActivity.plannedStart, line.toActivity.plannedEnd);
                      
                      const fromX = parseFloat(fromEnd.left) + parseFloat(fromEnd.width);
                      const toX = parseFloat(toStart.left);
                      const fromY = line.fromIndex * 48 + 14;
                      const toY = line.toIndex * 48 + 14;

                      const strokeColor = line.isCritical ? "hsl(var(--chart-4))" : "hsl(var(--primary))";
                      const markerId = line.isCritical ? `arrowhead-critical-${idx}` : `arrowhead-${idx}`;

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
                            strokeWidth={line.isCritical ? "2.5" : "1.5"}
                            strokeDasharray={line.isCritical ? "none" : "4,3"}
                            opacity={line.isCritical ? "0.8" : "0.5"}
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
                                opacity={line.isCritical ? "0.8" : "0.5"}
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