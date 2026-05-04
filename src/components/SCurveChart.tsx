import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Maximize2, Minimize2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { calcWeightedProgress } from "@/lib/progressCalc";
import { SCurveChartProps } from "./scurve/types";
import { generateChartData } from "./scurve/generateChartData";
import { ChartTooltip } from "./scurve/ChartTooltip";
import { ChartLegend } from "./scurve/ChartLegend";
import { ReferenceLabel } from "./scurve/ReferenceLabel";

const SCurveChart = ({
  activities,
  reportDate,
  projectStartDate,
  projectEndDate,
  showFullChart: controlledShowFull,
  onShowFullChartChange,
}: SCurveChartProps) => {
  const { data: chartData, milestones } = generateChartData(
    activities,
    reportDate,
    projectStartDate,
    projectEndDate,
  );

  const currentActivity = activities.find((a) => a.actualStart && !a.actualEnd);

  const todayRealizado = useMemo(
    () =>
      calcWeightedProgress(
        activities.map((a) => ({ weight: a.weight, actualEnd: a.actualEnd })),
      ),
    [activities],
  );

  const [internalShowFull, setInternalShowFull] = useState(false);
  const showFullChart =
    controlledShowFull !== undefined ? controlledShowFull : internalShowFull;

  const handleToggleFullChart = () => {
    const newValue = !showFullChart;
    if (onShowFullChartChange) {
      onShowFullChartChange(newValue);
    } else {
      setInternalShowFull(newValue);
    }
  };

  const windowedData = useMemo(() => {
    if (showFullChart) return chartData;
    const t = milestones.today;
    return chartData.filter(
      (d) => d.timestamp >= t - 30 && d.timestamp <= t + 15,
    );
  }, [chartData, milestones.today, showFullChart]);

  const hasMoreData = useMemo(() => {
    const t = milestones.today;
    const windowedLength = chartData.filter(
      (d) => d.timestamp >= t - 30 && d.timestamp <= t + 15,
    ).length;
    return chartData.length > windowedLength;
  }, [chartData, milestones.today]);

  return (
    <div className="mb-3 md:mb-4">
      {/* Header */}
      <div className="flex flex-col gap-1.5 mb-2 md:mb-3">
        <div className="flex items-start gap-2">
          <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs md:text-base font-bold text-foreground tracking-tight">
                Cronograma Previsto x Realizado
              </h2>
              {windowedData.length > 0 && (
                <span
                  key={`${windowedData[0]?.date}-${windowedData[windowedData.length - 1]?.date}`}
                  className="text-[10px] md:text-xs text-muted-foreground bg-secondary px-1.5 md:px-2 py-0.5 rounded inline-flex items-center gap-1 animate-fade-in"
                >
                  <span>{windowedData[0]?.date}</span>
                  <span>→</span>
                  <span>{windowedData[windowedData.length - 1]?.date}</span>
                </span>
              )}
            </div>
            <p className="text-[9px] md:text-xs text-muted-foreground hidden md:block">
              {showFullChart
                ? "Visão completa do projeto"
                : "Janela de 45 dias (-30 a +15 dias do hoje)"}
            </p>
          </div>
          {hasMoreData && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] md:text-xs gap-1 px-2"
              onClick={handleToggleFullChart}
            >
              {showFullChart ? (
                <>
                  <Minimize2 className="h-3 w-3" />
                  <span className="hidden sm:inline">30 dias</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Ver tudo</span>
                </>
              )}
            </Button>
          )}
        </div>
        {currentActivity && (
          <p className="text-[10px] sm:text-xs font-medium text-foreground md:self-start">
            {currentActivity.description}
          </p>
        )}
      </div>

      {/* Chart */}
      <div
        key={showFullChart ? "full" : "windowed"}
        className="bg-secondary/30 rounded-xl p-2.5 sm:p-4 md:p-6 border border-border/50 animate-fade-in"
      >
        <div className="h-[200px] sm:h-[280px] md:h-[360px] lg:h-[400px] w-full transition-all duration-300 ease-out">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={windowedData}
              margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="linear"
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                tickFormatter={(v) =>
                  chartData.find((d) => d.timestamp === v)?.date || ""
                }
                ticks={windowedData.map((d) => d.timestamp)}
                angle={-45}
                textAnchor="end"
                height={40}
                dy={6}
              />
              <ReferenceLine
                x={milestones.start}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={<ReferenceLabel label="Início" />}
              />
              <ReferenceLine
                x={milestones.today}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                strokeOpacity={0.8}
                label={
                  <ReferenceLabel
                    label={`${todayRealizado}% Execução`}
                    highlight
                  />
                }
              />
              <ReferenceLine
                x={milestones.end}
                stroke="hsl(var(--success))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={<ReferenceLabel label="Entrega" />}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                width={38}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{
                  stroke: "hsl(var(--primary))",
                  strokeOpacity: 0.2,
                  strokeWidth: 1,
                }}
                wrapperStyle={{
                  zIndex: 50,
                  transition:
                    "transform 150ms ease-out, opacity 150ms ease-out",
                }}
                animationDuration={150}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="previsto"
                name="previsto"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeOpacity={0.5}
                strokeDasharray="6 4"
                dot={{
                  fill: "hsl(var(--primary))",
                  strokeWidth: 0,
                  r: 2,
                  opacity: 0.6,
                }}
                activeDot={(props: any) => {
                  const { cx, cy } = props;
                  return (
                    <g>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={10}
                        fill="hsl(var(--primary))"
                        opacity={0.15}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      />
                    </g>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="realizado"
                name="realizado"
                stroke="#22c55e"
                strokeWidth={3.5}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy, payload } = props as {
                    cx: number;
                    cy: number;
                    payload: { realizado: number | null };
                  };
                  if (payload.realizado === null) return <></>;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#22c55e"
                      stroke="white"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={(props: any) => {
                  const { cx, cy } = props;
                  return (
                    <g>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={14}
                        fill="#22c55e"
                        opacity={0.2}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill="#22c55e"
                        stroke="white"
                        strokeWidth={2}
                        className="drop-shadow-lg"
                      />
                    </g>
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ChartLegend />
      </div>
    </div>
  );
};

export default SCurveChart;
