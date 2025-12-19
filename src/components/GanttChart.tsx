import { useMemo, useState } from 'react';
import { format, differenceInDays, eachMonthOfInterval, startOfMonth, endOfMonth, isWithinInterval, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity } from '@/types/report';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GanttChartProps {
  activities: Activity[];
  reportDate?: string;
}

type ZoomLevel = 'week' | 'month' | 'quarter';

const GanttChart = ({ activities, reportDate }: GanttChartProps) => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [scrollOffset, setScrollOffset] = useState(0);

  const { startDate, endDate, totalDays, months } = useMemo(() => {
    if (activities.length === 0) {
      const today = new Date();
      return {
        startDate: today,
        endDate: today,
        totalDays: 30,
        months: [{ date: today, label: format(today, 'MMM yyyy', { locale: ptBR }) }]
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
    
    // Add padding
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

  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <p className="text-muted-foreground">Nenhuma atividade cadastrada no cronograma.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-sm">Gráfico de Gantt</h3>
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
        <div className="flex items-center gap-4 px-3 py-2 border-b border-border text-xs">
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
                    <span className="text-xs font-medium truncate cursor-default">
                      {activity.description}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">Peso: {activity.weight}%</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>

          {/* Timeline area */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ minWidth: `${chartWidth}%` }}>
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

                  return (
                    <div 
                      key={index}
                      className="h-12 relative border-b border-border hover:bg-muted/10 transition-colors"
                    >
                      {/* Planned bar */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className="absolute top-2 h-3 rounded-sm bg-primary/20 border border-primary/40 cursor-pointer hover:bg-primary/30 transition-colors"
                            style={plannedStyle}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">Previsto</p>
                          <p className="text-xs">
                            {format(new Date(activity.plannedStart), 'dd/MM/yyyy')} - {format(new Date(activity.plannedEnd), 'dd/MM/yyyy')}
                          </p>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default GanttChart;
