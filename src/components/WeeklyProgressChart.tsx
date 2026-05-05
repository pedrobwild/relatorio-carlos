import { useMemo } from "react";
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from "recharts";
import { Activity } from "@/types/report";
import { addWeeks, startOfWeek, endOfWeek, isBefore } from "date-fns";
import { parseLocalDate } from "@/lib/activityStatus";

interface WeeklyProgressChartProps {
  activities: Activity[];
  projectStartDate: string;
  currentWeekNumber: number;
}

interface WeekData {
  week: string;
  weekNumber: number;
  realizado: number;
  previsto: number;
  isCurrent: boolean;
}

const generateWeeklyProgressData = (
  activities: Activity[],
  projectStartDate: string,
  currentWeekNumber: number,
): WeekData[] => {
  const startDate = parseLocalDate(projectStartDate);
  const data: WeekData[] = [];

  // Check if any activity has weight defined
  const hasWeights = activities.some((a) => a.weight !== undefined);

  // Calculate total weight (should be 100, but normalize if not)
  const totalWeight = hasWeights
    ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
    : activities.length;

  // BUG FIX: Guard against division by zero
  if (totalWeight === 0) return data;

  let weekNumber = 1;
  let weekStart = startOfWeek(startDate, { weekStartsOn: 1 });

  while (weekNumber <= currentWeekNumber) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    // Calculate actual progress (realizado) using weights
    const realizadoSum = activities.reduce((sum, activity) => {
      if (!activity.actualEnd) return sum;
      const actualEndDate = parseLocalDate(activity.actualEnd);
      if (
        isBefore(actualEndDate, weekEnd) ||
        actualEndDate.getTime() === weekEnd.getTime()
      ) {
        return sum + (hasWeights ? activity.weight || 0 : 1);
      }
      return sum;
    }, 0);

    const realizado = Math.round((realizadoSum / totalWeight) * 100);

    // Calculate planned progress (previsto) using weights
    const previstoSum = activities.reduce((sum, activity) => {
      const plannedEndDate = parseLocalDate(activity.plannedEnd);
      if (
        isBefore(plannedEndDate, weekEnd) ||
        plannedEndDate.getTime() === weekEnd.getTime()
      ) {
        return sum + (hasWeights ? activity.weight || 0 : 1);
      }
      return sum;
    }, 0);

    const previsto = Math.round((previstoSum / totalWeight) * 100);

    data.push({
      week: `S${weekNumber}`,
      weekNumber,
      realizado,
      previsto,
      isCurrent: weekNumber === currentWeekNumber,
    });

    weekStart = addWeeks(weekStart, 1);
    weekNumber++;
  }

  return data;
};

// BUG FIX: Tipagem adequada para tooltip do Recharts
interface TooltipPayloadItem {
  payload: WeekData;
  value: number;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const deviation = data.realizado - data.previsto;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-2">
          Semana {data.weekNumber}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Realizado:</span>
            <span className="text-sm font-bold text-primary">
              {data.realizado}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="text-xs text-muted-foreground">Previsto:</span>
            <span className="text-sm font-bold text-muted-foreground">
              {data.previsto}%
            </span>
          </div>
          <div className="pt-1 border-t border-border mt-1">
            <span
              className={`text-xs font-semibold ${deviation >= 0 ? "text-success" : "text-destructive"}`}
            >
              {deviation >= 0 ? "+" : ""}
              {deviation}% desvio
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const WeeklyProgressChart = ({
  activities,
  projectStartDate,
  currentWeekNumber,
}: WeeklyProgressChartProps) => {
  const data = useMemo(
    () =>
      generateWeeklyProgressData(
        activities,
        projectStartDate,
        currentWeekNumber,
      ),
    [activities, projectStartDate, currentWeekNumber],
  );

  const currentData = data.find((d) => d.isCurrent);
  const currentProgress = currentData?.realizado || 0;
  const currentPlanned = currentData?.previsto || 0;
  const deviation = currentProgress - currentPlanned;

  return (
    <div className="bg-card/50 rounded-lg p-4 border border-border">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
        <h4 className="text-sm md:text-base font-semibold text-foreground">
          Progresso Previsto x Realizado
        </h4>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Realizado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-muted-foreground" />
            <span className="text-xs text-muted-foreground">Previsto</span>
          </div>
        </div>
      </div>

      <div className="h-[200px] md:h-[250px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Planned progress line (dashed) */}
            <Line
              type="monotone"
              dataKey="previsto"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{
                r: 4,
                fill: "hsl(var(--muted-foreground))",
                stroke: "hsl(var(--background))",
                strokeWidth: 2,
              }}
            />

            {/* Actual progress area */}
            <Area
              type="monotone"
              dataKey="realizado"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#progressGradient)"
              dot={(props) => {
                const { cx, cy, payload } = props as {
                  cx: number;
                  cy: number;
                  payload: WeekData;
                };
                if (payload.isCurrent) {
                  return (
                    <circle
                      key={`dot-${payload.weekNumber}`}
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  );
                }
                return (
                  <circle
                    key={`dot-${payload.weekNumber}`}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="hsl(var(--primary))"
                  />
                );
              }}
              activeDot={{
                r: 6,
                fill: "hsl(var(--primary))",
                stroke: "hsl(var(--background))",
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 md:gap-6 mt-4 pt-3 border-t border-border">
        <div className="text-center">
          <p className="text-xl md:text-2xl font-bold text-primary">
            {currentProgress}%
          </p>
          <p className="text-xs text-muted-foreground">Realizado</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-xl md:text-2xl font-bold text-muted-foreground">
            {currentPlanned}%
          </p>
          <p className="text-xs text-muted-foreground">Previsto</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p
            className={`text-xl md:text-2xl font-bold ${deviation >= 0 ? "text-success" : "text-destructive"}`}
          >
            {deviation >= 0 ? "+" : ""}
            {deviation}%
          </p>
          <p className="text-xs text-muted-foreground">Desvio</p>
        </div>
        <div className="h-8 w-px bg-border hidden md:block" />
        <div className="text-center hidden md:block">
          <p className="text-xl md:text-2xl font-bold text-foreground">
            {currentWeekNumber}
          </p>
          <p className="text-xs text-muted-foreground">Semanas</p>
        </div>
      </div>
    </div>
  );
};

export default WeeklyProgressChart;
