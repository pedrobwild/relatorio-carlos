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

const getCurrentPhase = (activities: Activity[], weekStart: Date, weekEnd: Date): string => {
  const inProgressActivities = activities.filter((activity) => {
    const plannedStart = parseLocalDate(activity.plannedStart);
    const plannedEnd = parseLocalDate(activity.plannedEnd);
    const actualEnd = activity.actualEnd ? parseLocalDate(activity.actualEnd) : null;
    
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
  const currentPhase = getCurrentPhase(activities, weeklyReport.startDate, weeklyReport.endDate);

  return (
    <div className="max-w-[840px] mx-auto bg-card rounded-xl border border-border p-4 md:p-5 mb-6 animate-fade-in">
      {/* Top row: Back + Navigation + PDF */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToList}
          className="text-muted-foreground hover:text-foreground h-8 text-sm -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Ver todos
        </Button>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousWeek}
            disabled={!hasPrevious}
            className="h-8 px-2.5 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextWeek}
            disabled={!hasNext}
            className="h-8 px-2.5 text-xs"
          >
            Próxima
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          {onExportPDF && (
            <Button
              onClick={onExportPDF}
              disabled={isExporting}
              size="sm"
              className="h-8 px-3 text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {isExporting ? "..." : "PDF"}
            </Button>
          )}
        </div>
      </div>

      {/* Main info row */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
        <div className="flex items-baseline gap-2.5">
          <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
            Semana {weeklyReport.weekNumber}
          </span>
          <span className="text-xs text-muted-foreground">
            {dateRange}
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums">{weeklyReport.completionPercentage}%</span>
      </div>

      {/* Progress bar */}
      <Progress value={weeklyReport.completionPercentage} className="h-1.5 mb-2" />

      {/* Current phase */}
      <p className="text-xs text-muted-foreground line-clamp-1">
        Etapa: <span className="font-medium text-foreground/80">{currentPhase}</span>
      </p>
    </div>
  );
};

export default WeeklyReportHeader;
