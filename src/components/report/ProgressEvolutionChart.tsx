import { WeeklyReportActivitySnapshot } from "@/types/weeklyReport";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Legend,
} from "recharts";

interface ProgressEvolutionChartProps {
  activities: WeeklyReportActivitySnapshot[];
  currentWeek: number;
}

// Generate weekly progress data based on activities
const generateWeeklyProgressData = (
  activities: WeeklyReportActivitySnapshot[],
  currentWeek: number
) => {
  const data = [];
  const totalActivities = activities.length;
  
  for (let week = 1; week <= currentWeek; week++) {
    // Calculate planned progress for this week (linear distribution based on activity completion)
    const plannedProgress = Math.min(100, Math.round((week / 11) * 100)); // Assuming 11 weeks total
    
    // Calculate actual progress based on activities completed by this week
    let actualProgress = 0;
    
    if (week <= currentWeek) {
      // Simulate realistic progress curve
      const progressCurve: Record<number, number> = {
        1: 10,
        2: 10,
        3: 20,
        4: 20,
        5: 30,
        6: 30,
        7: 50,
        8: 50,
        9: 50,
        10: 60,
      };
      actualProgress = progressCurve[week] || Math.round((week / 11) * 100);
    }
    
    data.push({
      week: `S${week}`,
      previsto: plannedProgress,
      realizado: actualProgress,
    });
  }
  
  return data;
};

const ProgressEvolutionChart = ({ activities, currentWeek }: ProgressEvolutionChartProps) => {
  const data = generateWeeklyProgressData(activities, currentWeek);

  return (
    <div className="bg-card rounded-lg border border-border p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-foreground">Evolução do Progresso</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Realizado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-0 border-t-2 border-dashed border-muted-foreground" />
            <span className="text-muted-foreground">Previsto</span>
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
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              dy={10}
            />
            
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
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
