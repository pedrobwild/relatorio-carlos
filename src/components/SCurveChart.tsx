import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity } from "@/types/report";
import { TrendingUp } from "lucide-react";

interface SCurveChartProps {
  activities: Activity[];
  reportDate?: string; // Data de geração do relatório (YYYY-MM-DD)
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

// Generate S-Curve data from activities using weighted progress with temporal scale
const generateChartData = (activities: Activity[], reportDate?: string) => {
  if (activities.length === 0) {
    return [{ date: "Início", previsto: 0, realizado: null, timestamp: 0 }];
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
  const hasWeights = activities.some(a => (a as any).weight !== undefined);
  
  // Calculate total weight (should be 100, but normalize if not)
  const totalWeight = hasWeights 
    ? activities.reduce((sum, a) => sum + ((a as any).weight || 0), 0)
    : activities.length;

  // Collect all unique dates - only planned dates and actual dates that exist
  const plannedDates = new Set<string>();
  const actualDates = new Set<string>();
  
  activities.forEach(a => {
    if (a.plannedStart) plannedDates.add(a.plannedStart);
    if (a.plannedEnd) plannedDates.add(a.plannedEnd);
    if (a.actualStart) actualDates.add(a.actualStart);
    if (a.actualEnd) actualDates.add(a.actualEnd);
  });

  // Combine all dates for sorting
  const allDates = new Set([...plannedDates, ...actualDates]);

  const sortedDates = Array.from(allDates).sort((a, b) => {
    const dateA = parseDate(a);
    const dateB = parseDate(b);
    if (!dateA || !dateB) return 0;
    return dateA.getTime() - dateB.getTime();
  });

  // Get first and last dates for reference
  const firstDate = sortedDates.length > 0 ? parseDate(sortedDates[0]) : null;
  
  return sortedDates.map(date => {
    const currentDate = parseDate(date);
    if (!currentDate || !firstDate) return { date: formatDisplayDate(date, baseYear), previsto: 0, realizado: null, timestamp: 0 };
    
    // Calculate timestamp as days from start for proper X-axis scaling
    const daysSinceStart = Math.floor((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate planned progress using weights
    const plannedProgress = activities.reduce((sum, a) => {
      const plannedEnd = parseDate(a.plannedEnd);
      if (plannedEnd && plannedEnd <= currentDate) {
        return sum + (hasWeights ? ((a as any).weight || 0) : 1);
      }
      return sum;
    }, 0);
    
    // Only show "realizado" for dates up to report date AND only if there are actual dates
    const isFutureDate = reportDateParsed && currentDate > reportDateParsed;
    
    // Check if any activity has actual data for this date
    const hasAnyActualData = activities.some(a => a.actualEnd);
    
    // Calculate actual progress using weights
    let actualProgress: number | null = null;
    if (!isFutureDate && hasAnyActualData) {
      const actualSum = activities.reduce((sum, a) => {
        const actualEnd = parseDate(a.actualEnd);
        if (actualEnd && actualEnd <= currentDate) {
          return sum + (hasWeights ? ((a as any).weight || 0) : 1);
        }
        return sum;
      }, 0);
      // Only show realizado if at least one activity has completed by this date
      // or if this date is from actual dates set
      if (actualSum > 0 || actualDates.has(date)) {
        actualProgress = actualSum;
      }
    }

    return {
      date: formatDisplayDate(date, baseYear),
      timestamp: daysSinceStart,
      previsto: Math.round((plannedProgress / totalWeight) * 100),
      realizado: actualProgress !== null ? Math.round((actualProgress / totalWeight) * 100) : null,
    };
  });
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-xl p-2.5 sm:p-3 min-w-[120px] sm:min-w-[140px] z-50">
        <p className="text-xs sm:text-sm font-semibold text-foreground mb-1.5 sm:mb-2 pb-1.5 sm:pb-2 border-b border-border">
          {label}
        </p>
        <div className="space-y-1 sm:space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span 
                  className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {entry.dataKey === "previsto" ? "Previsto" : "Realizado"}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-bold text-foreground">
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

// Custom legend component for mobile
const CustomLegend = () => (
  <div className="flex items-center justify-center gap-4 sm:gap-6 mt-3 sm:mt-4 pt-3 border-t border-border/30">
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-primary" />
      <span className="text-xs sm:text-sm font-medium text-muted-foreground">Previsto</span>
    </div>
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-success" />
      <span className="text-xs sm:text-sm font-medium text-muted-foreground">Realizado</span>
    </div>
  </div>
);

const SCurveChart = ({ activities, reportDate }: SCurveChartProps) => {
  const chartData = generateChartData(activities, reportDate);
  
  // Find current activity in progress (has actualStart but no actualEnd)
  const currentActivity = activities.find(a => a.actualStart && !a.actualEnd);
  
  // Get last data point for comparison
  const lastPoint = chartData[chartData.length - 1];
  const deviation = lastPoint ? lastPoint.realizado - lastPoint.previsto : 0;

  return (
    <div className="mb-3 md:mb-4">
      {/* Header with title and description */}
      <div className="flex flex-col gap-1.5 mb-2 md:mb-3">
        <div className="flex items-start gap-2">
          <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xs md:text-base font-bold text-foreground tracking-tight">
              Cronograma Previsto x Realizado
            </h2>
            <p className="text-[9px] md:text-xs text-muted-foreground hidden md:block">
              Comparação entre o previsto e o realizado ao longo do cronograma
            </p>
          </div>
        </div>
        
        {/* Current activity indicator - Plain text */}
        {currentActivity && (
          <p className="text-[10px] sm:text-xs font-medium text-foreground md:self-start">
            {currentActivity.description}
          </p>
        )}
      </div>

      {/* Chart Container */}
      <div className="bg-secondary/30 rounded-xl p-2.5 sm:p-4 md:p-6 border border-border/50">
        <div className="h-[200px] sm:h-[280px] md:h-[360px] lg:h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
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
                ticks={chartData.map(d => d.timestamp)}
                angle={-45}
                textAnchor="end"
                height={40}
                dy={6}
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
                wrapperStyle={{ zIndex: 50 }}
              />
              <ReferenceLine 
                y={50} 
                stroke="hsl(var(--border))" 
                strokeDasharray="6 6"
                strokeOpacity={0.4}
              />
              <Line
                type="monotone"
                dataKey="previsto"
                name="previsto"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 2.5 }}
                activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="realizado"
                name="realizado"
                stroke="hsl(var(--success))"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.realizado === null) return null;
                  const isMatch = payload.previsto === payload.realizado;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isMatch ? 3.5 : 2.5}
                      fill="hsl(var(--success))"
                      stroke={isMatch ? "hsl(var(--primary))" : "none"}
                      strokeWidth={isMatch ? 2 : 0}
                    />
                  );
                }}
                activeDot={{ r: 4, fill: "hsl(var(--success))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
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