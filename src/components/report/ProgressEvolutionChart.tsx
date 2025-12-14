import { WeeklyReportActivitySnapshot } from "@/types/weeklyReport";
import { startOfWeek, addWeeks } from "date-fns";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";

interface ProgressEvolutionChartProps {
  activities: WeeklyReportActivitySnapshot[];
  currentWeek: number;
  projectStartDate?: string;
}

// Calculate progress at a given date based on completed activities only
const calculateProgressAtDate = (
  activities: WeeklyReportActivitySnapshot[],
  targetDate: Date,
  useActual: boolean
): number => {
  const totalActivities = activities.length;
  if (totalActivities === 0) return 0;

  let completedCount = 0;

  activities.forEach((activity) => {
    if (useActual) {
      // Calculate actual progress - count only completed activities
      const actualEnd = activity.actualEnd ? new Date(activity.actualEnd) : null;
      if (actualEnd && actualEnd <= targetDate) {
        completedCount++;
      }
    } else {
      // Calculate planned progress - count activities that should be done by this date
      const plannedEnd = new Date(activity.plannedEnd);
      if (plannedEnd <= targetDate) {
        completedCount++;
      }
    }
  });

  return Math.round((completedCount / totalActivities) * 100);
};

// Generate weekly progress data based on activities
const generateWeeklyProgressData = (
  activities: WeeklyReportActivitySnapshot[],
  currentWeek: number,
  projectStartDate: string
) => {
  const data = [];
  const startDate = new Date(projectStartDate);
  
  for (let week = 1; week <= currentWeek; week++) {
    // Get the end of each week
    const weekEndDate = addWeeks(startOfWeek(startDate, { weekStartsOn: 1 }), week);
    
    // Calculate planned progress at this week
    const previsto = calculateProgressAtDate(activities, weekEndDate, false);
    
    // Calculate actual progress at this week
    const realizado = calculateProgressAtDate(activities, weekEndDate, true);
    
    data.push({
      week: `S${week}`,
      previsto,
      realizado,
    });
  }
  
  return data;
};

const ProgressEvolutionChart = ({ 
  activities, 
  currentWeek,
  projectStartDate = "2025-07-01" 
}: ProgressEvolutionChartProps) => {
  const data = generateWeeklyProgressData(activities, currentWeek, projectStartDate);

  return (
    <div className="bg-card rounded-lg border border-border p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-foreground">Progresso Previsto x Realizado</h3>
        <div className="flex items-center gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-foreground/70">Realizado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-0 border-t-2 border-dashed border-foreground/50" />
            <span className="text-foreground/70">Previsto</span>
          </div>
        </div>
      </div>
      
      <div className="h-[280px] md:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
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
              tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 }}
              dy={10}
            />
            
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 }}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
            />
            
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              formatter={(value: number, name: string) => [
                `${value}%`,
                name === "realizado" ? "Realizado" : "Previsto",
              ]}
            />
            
            {/* Previsto line (dashed) */}
            <Line
              type="monotone"
              dataKey="previsto"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
            />
            
            {/* Realizado area with gradient fill */}
            <Area
              type="monotone"
              dataKey="realizado"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#progressGradient)"
              dot={{
                fill: "hsl(var(--primary))",
                stroke: "hsl(var(--card))",
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={{
                fill: "hsl(var(--primary))",
                stroke: "hsl(var(--card))",
                strokeWidth: 2,
                r: 6,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProgressEvolutionChart;
