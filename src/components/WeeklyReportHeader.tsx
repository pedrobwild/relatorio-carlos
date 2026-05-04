import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ArrowRight, Download, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WeeklyReport, Activity } from "@/types/report";
import { parseLocalDate } from "@/lib/activityStatus";

interface WeeklyReportHeaderProps {
  weeklyReport: WeeklyReport;
  activities: Activity[];
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onBackToList: () => void;
  onExportPDF?: () => void;
  isExporting?: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
}

const getCurrentPhase = (
  activities: Activity[],
  weekStart: Date,
  weekEnd: Date,
): string => {
  const inProgressActivities = activities.filter((activity) => {
    const plannedStart = parseLocalDate(activity.plannedStart);
    const plannedEnd = parseLocalDate(activity.plannedEnd);
    const actualEnd = activity.actualEnd
      ? parseLocalDate(activity.actualEnd)
      : null;

    if (actualEnd && actualEnd <= weekEnd) return false;
    return plannedStart <= weekEnd && plannedEnd >= weekStart;
  });

  if (inProgressActivities.length > 0) {
    return inProgressActivities[0].description;
  }

  const completedActivities = activities.filter((activity) => {
    if (!activity.actualEnd) return false;
    return parseLocalDate(activity.actualEnd) <= weekEnd;
  });

  if (completedActivities.length > 0) {
    return completedActivities[completedActivities.length - 1].description;
  }

  return "Mobilização";
};

const WeeklyReportHeader = ({
  weeklyReport,
  activities,
  onPreviousWeek,
  onNextWeek,
  onBackToList,
  onExportPDF,
  isExporting,
  hasPrevious,
  hasNext,
}: WeeklyReportHeaderProps) => {
  const dateRange = `${format(weeklyReport.startDate, "dd/MM/yyyy", { locale: ptBR })} - ${format(weeklyReport.endDate, "dd/MM/yyyy", { locale: ptBR })}`;
  const currentPhase = getCurrentPhase(
    activities,
    weeklyReport.startDate,
    weeklyReport.endDate,
  );

  return (
    <div className="max-w-[840px] mx-auto bg-card rounded-xl border border-border px-3 py-2.5 md:p-5 mb-3 md:mb-6 animate-fade-in">
      {/* Top row: Back + Navigation + PDF */}
      <div className="flex items-center justify-between gap-2 mb-2 md:mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToList}
          className="text-muted-foreground hover:text-foreground h-9 md:min-h-[44px] md:h-auto text-sm -ml-1.5 px-2"
          aria-label="Voltar para lista de relatórios"
        >
          <ArrowLeft className="w-4 h-4 md:mr-1.5" />
          <span className="hidden md:inline">Ver todos</span>
        </Button>

        <div className="flex items-center gap-1 md:gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={onPreviousWeek}
            disabled={!hasPrevious}
            className="h-9 w-9 md:min-h-[44px] md:h-auto md:w-auto md:px-3 text-xs"
            aria-label="Semana anterior"
          >
            <ArrowLeft className="w-3.5 h-3.5 md:mr-1" />
            <span className="hidden md:inline">Anterior</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextWeek}
            disabled={!hasNext}
            className="h-9 w-9 md:min-h-[44px] md:h-auto md:w-auto md:px-3 text-xs"
            aria-label="Próxima semana"
          >
            <span className="hidden md:inline">Próxima</span>
            <ArrowRight className="w-3.5 h-3.5 md:ml-1" />
          </Button>
          {onExportPDF && (
            <Button
              onClick={onExportPDF}
              disabled={isExporting}
              size="sm"
              className="h-9 md:min-h-[44px] md:h-auto px-2.5 md:px-3 text-xs"
              aria-label="Exportar relatório em PDF"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {isExporting ? "..." : "PDF"}
            </Button>
          )}
        </div>
      </div>

      {/* Main info row */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap">
            Semana {weeklyReport.weekNumber}
          </span>
          <span className="text-xs text-muted-foreground">{dateRange}</span>
        </div>
        <span className="text-lg md:text-2xl font-bold tabular-nums">
          {weeklyReport.completionPercentage}%
        </span>
      </div>

      {/* Progress bar */}
      <Progress
        value={weeklyReport.completionPercentage}
        className="h-1 md:h-1.5 mt-1.5 mb-1.5"
      />

      {/* Current phase */}
      <p className="text-xs text-muted-foreground line-clamp-1">
        Etapa:{" "}
        <span className="font-medium text-foreground/80">{currentPhase}</span>
      </p>
    </div>
  );
};

export default WeeklyReportHeader;
