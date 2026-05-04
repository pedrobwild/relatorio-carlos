import { WeeklyReportData } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Flag,
  User,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportKPICardsProps {
  data: WeeklyReportData;
}

function getStatusColor(
  value: number,
  thresholds: { good: number; warning: number },
) {
  if (value >= thresholds.good)
    return {
      text: "text-[hsl(var(--success))]",
      bg: "bg-[hsl(var(--success))]/10",
      border: "border-[hsl(var(--success))]/20",
    };
  if (value >= thresholds.warning)
    return {
      text: "text-[hsl(var(--warning))]",
      bg: "bg-[hsl(var(--warning))]/10",
      border: "border-[hsl(var(--warning))]/20",
    };
  return {
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  };
}

function getScheduleColor(days: number) {
  if (days >= 0)
    return {
      text: "text-[hsl(var(--success))]",
      bg: "bg-[hsl(var(--success))]/10",
      border: "border-[hsl(var(--success))]/20",
    };
  if (days >= -3)
    return {
      text: "text-[hsl(var(--warning))]",
      bg: "bg-[hsl(var(--warning))]/10",
      border: "border-[hsl(var(--warning))]/20",
    };
  return {
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  };
}

const ReportKPICards = ({ data }: ReportKPICardsProps) => {
  const deviation = data.kpis.physicalActual - data.kpis.physicalPlanned;
  const DeviationIcon =
    deviation > 0 ? TrendingUp : deviation < 0 ? TrendingDown : Minus;

  const actualColors = getStatusColor(data.kpis.physicalActual, {
    good: 70,
    warning: 40,
  });
  const deviationColors =
    deviation >= 0
      ? {
          text: "text-[hsl(var(--success))]",
          bg: "bg-[hsl(var(--success))]/10",
          border: "border-[hsl(var(--success))]/20",
        }
      : deviation >= -5
        ? {
            text: "text-[hsl(var(--warning))]",
            bg: "bg-[hsl(var(--warning))]/10",
            border: "border-[hsl(var(--warning))]/20",
          }
        : {
            text: "text-destructive",
            bg: "bg-destructive/10",
            border: "border-destructive/20",
          };
  const scheduleColors = getScheduleColor(data.kpis.scheduleVarianceDays);

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 text-caption">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            Semana {data.weekNumber} •{" "}
            {format(new Date(data.periodStart), "dd/MM", { locale: ptBR })} -{" "}
            {format(new Date(data.periodEnd), "dd/MM", { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="w-4 h-4 shrink-0" />
          <span>{data.preparedBy}</span>
        </div>
        <span className="text-tiny">
          Emitido em{" "}
          {format(new Date(data.issuedAt), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      </div>

      {/* KPI Cards - Semaphore Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Planned */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-tiny font-medium uppercase tracking-wide text-muted-foreground">
              Previsto
            </span>
          </div>
          <span className="text-h1 tabular-nums">
            {data.kpis.physicalPlanned}%
          </span>
          <Progress value={data.kpis.physicalPlanned} className="h-2 mt-2" />
        </div>

        {/* Actual - Color coded */}
        <div
          className={cn(
            "rounded-lg p-4 border",
            actualColors.bg,
            actualColors.border,
          )}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <DeviationIcon
              className={cn("w-3.5 h-3.5", deviationColors.text)}
            />
            <span className="text-tiny font-medium uppercase tracking-wide text-muted-foreground">
              Realizado
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-h1 tabular-nums", actualColors.text)}>
              {data.kpis.physicalActual}%
            </span>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                deviationColors.text,
              )}
            >
              {deviation > 0
                ? `+${deviation}pp`
                : deviation < 0
                  ? `${deviation}pp`
                  : "No prazo"}
            </span>
          </div>
          <Progress value={data.kpis.physicalActual} className="h-2 mt-2" />
        </div>

        {/* Schedule Variance - Color coded */}
        <div
          className={cn(
            "rounded-lg p-4 border",
            scheduleColors.bg,
            scheduleColors.border,
          )}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className={cn("w-3.5 h-3.5", scheduleColors.text)} />
            <span className="text-tiny font-medium uppercase tracking-wide text-muted-foreground">
              Cronograma
            </span>
          </div>
          <p className={cn("text-h1 tabular-nums", scheduleColors.text)}>
            {data.kpis.scheduleVarianceDays === 0
              ? "Em dia"
              : data.kpis.scheduleVarianceDays > 0
                ? `+${data.kpis.scheduleVarianceDays}d`
                : `${data.kpis.scheduleVarianceDays}d`}
          </p>
          <p className="text-tiny text-muted-foreground mt-1">
            {data.kpis.scheduleVarianceDays === 0
              ? "Dentro do cronograma"
              : data.kpis.scheduleVarianceDays > 0
                ? "Adiantado"
                : "Atrasado"}
          </p>
        </div>
      </div>

      {/* Next Milestones */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Flag className="w-4 h-4 text-muted-foreground" />
          <span className="text-h3">Próximos Marcos</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          {data.nextMilestones.slice(0, 4).map((milestone, index) => (
            <div
              key={index}
              className="flex items-center justify-between sm:justify-start gap-2 bg-secondary rounded-lg px-3 py-2.5"
            >
              <span className="text-body font-medium">
                {milestone.description}
              </span>
              <span className="text-tiny font-medium">
                {format(new Date(milestone.dueDate), "dd/MM", { locale: ptBR })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportKPICards;
