import { format, addWeeks, startOfWeek, endOfWeek, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, WeeklyReport } from "@/types/report";

interface WeeklyReportsHistoryProps {
  projectStartDate: string;
  reportDate: string;
  activities: Activity[];
  onReportClick?: (report: WeeklyReport, index: number) => void;
}

const calculateActivityProgress = (
  activity: Activity,
  weekEndDate: Date
): number => {
  const plannedStart = new Date(activity.plannedStart);
  const plannedEnd = new Date(activity.plannedEnd);
  
  // If activity has actual end date and it's before or on weekEnd, it's 100% complete
  if (activity.actualEnd) {
    const actualEndDate = new Date(activity.actualEnd);
    if (isBefore(actualEndDate, weekEndDate) || actualEndDate.getTime() === weekEndDate.getTime()) {
      return 1;
    }
  }
  
  // If week is before planned start, no progress
  if (isBefore(weekEndDate, plannedStart)) {
    return 0;
  }
  
  // Calculate intermediate progress based on time elapsed within planned duration
  const totalPlannedDays = Math.max(1, (plannedEnd.getTime() - plannedStart.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, (weekEndDate.getTime() - plannedStart.getTime()) / (1000 * 60 * 60 * 24));
  
  // Cap at 95% for incomplete activities (reserve 100% for actually completed)
  return Math.min(0.95, elapsedDays / totalPlannedDays);
};

export const generateWeeklyReports = (
  projectStartDate: string,
  reportDate: string,
  activities: Activity[]
): WeeklyReport[] => {
  const startDate = new Date(projectStartDate);
  const currentReportDate = new Date(reportDate);
  const reports: WeeklyReport[] = [];
  
  let weekNumber = 1;
  let weekStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday start
  let previousPercentage = 0;
  
  while (isBefore(weekStart, currentReportDate) || weekStart.getTime() === currentReportDate.getTime()) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // Sunday end
    const weekEndDate = isAfter(weekEnd, currentReportDate) ? currentReportDate : weekEnd;
    
    // Calculate total progress including intermediate progress for in-progress activities
    const totalProgress = activities.reduce((sum, activity) => {
      return sum + calculateActivityProgress(activity, weekEndDate);
    }, 0);
    
    let completionPercentage = Math.round((totalProgress / activities.length) * 100);
    
    // Ensure percentage never decreases from previous week
    completionPercentage = Math.max(completionPercentage, previousPercentage);
    previousPercentage = completionPercentage;
    
    reports.push({
      weekNumber,
      startDate: weekStart,
      endDate: weekEnd,
      completionPercentage,
    });
    
    weekStart = addWeeks(weekStart, 1);
    weekNumber++;
    
    // Safety limit to prevent infinite loops
    if (weekNumber > 52) break;
  }
  
  // Return in reverse order (most recent first)
  return reports.reverse();
};

const formatDateRange = (startDate: Date, endDate: Date): string => {
  const start = format(startDate, "dd/MM/yyyy", { locale: ptBR });
  const end = format(endDate, "dd/MM/yyyy", { locale: ptBR });
  return `${start} - ${end}`;
};

const WeeklyReportsHistory = ({
  projectStartDate,
  reportDate,
  activities,
  onReportClick,
}: WeeklyReportsHistoryProps) => {
  const weeklyReports = generateWeeklyReports(projectStartDate, reportDate, activities);

  return (
    <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          Relatórios Semanais
        </h2>
      </div>

      <div className="space-y-3 md:space-y-4">
        {weeklyReports.map((report, index) => (
          <button
            key={report.weekNumber}
            onClick={() => onReportClick?.(report, weeklyReports.length - 1 - index)}
            className="w-full bg-card hover:bg-accent/50 border border-border rounded-xl p-4 md:p-5 flex items-center justify-between transition-all duration-200 active:scale-[0.99] group"
          >
            <div className="flex flex-col items-start gap-1.5 md:gap-2">
              <div className="flex items-center gap-3">
                <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs md:text-sm font-semibold">
                  Semana {report.weekNumber}
                </span>
                <span className="text-muted-foreground text-xs md:text-sm">
                  {formatDateRange(report.startDate, report.endDate)}
                </span>
              </div>
              <span className="text-muted-foreground text-xs md:text-sm pl-0.5">
                Relatório semanal de acompanhamento
              </span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-2xl md:text-3xl font-bold text-primary">
                {report.completionPercentage}%
              </span>
              <span className="text-xs text-muted-foreground">Conclusão</span>
            </div>
          </button>
        ))}
      </div>

      {weeklyReports.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum relatório semanal disponível ainda.</p>
        </div>
      )}
    </div>
  );
};

export default WeeklyReportsHistory;
