import { useMemo } from "react";
import { format, startOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NonConformity } from "@/hooks/useNonConformities";

interface Props {
  nonConformities: NonConformity[];
}

export function NcTimelineChart({ nonConformities }: Props) {
  const chartData = useMemo(() => {
    if (nonConformities.length === 0) return [];

    const now = new Date();
    const sixMonthsAgo = subMonths(startOfMonth(now), 5);
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });

    return months.map((month) => {
      const key = format(month, "yyyy-MM");
      const label = format(month, "MMM/yy", { locale: ptBR });

      const opened = nonConformities.filter((nc) => {
        const created = nc.created_at.slice(0, 7);
        return created === key;
      }).length;

      const closed = nonConformities.filter((nc) => {
        if (nc.status !== "closed" || !nc.approved_at) return false;
        const approvedMonth = nc.approved_at.slice(0, 7);
        return approvedMonth === key;
      }).length;

      return { label, abertas: opened, fechadas: closed };
    });
  }, [nonConformities]);

  if (chartData.length === 0 || nonConformities.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          NCs abertas vs. fechadas (últimos 6 meses)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-52 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              width={28}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar
              dataKey="abertas"
              fill="hsl(var(--destructive))"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="fechadas"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
