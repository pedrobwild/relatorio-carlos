import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "@/types/report";

interface SCurveChartProps {
  activities: Activity[];
}

// Generate S-Curve data from activities
const generateChartData = (activities: Activity[]) => {
  if (activities.length === 0) {
    return [{ date: "Início", previsto: 0, realizado: 0 }];
  }

  // Collect all unique dates
  const allDates = new Set<string>();
  activities.forEach(a => {
    if (a.plannedStart) allDates.add(a.plannedStart);
    if (a.plannedEnd) allDates.add(a.plannedEnd);
    if (a.actualStart) allDates.add(a.actualStart);
    if (a.actualEnd) allDates.add(a.actualEnd);
  });

  const sortedDates = Array.from(allDates).sort((a, b) => {
    const parseDate = (d: string) => {
      const [day, month] = d.split("/").map(Number);
      const year = month >= 10 ? 2024 : 2025;
      return new Date(year, month - 1, day);
    };
    return parseDate(a).getTime() - parseDate(b).getTime();
  });

  const totalActivities = activities.length;
  
  return sortedDates.map(date => {
    const parseDate = (d: string) => {
      const [day, month] = d.split("/").map(Number);
      const year = month >= 10 ? 2024 : 2025;
      return new Date(year, month - 1, day);
    };
    
    const currentDate = parseDate(date);
    
    // Count planned started activities by this date
    const plannedStarted = activities.filter(a => {
      if (!a.plannedStart) return false;
      return parseDate(a.plannedStart) <= currentDate;
    }).length;
    
    // Count actual started activities by this date
    const actualStarted = activities.filter(a => {
      if (!a.actualStart) return false;
      return parseDate(a.actualStart) <= currentDate;
    }).length;

    return {
      date,
      previsto: Math.round((plannedStarted / totalActivities) * 100),
      realizado: Math.round((actualStarted / totalActivities) * 100),
    };
  });
};

const SCurveChart = ({ activities }: SCurveChartProps) => {
  const chartData = generateChartData(activities);
  return (
    <div className="mb-8">
      <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6">
        Curva S - Atividades Iniciadas
      </h2>

      <div className="h-[250px] md:h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              interval="preserveStartEnd"
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "var(--shadow-md)",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              formatter={(value: number) => [`${value}%`, ""]}
            />
            <Legend
              wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }}
              formatter={(value) =>
                value === "previsto" ? "Prevista" : "Realizada"
              }
            />
            <Line
              type="monotone"
              dataKey="previsto"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", strokeWidth: 1, r: 3 }}
              activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
            />
            <Line
              type="monotone"
              dataKey="realizado"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--success))", strokeWidth: 1, r: 3 }}
              activeDot={{ r: 5, fill: "hsl(var(--success))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-4">
        A Curva S mostra o acúmulo de atividades iniciadas, permitindo visualizar o ritmo de mobilização da obra
      </p>
    </div>
  );
};

export default SCurveChart;
