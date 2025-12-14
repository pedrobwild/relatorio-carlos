import { WeeklyReportActivitySnapshot } from "@/types/weeklyReport";
import { startOfWeek, addWeeks } from "date-fns";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
  Bar,
  Cell,
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
    
    // Calculate deviation: positive = ahead, negative = behind
    const desvio = realizado - previsto;
    
    data.push({
      week: `S${week}`,
      previsto,
      realizado,
      desvio,
    });
  }
  
  return data;
};

// Custom dot component with dynamic colors
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  
  const color = payload.desvio >= 0 ? "#22c55e" : "#ef4444";
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      stroke="hsl(var(--card))"
      strokeWidth={2}
    />
  );
};

const CustomActiveDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  
  const color = payload.desvio >= 0 ? "#22c55e" : "#ef4444";
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={7}
      fill={color}
      stroke="hsl(var(--card))"
      strokeWidth={2}
    />
  );
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
        <h3 className="text-base sm:text-lg font-semibold text-foreground">Evolução do Desvio</h3>
        <div className="flex items-center gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-foreground/70">Adiantado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-foreground/70">Atrasado</span>
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
              <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="negativeGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
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
              tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}%`}
              domain={['auto', 'auto']}
            />
            
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              formatter={(value: number) => [
                `${value > 0 ? '+' : ''}${value}%`,
                value >= 0 ? "Adiantado" : "Atrasado",
              ]}
            />
            
            {/* Reference line at 0 */}
            <ReferenceLine 
              y={0} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            
            {/* Deviation bars with dynamic colors */}
            <Bar dataKey="desvio" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.desvio >= 0 ? "#22c55e" : "#ef4444"}
                  fillOpacity={0.7}
                />
              ))}
            </Bar>
            
            {/* Deviation line with custom dots */}
            <Line
              type="monotone"
              dataKey="desvio"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={<CustomActiveDot />}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProgressEvolutionChart;
