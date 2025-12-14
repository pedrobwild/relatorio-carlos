import { WeeklyReportData } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Calendar, Flag, User } from "lucide-react";

interface ReportKPICardsProps {
  data: WeeklyReportData;
}

const ReportKPICards = ({ data }: ReportKPICardsProps) => {
  const deviation = data.kpis.physicalActual - data.kpis.physicalPlanned;
  const deviationText = deviation > 0 ? `+${deviation}pp` : deviation < 0 ? `${deviation}pp` : "No prazo";
  const DeviationIcon = deviation > 0 ? TrendingUp : deviation < 0 ? TrendingDown : Minus;
  const deviationColor = deviation > 0 ? "text-success" : deviation < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          <span>
            Semana {data.weekNumber} • {format(new Date(data.periodStart), "dd/MM", { locale: ptBR })} - {format(new Date(data.periodEnd), "dd/MM", { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="w-4 h-4" />
          <span>{data.preparedBy}</span>
        </div>
        <span className="text-muted-foreground/50">
          Emitido em {format(new Date(data.issuedAt), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Physical Progress */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Previsto</span>
            <span className="text-2xl font-bold text-foreground">{data.kpis.physicalPlanned}%</span>
          </div>
          <Progress value={data.kpis.physicalPlanned} className="h-1.5" />
        </div>

        <div className="bg-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Realizado</span>
            <span className="text-2xl font-bold text-primary">{data.kpis.physicalActual}%</span>
          </div>
          <Progress value={data.kpis.physicalActual} className="h-1.5" />
        </div>

        {/* Schedule Variance */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Cronograma</span>
          <p className="text-2xl font-bold text-foreground">
            {data.kpis.scheduleVarianceDays === 0 ? "Em dia" : 
             data.kpis.scheduleVarianceDays > 0 ? `+${data.kpis.scheduleVarianceDays}d` : 
             `${data.kpis.scheduleVarianceDays}d`}
          </p>
        </div>
      </div>

      {/* Next Milestones */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Flag className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Próximos Marcos</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.nextMilestones.slice(0, 4).map((milestone, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 text-sm"
            >
              <span className="font-medium text-foreground">{milestone.description}</span>
              <span className="text-muted-foreground text-xs">
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
