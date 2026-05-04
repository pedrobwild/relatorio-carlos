import { WeeklyReportActivitySnapshot } from "@/types/weeklyReport";
import { startOfWeek, addWeeks } from "date-fns";
import { parseLocalDate } from "@/lib/activityStatus";
import { plannedProgressAt, actualProgressAt } from "@/lib/linearProgress";
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

// Linear progress (interpolado entre start e end de cada atividade) — assim
// atrasos de início aparecem na curva, mesmo quando o término coincide.
const calculateProgressAtDate = (
  activities: WeeklyReportActivitySnapshot[],
  targetDate: Date,
  useActual: boolean,
): number => {
  if (activities.length === 0) return 0;
  const pct = useActual
    ? actualProgressAt(activities, targetDate)
    : plannedProgressAt(activities, targetDate);
  return Math.round(pct);
};

// Generate weekly progress data based on activities
const generateWeeklyProgressData = (
  activities: WeeklyReportActivitySnapshot[],
  currentWeek: number,
  projectStartDate: string,
) => {
  const data: Array<{
    week: string;
    previsto: number;
    realizado: number;
    desvio: number;
  }> = [];
  const startDate = parseLocalDate(projectStartDate);

  for (let week = 1; week <= currentWeek; week++) {
    // Get the end of each week
    const weekEndDate = addWeeks(
      startOfWeek(startDate, { weekStartsOn: 1 }),
      week,
    );

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
  projectStartDate = "2025-07-01",
}: ProgressEvolutionChartProps) => {
  const data = generateWeeklyProgressData(
    activities,
    currentWeek,
    projectStartDate,
  );

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-primary-dark flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-h2 text-white">Evolução do Desvio</h3>
        <div className="flex items-center gap-3 text-tiny">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-white/70">Adiantado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-white/70">Atrasado</span>
          </div>
        </div>
      </div>
      <div className="p-2.5 sm:p-4">
        <div className="h-[180px] sm:h-[220px] md:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="positiveGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient
                  id="negativeGradient"
                  x1="0"
                  y1="1"
                  x2="0"
                  y2="0"
                >
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
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                dy={6}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                tickFormatter={(value) => `${value > 0 ? "+" : ""}${value}%`}
                domain={["auto", "auto"]}
                width={40}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  fontSize: "12px",
                  padding: "8px 12px",
                }}
                labelStyle={{
                  color: "hsl(var(--foreground))",
                  fontWeight: 600,
                  fontSize: "11px",
                }}
                formatter={(value: number) => [
                  `${value > 0 ? "+" : ""}${value}%`,
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
              <Bar dataKey="desvio" radius={[3, 3, 0, 0]}>
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
                strokeWidth={1.5}
                dot={<CustomDot />}
                activeDot={<CustomActiveDot />}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ProgressEvolutionChart;
