import { format, addWeeks, startOfWeek, endOfWeek, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, WeeklyReport } from "@/types/report";

interface WeeklyReportsHistoryProps {
  projectStartDate: string;
  reportDate: string;
  activities: Activity[];
  onReportClick?: (report: WeeklyReport) => void;
}

const generateWeeklyReports = (
  projectStartDate: string,
  reportDate: string,
  activities: Activity[]
): WeeklyReport[] => {
  const startDate = new Date(projectStartDate);
  const currentReportDate = new Date(reportDate);
  const reports: WeeklyReport[] = [];
  
  let weekNumber = 1;
  let weekStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday start
  
  while (isBefore(weekStart, currentReportDate) || weekStart.getTime() === currentReportDate.getTime()) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // Sunday end
    
    // Calculate completion percentage for this week
    // Count activities that were completed by the end of this week
    const weekEndDate = isAfter(weekEnd, currentReportDate) ? currentReportDate : weekEnd;
    
    const completedActivities = activities.filter(activity => {
      if (!activity.actualEnd) return false;
      const actualEndDate = new Date(activity.actualEnd);
      return isBefore(actualEndDate, weekEndDate) || actualEndDate.getTime() === weekEndDate.getTime();
    });
    
    const completionPercentage = Math.round((completedActivities.length / activities.length) * 100);
    
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
        {weeklyReports.map((report) => (
          <button
            key={report.weekNumber}
            onClick={() => onReportClick?.(report)}
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
