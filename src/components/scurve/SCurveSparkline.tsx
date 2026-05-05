/**
 * Mini S-Curve Sparkline
 *
 * A compact, tooltip-free sparkline showing planned vs actual progress curves.
 * Designed for dashboard cards — no axes, no labels, just the visual shape.
 */

import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { generateChartData } from "@/components/scurve/generateChartData";
import type { Activity } from "@/types/report";

interface SCurveSparklineProps {
  activities: Activity[];
  height?: number;
}

export function SCurveSparkline({
  activities,
  height = 48,
}: SCurveSparklineProps) {
  const chartData = useMemo(() => {
    if (!activities.length) return [];
    const { data } = generateChartData(activities);
    // Sample every Nth point to keep sparkline lightweight
    const maxPoints = 30;
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    const sampled = data.filter((_, i) => i % step === 0);
    // Always include the last point
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }
    return sampled;
  }, [activities]);

  if (chartData.length < 2) return null;

  return (
    <div style={{ width: "100%", height }} className="opacity-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="sparkPrevisto" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="hsl(var(--muted-foreground))"
                stopOpacity={0.15}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--muted-foreground))"
                stopOpacity={0.02}
              />
            </linearGradient>
            <linearGradient id="sparkRealizado" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.3}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="previsto"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeDasharray="3 3"
            fill="url(#sparkPrevisto)"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="realizado"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            fill="url(#sparkRealizado)"
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
