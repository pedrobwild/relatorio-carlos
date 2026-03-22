import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from "recharts";
import { Activity } from "@/types/report";
import { TrendingUp, Maximize2, Minimize2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { calcWeightedProgress } from "@/lib/progressCalc";

interface SCurveChartProps {
  activities: Activity[];
  reportDate?: string; // Data de geração do relatório (YYYY-MM-DD)
  showFullChart?: boolean;
  onShowFullChartChange?: (showFull: boolean) => void;
}

// Parse ISO date string to Date object
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00");
};

// Format date for display (dd/mm or dd/mm/aa if different year)
const formatDisplayDate = (dateStr: string, baseYear?: number): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  
  if (baseYear && year !== baseYear) {
    return `${day}/${month}/${year.toString().slice(-2)}`;
  }
  return `${day}/${month}`;
};

// Find activity in progress at a given date
const findActivityAtDate = (activities: Activity[], dateStr: string): string | null => {
  const currentDate = parseDate(dateStr);
  if (!currentDate) return null;
  
  // First, try to find activity based on actual dates (more accurate)
  for (const activity of activities) {
    const actualStart = parseDate(activity.actualStart);
    const actualEnd = parseDate(activity.actualEnd);
    
    // If activity has actual data, check if date falls within actual execution
    if (actualStart && actualEnd) {
      if (currentDate >= actualStart && currentDate <= actualEnd) {
        return activity.description;
      }
    } else if (actualStart && !actualEnd) {
      // Activity started but not finished - still in progress
      if (currentDate >= actualStart) {
        return activity.description;
      }
    }
  }
  
  // Fallback to planned dates
  for (const activity of activities) {
    const plannedStart = parseDate(activity.plannedStart);
    const plannedEnd = parseDate(activity.plannedEnd);
    
    if (plannedStart && plannedEnd) {
      if (currentDate >= plannedStart && currentDate <= plannedEnd) {
        return activity.description;
      }
    }
  }
  
  // If no activity found, find the last completed one
  const sortedActivities = [...activities]
    .filter(a => a.plannedEnd)
    .sort((a, b) => {
      const dateA = parseDate(a.plannedEnd);
      const dateB = parseDate(b.plannedEnd);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });
  
  for (const activity of sortedActivities) {
    const plannedEnd = parseDate(activity.plannedEnd);
    if (plannedEnd && currentDate >= plannedEnd) {
      return activity.description;
    }
  }
  
  return null;
};

// Generate S-Curve data from activities using weighted progress with temporal scale
// Now with intermediate points for smoother visualization
const generateChartData = (activities: Activity[], reportDate?: string) => {
  if (activities.length === 0) {
    return { 
      data: [{ date: "Início", previsto: 0, realizado: null, timestamp: 0, activity: null }],
      milestones: { start: 0, end: 0, today: 0, half: 0 }
    };
  }

  // Get base year from first activity
  const baseYear = activities[0].plannedStart 
    ? new Date(activities[0].plannedStart + "T00:00:00").getFullYear()
    : new Date().getFullYear();

  // Parse report date (defaults to today if not provided)
  const reportDateParsed = reportDate 
    ? parseDate(reportDate) 
    : new Date();

  // Check if any activity has weight defined
  const hasWeights = activities.some(a => a.weight !== undefined);
  
  // Calculate total weight (should be 100, but normalize if not)
  const totalWeight = hasWeights 
    ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
    : activities.length;

  // Find project date range
  const dateRange = activities.reduce<{ min: Date | null; max: Date | null }>((acc, a) => {
    const dates = [
      parseDate(a.plannedStart),
      parseDate(a.plannedEnd),
      parseDate(a.actualStart),
      parseDate(a.actualEnd)
    ].filter(Boolean) as Date[];
    
    for (const d of dates) {
      if (!acc.min || d < acc.min) acc.min = d;
      if (!acc.max || d > acc.max) acc.max = d;
    }
    return acc;
  }, { min: null, max: null });

  const resolvedMin = dateRange.min;
  const resolvedMax = dateRange.max;
  
  if (!resolvedMin || !resolvedMax) {
    return { 
      data: [{ date: "Início", previsto: 0, realizado: null, timestamp: 0, activity: null }],
      milestones: { start: 0, end: 0, today: 0, half: 0 }
    };
  }

  // Generate dates at regular intervals (every 3 days) for smoother curve
  const INTERVAL_DAYS = 3;
  const allDates: string[] = [];
  const currentDate = new Date(resolvedMin);
  
  while (currentDate <= resolvedMax) {
    const isoDate = currentDate.toISOString().split('T')[0];
    allDates.push(isoDate);
    currentDate.setDate(currentDate.getDate() + INTERVAL_DAYS);
  }
  
  // Always include the last date
  const maxIsoDate = resolvedMax.toISOString().split('T')[0];
  if (!allDates.includes(maxIsoDate)) {
    allDates.push(maxIsoDate);
  }
  
  // Also include key activity dates for precision
  activities.forEach(a => {
    [a.plannedStart, a.plannedEnd, a.actualStart, a.actualEnd]
      .filter(Boolean)
      .forEach(d => {
        if (!allDates.includes(d!)) {
          allDates.push(d!);
        }
      });
  });
  
  // Sort all dates
  allDates.sort((a, b) => {
    const dateA = parseDate(a);
    const dateB = parseDate(b);
    if (!dateA || !dateB) return 0;
    return dateA.getTime() - dateB.getTime();
  });

  const firstDate = resolvedMin;
  const lastPlannedDate = activities.reduce((latest, a) => {
    const plannedEnd = parseDate(a.plannedEnd);
    if (plannedEnd && (!latest || plannedEnd > latest)) return plannedEnd;
    return latest;
  }, null as Date | null);
  
  // Calculate milestone timestamps (days from start)
  const startTimestamp = 0;
  const endTimestamp = firstDate && lastPlannedDate 
    ? Math.floor((lastPlannedDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const todayTimestamp = firstDate && reportDateParsed
    ? Math.floor((reportDateParsed.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Find the date when 50% planned progress is reached
  let halfTimestamp = 0;
  let cumulativeWeight = 0;
  const sortedActivitiesByPlannedEnd = [...activities]
    .filter(a => a.plannedEnd)
    .sort((a, b) => {
      const dateA = parseDate(a.plannedEnd);
      const dateB = parseDate(b.plannedEnd);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });
  
  for (const activity of sortedActivitiesByPlannedEnd) {
    cumulativeWeight += hasWeights ? (activity.weight || 0) : 1;
    if ((cumulativeWeight / totalWeight) >= 0.5) {
      const plannedEnd = parseDate(activity.plannedEnd);
      if (plannedEnd && firstDate) {
        halfTimestamp = Math.floor((plannedEnd.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      break;
    }
  }

  const milestones = {
    start: startTimestamp,
    end: endTimestamp,
    today: todayTimestamp,
    half: halfTimestamp
  };
  
  const data = allDates.map(date => {
    const currentDate = parseDate(date);
    if (!currentDate || !firstDate) return { date: formatDisplayDate(date, baseYear), previsto: 0, realizado: null, timestamp: 0, activity: null };
    
    // Calculate timestamp as days from start for proper X-axis scaling
    const daysSinceStart = Math.floor((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Find activity at this date
    const activityAtDate = findActivityAtDate(activities, date);
    
    // Calculate planned progress using weights (cumulative at this date)
    const plannedProgress = activities.reduce((sum, a) => {
      const plannedEnd = parseDate(a.plannedEnd);
      if (plannedEnd && plannedEnd <= currentDate) {
        return sum + (hasWeights ? (a.weight || 0) : 1);
      }
      return sum;
    }, 0);
    
    // Only show "realizado" for dates up to report date AND only if there are actual dates
    const isFutureDate = reportDateParsed && currentDate > reportDateParsed;
    
    // Check if any activity has actual data
    const hasAnyActualData = activities.some(a => a.actualEnd);
    
    // Calculate actual progress using weights
    let actualProgress: number | null = null;
    if (!isFutureDate && hasAnyActualData) {
      const actualSum = activities.reduce((sum, a) => {
        const actualEnd = parseDate(a.actualEnd);
        if (actualEnd && actualEnd <= currentDate) {
          return sum + (hasWeights ? (a.weight || 0) : 1);
        }
        return sum;
      }, 0);
      actualProgress = actualSum;
    }

    const previstoValue = Math.round((plannedProgress / totalWeight) * 100);
    const realizadoValue = actualProgress !== null ? Math.round((actualProgress / totalWeight) * 100) : null;
    
    return {
      date: formatDisplayDate(date, baseYear),
      timestamp: daysSinceStart,
      previsto: previstoValue,
      realizado: realizadoValue,
      activity: activityAtDate,
    };
  });

  return { data, milestones };
};

// Custom reference line label component
const ReferenceLabel = ({ viewBox, label, position = 'top', highlight = false }: { viewBox?: any; label: string; position?: 'top' | 'bottom'; highlight?: boolean }) => {
  if (!viewBox) return null;
  const { x } = viewBox;
  
  if (highlight) {
    // Estimate width based on label length (approx 5.5px per char at fontSize 9)
    const estimatedWidth = Math.max(64, label.length * 5.5 + 16);
    const rectHeight = 20;
    return (
      <g>
        <rect
          x={x - estimatedWidth / 2}
          y={1}
          width={estimatedWidth}
          height={rectHeight}
          rx={5}
          fill="hsl(var(--primary))"
        />
        <text
          x={x}
          y={14.5}
          fill="white"
          fontSize={9}
          textAnchor="middle"
          fontWeight={700}
        >
          {label}
        </text>
      </g>
    );
  }
  
  return (
    <text
      x={x}
      y={position === 'top' ? 16 : viewBox.height - 4}
      fill="hsl(var(--muted-foreground))"
      fontSize={8}
      textAnchor="middle"
      fontWeight={500}
    >
      {label}
    </text>
  );
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    payload?: {
      activity?: string | null;
      date?: string;
    };
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const activity = payload[0]?.payload?.activity;
    const formattedDate = payload[0]?.payload?.date;
    
    return (
      <div className="bg-card border border-border rounded-xl shadow-xl p-3 sm:p-3.5 min-w-[160px] sm:min-w-[200px] z-50 animate-fade-in transition-all duration-200 ease-out">
        <p className="text-sm sm:text-base font-bold text-foreground mb-2">
          {formattedDate || label}
        </p>
        
        {/* Activity in progress at this date */}
        {activity && (
          <div className="mb-2.5 pb-2.5 border-b border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              Etapa em execução
            </p>
            <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">
              {activity}
            </p>
          </div>
        )}
        
        {/* Progress values */}
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {entry.dataKey === "previsto" ? "Previsto" : "Realizado"}
                </span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {entry.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Custom legend component
const CustomLegend = () => (
  <div className="flex items-center justify-center gap-6 sm:gap-8 mt-3 sm:mt-4 pt-3 border-t border-border/30">
    <div className="flex items-center gap-2">
      <span className="w-6 h-0.5 bg-primary opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(var(--primary)) 0px, hsl(var(--primary)) 4px, transparent 4px, transparent 6px)' }} />
      <span className="text-xs sm:text-sm text-muted-foreground">Previsto</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="w-6 h-1 rounded-full" style={{ backgroundColor: '#22c55e' }} />
      <span className="text-xs sm:text-sm font-semibold" style={{ color: '#22c55e' }}>Realizado</span>
    </div>
  </div>
);

const SCurveChart = ({ 
  activities, 
  reportDate,
  showFullChart: controlledShowFull,
  onShowFullChartChange 
}: SCurveChartProps) => {
  const { data: chartData, milestones } = generateChartData(activities, reportDate);
  
  // Find current activity in progress (has actualStart but no actualEnd)
  const currentActivity = activities.find(a => a.actualStart && !a.actualEnd);
  
  // Get last data point for comparison
  const lastPoint = chartData[chartData.length - 1];

  // Use unified progress calculation (same as header and card)
  const todayRealizado = useMemo(() => {
    return calcWeightedProgress(
      activities.map(a => ({ weight: a.weight, actualEnd: a.actualEnd }))
    );
  }, [activities]);

  // Toggle between 30-day window and full view (controlled or uncontrolled)
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

  // Calculate 30-day window around "today" (milestones.today)
  const windowedData = useMemo(() => {
    if (showFullChart) return chartData;
    
    const todayTimestamp = milestones.today;
    const windowStart = todayTimestamp - 30;
    const windowEnd = todayTimestamp + 15;
    
    return chartData.filter(d => d.timestamp >= windowStart && d.timestamp <= windowEnd);
  }, [chartData, milestones.today, showFullChart]);

  // Check if there's more data than what fits in the 30-day window (calculated once, not based on current view)
  const hasMoreData = useMemo(() => {
    const todayTimestamp = milestones.today;
    const windowStart = todayTimestamp - 30;
    const windowEnd = todayTimestamp + 15;
    const windowedLength = chartData.filter(d => d.timestamp >= windowStart && d.timestamp <= windowEnd).length;
    return chartData.length > windowedLength;
  }, [chartData, milestones.today]);

  return (
    <div className="mb-3 md:mb-4">
      {/* Header with title and description */}
      <div className="flex flex-col gap-1.5 mb-2 md:mb-3">
        <div className="flex items-start gap-2">
          <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs md:text-base font-bold text-foreground tracking-tight">
                Cronograma Previsto x Realizado
              </h2>
              {/* Period indicator */}
              {windowedData.length > 0 && (
                <span 
                  key={`${windowedData[0]?.date}-${windowedData[windowedData.length - 1]?.date}`}
                  className="text-[10px] md:text-xs text-muted-foreground bg-secondary px-1.5 md:px-2 py-0.5 rounded inline-flex items-center gap-1 animate-fade-in"
                >
                  <span>{windowedData[0]?.date}</span>
                  <span>→</span>
                  <span>{windowedData[windowedData.length - 1]?.date}</span>
                </span>
              )}
            </div>
            <p className="text-[9px] md:text-xs text-muted-foreground hidden md:block">
              {showFullChart ? "Visão completa do projeto" : "Janela de 45 dias (-30 a +15 dias do hoje)"}
            </p>
          </div>
          {/* Toggle full/windowed view */}
          {hasMoreData && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-[10px] md:text-xs gap-1 px-2"
              onClick={handleToggleFullChart}
            >
              {showFullChart ? (
                <>
                  <Minimize2 className="h-3 w-3" />
                  <span className="hidden sm:inline">30 dias</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Ver tudo</span>
                </>
              )}
            </Button>
          )}
        </div>
        
        {/* Current activity indicator - Plain text */}
        {currentActivity && (
          <p className="text-[10px] sm:text-xs font-medium text-foreground md:self-start">
            {currentActivity.description}
          </p>
        )}
      </div>

      {/* Chart Container */}
      <div 
        key={showFullChart ? 'full' : 'windowed'}
        className="bg-secondary/30 rounded-xl p-2.5 sm:p-4 md:p-6 border border-border/50 animate-fade-in"
      >
        <div className="h-[200px] sm:h-[280px] md:h-[360px] lg:h-[400px] w-full transition-all duration-300 ease-out">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={windowedData}
              margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="linear"
                domain={['dataMin', 'dataMax']}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                tickFormatter={(value) => {
                  const point = chartData.find(d => d.timestamp === value);
                  return point?.date || '';
                }}
                ticks={windowedData.map(d => d.timestamp)}
                angle={-45}
                textAnchor="end"
                height={40}
                dy={6}
              />
              
              {/* Reference lines for milestones */}
              <ReferenceLine
                x={milestones.start}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={<ReferenceLabel label="Início" />}
              />
              <ReferenceLine
                x={milestones.today}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                strokeOpacity={0.8}
                label={<ReferenceLabel label={`${todayRealizado}% Execução`} highlight />}
              />
              <ReferenceLine
                x={milestones.end}
                stroke="hsl(var(--success))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={<ReferenceLabel label="Entrega" />}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                width={38}
              />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.2, strokeWidth: 1 }}
                wrapperStyle={{ 
                  zIndex: 50,
                  transition: 'transform 150ms ease-out, opacity 150ms ease-out'
                }}
                animationDuration={150}
                animationEasing="ease-out"
              />
              {/* Linha de Previsto - roxo claro tracejado */}
              <Line
                type="monotone"
                dataKey="previsto"
                name="previsto"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeOpacity={0.5}
                strokeDasharray="6 4"
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 2, opacity: 0.6 }}
                activeDot={(props: any) => {
                  const { cx, cy } = props;
                  return (
                    <g>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={10}
                        fill="hsl(var(--primary))"
                        opacity={0.15}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      />
                    </g>
                  );
                }}
              />
              {/* Linha de Realizado - verde sólido com offset para evitar sobreposição */}
              <Line
                type="monotone"
                dataKey="realizado"
                name="realizado"
                stroke="#22c55e"
                strokeWidth={3.5}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy, payload } = props as { cx: number; cy: number; payload: { realizado: number | null } };
                  if (payload.realizado === null) return <></>;

                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#22c55e"
                      stroke="white"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={(props: any) => {
                  const { cx, cy } = props;
                  return (
                    <g>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={14}
                        fill="#22c55e"
                        opacity={0.2}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill="#22c55e"
                        stroke="white"
                        strokeWidth={2}
                        className="drop-shadow-lg"
                      />
                    </g>
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Custom Legend below chart */}
        <CustomLegend />
      </div>

    </div>
  );
};

export default SCurveChart;