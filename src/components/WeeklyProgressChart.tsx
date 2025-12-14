import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity } from "@/types/report";
import { addWeeks, startOfWeek, endOfWeek, isBefore, isAfter } from "date-fns";

interface WeeklyProgressChartProps {
  activities: Activity[];
  projectStartDate: string;
  currentWeekNumber: number;
}

interface WeekData {
  week: string;
  weekNumber: number;
  progress: number;
  isCurrent: boolean;
}

const generateWeeklyProgressData = (
  activities: Activity[],
  projectStartDate: string,
  currentWeekNumber: number
): WeekData[] => {
  const startDate = new Date(projectStartDate);
  const data: WeekData[] = [];
  
  let weekNumber = 1;
  let weekStart = startOfWeek(startDate, { weekStartsOn: 1 });
  
  while (weekNumber <= currentWeekNumber) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    const completedActivities = activities.filter(activity => {
      if (!activity.actualEnd) return false;
      const actualEndDate = new Date(activity.actualEnd);
      return isBefore(actualEndDate, weekEnd) || actualEndDate.getTime() === weekEnd.getTime();
    });
    
    const progress = Math.round((completedActivities.length / activities.length) * 100);
    
    data.push({
      week: `S${weekNumber}`,
      weekNumber,
      progress,
      isCurrent: weekNumber === currentWeekNumber,
    });
    
    weekStart = addWeeks(weekStart, 1);
    weekNumber++;
  }
  
  return data;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-foreground">Semana {payload[0].payload.weekNumber}</p>
        <p className="text-sm text-primary font-bold">{payload[0].value}% concluído</p>
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
    () => generateWeeklyProgressData(activities, projectStartDate, currentWeekNumber),
    [activities, projectStartDate, currentWeekNumber]
  );

  const currentProgress = data.find(d => d.isCurrent)?.progress || 0;

  return (
    <div className="bg-card/50 rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm md:text-base font-semibold text-foreground">
          Evolução do Progresso
        </h4>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Progresso acumulado</span>
        </div>
      </div>
      
      <div className="h-[200px] md:h-[250px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
            <ReferenceLine
              y={currentProgress}
              stroke="hsl(var(--primary))"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="progress"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#progressGradient)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.isCurrent) {
                  return (
                    <circle
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
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-border">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{currentProgress}%</p>
          <p className="text-xs text-muted-foreground">Progresso atual</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{currentWeekNumber}</p>
          <p className="text-xs text-muted-foreground">Semanas</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-bold text-success">
            {data.length > 1 ? data[data.length - 1].progress - data[data.length - 2].progress : 0}%
          </p>
          <p className="text-xs text-muted-foreground">Avanço semanal</p>
        </div>
      </div>
    </div>
  );
};

export default WeeklyProgressChart;
