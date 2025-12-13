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

const chartData = [
  { date: "26/10", previsto: 0, realizado: 0 },
  { date: "01/11", previsto: 0, realizado: 0 },
  { date: "07/11", previsto: 0, realizado: 0 },
  { date: "10/11", previsto: 0, realizado: 0 },
  { date: "13/11", previsto: 6.25, realizado: 0 },
  { date: "16/11", previsto: 12.5, realizado: 0 },
  { date: "19/11", previsto: 18.75, realizado: 0 },
  { date: "25/11", previsto: 25, realizado: 0 },
  { date: "01/12", previsto: 31.25, realizado: 0 },
  { date: "07/12", previsto: 37.5, realizado: 0 },
  { date: "13/12", previsto: 56.25, realizado: 18.75 },
  { date: "19/12", previsto: 62.5, realizado: 37.5 },
  { date: "25/12", previsto: 62.5, realizado: 37.5 },
  { date: "31/12", previsto: 62.5, realizado: 37.5 },
  { date: "06/01", previsto: 93.75, realizado: 87.5 },
  { date: "12/01", previsto: 93.75, realizado: 93.75 },
  { date: "18/01", previsto: 100, realizado: 100 },
];

const SCurveChart = () => {
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
