import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import type { InsightVisualizationHint } from "@/lib/assistant";

interface Props {
  hint: InsightVisualizationHint;
  rows: Record<string, unknown>[];
  height?: number;
}

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--accent-foreground))",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#6366f1",
  "#06b6d4",
  "#84cc16",
];

const toNumber = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function InsightVisualization({ hint, rows, height = 220 }: Props) {
  if (!rows || rows.length === 0 || !hint || hint.type === "table" || hint.type === "kpi") return null;

  const x = hint.x;
  const y = hint.y;
  if (!x || !y) return null;

  const data = rows.slice(0, 50).map((r) => ({
    [x]: r[x] ?? "",
    [y]: toNumber(r[y]),
  }));

  switch (hint.type) {
    case "line":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey={x} fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey={y} stroke={PALETTE[0]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    case "area":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey={x} fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Area type="monotone" dataKey={y} stroke={PALETTE[0]} fill={PALETTE[0]} fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      );
    case "bar":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey={x} fontSize={11} interval={0} angle={-12} textAnchor="end" height={50} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Bar dataKey={y} fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    case "pie":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Pie data={data} dataKey={y} nameKey={x} cx="50%" cy="50%" outerRadius={70} label={false}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    default:
      return null;
  }
}
