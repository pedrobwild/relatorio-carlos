import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ArrowRight, Download, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WeeklyReport, Activity } from "@/types/report";

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
  // Find activities that are in progress during this week
  const inProgressActivities = activities.filter((activity) => {
    const plannedStart = new Date(activity.plannedStart);
    const plannedEnd = new Date(activity.plannedEnd);
    const actualEnd = activity.actualEnd ? new Date(activity.actualEnd) : null;
    
    // Activity is in progress if not yet completed and overlaps with the week
    if (actualEnd && actualEnd <= weekEnd) return false;
    return plannedStart <= weekEnd && plannedEnd >= weekStart;
  });

  if (inProgressActivities.length > 0) {
    return inProgressActivities[0].description;
  }

  // Fallback to last completed activity
  const completedActivities = activities.filter((activity) => {
    if (!activity.actualEnd) return false;
    return new Date(activity.actualEnd) <= weekEnd;
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
    <div className="bg-card rounded-xl border border-border p-4 md:p-5 mb-4 animate-fade-in">
      {/* Back to list button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBackToList}
        className="mb-3 -ml-2 text-muted-foreground hover:text-foreground h-8 text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Ver todos
      </Button>

      {/* Top row: Week badge, date range */}
      <div className="flex flex-wrap items-center gap-2.5 mb-2">
        <span className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap">
          Semana {weeklyReport.weekNumber}
        </span>
        <span className="text-muted-foreground text-sm">
          {dateRange}
        </span>
      </div>

      {/* Current phase */}
      <p className="text-foreground text-sm font-medium mb-3">
        Etapa: Marcenaria
      </p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-muted-foreground">Progresso da obra</span>
          <span className="text-sm font-bold text-primary">{weeklyReport.completionPercentage}%</span>
        </div>
        <Progress value={weeklyReport.completionPercentage} className="h-2" />
      </div>

      {/* Navigation and export buttons - All in one row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousWeek}
            disabled={!hasPrevious}
            className="h-9 px-3 text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextWeek}
            disabled={!hasNext}
            className="h-9 px-3 text-sm"
          >
            Próxima
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {onExportPDF && (
          <Button
            onClick={onExportPDF}
            disabled={isExporting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-3 text-sm"
            size="sm"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {isExporting ? "..." : "PDF"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default WeeklyReportHeader;
