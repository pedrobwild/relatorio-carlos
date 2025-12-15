import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

// Generate S-Curve data from activities
const generateChartData = (activities: Activity[], reportDate?: string) => {
  if (activities.length === 0) {
    return [{ date: "Início", previsto: 0, realizado: null }];
  }

  // Get base year from first activity
  const baseYear = activities[0].plannedStart 
    ? new Date(activities[0].plannedStart + "T00:00:00").getFullYear()
    : new Date().getFullYear();

  // Parse report date (defaults to today if not provided)
  const reportDateParsed = reportDate 
    ? parseDate(reportDate) 
    : new Date();

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

  const totalActivities = activities.length;
  
  return sortedDates.map(date => {
    const currentDate = parseDate(date);
    if (!currentDate) return { date: formatDisplayDate(date, baseYear), previsto: 0, realizado: null };
    
    // Count planned COMPLETED activities by this date (based on plannedEnd)
    const plannedCompleted = activities.filter(a => {
      const plannedEnd = parseDate(a.plannedEnd);
      return plannedEnd && plannedEnd <= currentDate;
    }).length;
    
    // Only show "realizado" for dates up to report date AND only if there are actual dates
    const isFutureDate = reportDateParsed && currentDate > reportDateParsed;
    
    // Check if any activity has actual data for this date
    const hasAnyActualData = activities.some(a => a.actualEnd);
    
    // Count actual COMPLETED activities by this date (based on actualEnd)
    let actualCompleted: number | null = null;
    if (!isFutureDate && hasAnyActualData) {
      const actualCount = activities.filter(a => {
        const actualEnd = parseDate(a.actualEnd);
        return actualEnd && actualEnd <= currentDate;
      }).length;
      // Only show realizado if at least one activity has completed by this date
      // or if this date is from actual dates set
      if (actualCount > 0 || actualDates.has(date)) {
        actualCompleted = actualCount;
      }
    }

    return {
      date: formatDisplayDate(date, baseYear),
      previsto: Math.round((plannedCompleted / totalActivities) * 100),
      realizado: actualCompleted !== null ? Math.round((actualCompleted / totalActivities) * 100) : null,
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
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[140px]">
        <p className="text-sm font-semibold text-foreground mb-2 pb-2 border-b border-border">
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span 
                  className="w-2.5 h-2.5 rounded-full" 
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

const SCurveChart = ({ activities, reportDate }: SCurveChartProps) => {
  const chartData = generateChartData(activities, reportDate);
  
  // Find current activity in progress (has actualStart but no actualEnd)
  const currentActivity = activities.find(a => a.actualStart && !a.actualEnd);
  
  // Get last data point for comparison
  const lastPoint = chartData[chartData.length - 1];
  const deviation = lastPoint ? lastPoint.realizado - lastPoint.previsto : 0;

  return (
    <div className="mb-6 md:mb-10">
      {/* Header with title and description */}
      <div className="flex flex-col gap-3 mb-4 md:mb-6">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-xl font-bold text-foreground tracking-tight">
              Cronograma Previsto x Realizado
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">
              Comparação entre o previsto e o realizado ao longo do cronograma
            </p>
          </div>
        </div>
        
        {/* Current activity indicator - Plain text */}
        {currentActivity && (
          <p className="text-xs sm:text-sm font-medium text-foreground md:self-start">
            {currentActivity.description}
          </p>
        )}
      </div>

      {/* Chart Container */}
      <div className="bg-secondary/30 rounded-xl p-3 sm:p-4 md:p-6 border border-border/50">
        <div className="h-[220px] sm:h-[280px] md:h-[360px] lg:h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 8, left: -5, bottom: 0 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                interval="preserveStartEnd"
                angle={-45}
                textAnchor="end"
                height={45}
                dy={8}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                width={32}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "8px" }}
                formatter={(value) => (
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                    {value === "previsto" ? "Previsto" : "Realizado"}
                  </span>
                )}
                iconType="circle"
                iconSize={6}
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
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
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
                      r={isMatch ? 4 : 3}
                      fill="hsl(var(--success))"
                      stroke={isMatch ? "hsl(var(--primary))" : "none"}
                      strokeWidth={isMatch ? 2 : 0}
                    />
                  );
                }}
                activeDot={{ r: 5, fill: "hsl(var(--success))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default SCurveChart;