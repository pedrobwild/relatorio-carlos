import { useMemo, useState, useRef, useCallback } from 'react';
import { format, differenceInDays, eachMonthOfInterval, startOfMonth, endOfMonth, addDays } from 'date-fns';
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
}

type ZoomLevel = 'week' | 'month' | 'quarter';

interface DragState {
  activityIndex: number;
  dragType: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  originalStart: string;
  originalEnd: string;
}

const GanttChart = ({ activities, reportDate, onActivityDateChange, editable = false }: GanttChartProps) => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const { startDate, endDate, totalDays, months } = useMemo(() => {
    if (activities.length === 0) {
      const today = new Date();
      return {
        startDate: today,
        endDate: today,
        totalDays: 30,
        months: [{ date: today, label: format(today, 'MMM yyyy', { locale: ptBR }), days: 30 }]
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

    return {
      startDate: start,
      endDate: end,
      totalDays: differenceInDays(end, start) + 1,
      months,
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
            {activities.map((activity, index) => (
              <div 
                key={index}
                className="h-12 px-3 flex items-center border-b border-border hover:bg-muted/20 transition-colors"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs font-medium truncate cursor-default flex items-center gap-1.5">
                      <span className="text-primary/60 font-mono text-[10px]">{index + 1}</span>
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
                    {activity.predecessorIds && activity.predecessorIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Depende de: {activity.predecessorIds.length} atividade(s)
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
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

                  return (
                    <div 
                      key={index}
                      className="h-12 relative border-b border-border hover:bg-muted/10 transition-colors"
                    >
                      {/* Planned bar */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className={cn(
                              "absolute top-2 h-3 rounded-sm bg-primary/20 border border-primary/40 transition-colors group",
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
                            stroke="hsl(var(--primary))"
                            strokeWidth="1.5"
                            strokeDasharray="4,3"
                            opacity="0.5"
                            markerEnd="url(#arrowhead)"
                          />
                          <defs>
                            <marker
                              id="arrowhead"
                              markerWidth="6"
                              markerHeight="6"
                              refX="5"
                              refY="3"
                              orient="auto"
                            >
                              <polygon
                                points="0 0, 6 3, 0 6"
                                fill="hsl(var(--primary))"
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