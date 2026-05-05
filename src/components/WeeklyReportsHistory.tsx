import { format, isBefore, isAfter, addDays, setHours, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Activity, WeeklyReport } from "@/types/report";
import { parseLocalDate } from "@/lib/activityStatus";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ChevronRight,
  Clock,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

interface WeeklyReportsHistoryProps {
  projectStartDate: string;
  reportDate: string;
  activities: Activity[];
  onReportClick?: (report: WeeklyReport, index: number) => void;
  isStaff?: boolean; // Staff can see all reports immediately
  projectEndDate?: string; // Caps weekly report generation at the project end
}

const BRASILIA_TZ = "America/Sao_Paulo";
const REPORT_AVAILABLE_HOUR = 20; // 20:00 Brasilia time
const DAYS_AFTER_WEEK_END = 1; // Available next day at 20:00 (effectively 3 days after week start for a 7-day week)

const calculatePlannedProgress = (
  activities: Activity[],
  weekEndDate: Date,
  _projectStartDate: Date,
): number => {
  // Check if any activity has weight defined
  const hasWeights = activities.some((a) => a.weight !== undefined);

  // Calculate total weight (should be 100, but normalize if not)
  const totalWeight = hasWeights
    ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
    : activities.length;

  // BUG FIX: Guard against division by zero
  if (totalWeight === 0) return 0;

  const completedWeight = activities.reduce((sum, activity) => {
    const plannedEnd = parseLocalDate(activity.plannedEnd);
    if (
      isBefore(plannedEnd, weekEndDate) ||
      plannedEnd.getTime() === weekEndDate.getTime()
    ) {
      return sum + (hasWeights ? activity.weight || 0 : 1);
    }
    return sum;
  }, 0);

  return Math.round((completedWeight / totalWeight) * 100);
};

const calculateActualProgress = (
  activities: Activity[],
  weekEndDate: Date,
): number => {
  // Check if any activity has weight defined
  const hasWeights = activities.some((a) => a.weight !== undefined);

  // Calculate total weight (should be 100, but normalize if not)
  const totalWeight = hasWeights
    ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
    : activities.length;

  // BUG FIX: Guard against division by zero
  if (totalWeight === 0) return 0;

  const completedWeight = activities.reduce((sum, activity) => {
    if (activity.actualEnd) {
      const actualEnd = parseLocalDate(activity.actualEnd);
      if (
        isBefore(actualEnd, weekEndDate) ||
        actualEnd.getTime() === weekEndDate.getTime()
      ) {
        return sum + (hasWeights ? activity.weight || 0 : 1);
      }
    }
    return sum;
  }, 0);

  return Math.round((completedWeight / totalWeight) * 100);
};

export interface ExtendedWeeklyReport extends WeeklyReport {
  plannedPercentage: number;
  status: "ahead" | "on-track" | "behind";
  variance: number;
  currentActivityName: string | null;
  isAvailableForCustomer: boolean;
  availableAt: Date;
}

/**
 * Check if a report is available for customers to view
 * Reports become available 1 day after the week ends, at 20:00 Brasilia time
 */
const isReportAvailableForCustomer = (
  weekEndDate: Date,
): { isAvailable: boolean; availableAt: Date } => {
  // Report available next day after week ends at 20:00 Brasilia
  const availableAt = setHours(
    addDays(weekEndDate, DAYS_AFTER_WEEK_END),
    REPORT_AVAILABLE_HOUR,
  );

  // Get current time in Brasilia
  const now = new Date();
  const nowInBrasilia = toZonedTime(now, BRASILIA_TZ);
  const availableInBrasilia = toZonedTime(availableAt, BRASILIA_TZ);

  return {
    isAvailable: nowInBrasilia >= availableInBrasilia,
    availableAt,
  };
};

// eslint-disable-next-line react-refresh/only-export-components
export const generateWeeklyReports = (
  projectStartDate: string,
  reportDate: string,
  activities: Activity[],
  projectEndDate?: string,
): ExtendedWeeklyReport[] => {
  const startDate = parseLocalDate(projectStartDate);
  // Cap report generation at the project end date so the timeline does not
  // keep producing empty weeks after the project's planned/actual conclusion.
  const rawReportDate = parseLocalDate(reportDate);
  const endCap = projectEndDate ? parseLocalDate(projectEndDate) : null;
  const currentReportDate =
    endCap && isBefore(endCap, rawReportDate) ? endCap : rawReportDate;
  const reports: ExtendedWeeklyReport[] = [];

  let weekNumber = 1;
  // Start from the actual project start date
  let weekStart = startDate;
  let previousPercentage = 0;

  // Helper to get Friday of a given week (or the date itself if it's already Friday)
  const getFridayOfWeek = (date: Date): Date => {
    const dayOfWeek = getDay(date); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    if (dayOfWeek === 5) return date; // Already Friday
    if (dayOfWeek === 6) return addDays(date, 6); // Saturday -> next Friday
    if (dayOfWeek === 0) return addDays(date, 5); // Sunday -> next Friday
    // Mon-Thu: advance to Friday
    return addDays(date, 5 - dayOfWeek);
  };

  // Helper to get next Monday
  const getNextMonday = (date: Date): Date => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 0) return addDays(date, 1); // Sunday -> Monday
    if (dayOfWeek === 1) return date; // Already Monday
    // Otherwise, go to next Monday
    return addDays(date, 8 - dayOfWeek);
  };

  while (
    isBefore(weekStart, currentReportDate) ||
    weekStart.getTime() === currentReportDate.getTime()
  ) {
    // Week ends on Friday
    const weekEnd = getFridayOfWeek(weekStart);

    const weekEndDate = isAfter(weekEnd, currentReportDate)
      ? currentReportDate
      : weekEnd;

    let completionPercentage = calculateActualProgress(activities, weekEndDate);
    completionPercentage = Math.max(completionPercentage, previousPercentage);
    previousPercentage = completionPercentage;

    const plannedPercentage = calculatePlannedProgress(
      activities,
      weekEndDate,
      startDate,
    );
    const variance = completionPercentage - plannedPercentage;

    let status: "ahead" | "on-track" | "behind" = "on-track";
    if (variance > 5) status = "ahead";
    else if (variance < -5) status = "behind";

    // Find the current activity for this week - prioritize activity that starts during the week
    const overlappingActivities = activities.filter((activity) => {
      const plannedStart = parseLocalDate(activity.plannedStart);
      const plannedEnd = parseLocalDate(activity.plannedEnd);
      return (
        (isBefore(plannedStart, weekEndDate) ||
          plannedStart.getTime() === weekEndDate.getTime()) &&
        (isAfter(plannedEnd, weekStart) ||
          plannedEnd.getTime() === weekStart.getTime())
      );
    });

    // Sort by planned start date to get the earliest activity that overlaps this week
    const currentActivity =
      overlappingActivities.sort((a, b) => {
        return (
          parseLocalDate(a.plannedStart).getTime() -
          parseLocalDate(b.plannedStart).getTime()
        );
      })[0] || null;

    // Check availability for customers
    const { isAvailable, availableAt } = isReportAvailableForCustomer(weekEnd);

    // Also unlock if all overlapping activities for this week are completed
    // (actualEnd filled with a date <= weekEndDate means the stage finished early)
    const allOverlappingCompleted =
      overlappingActivities.length > 0 &&
      overlappingActivities.every((a) => {
        if (!a.actualEnd) return false;
        const actualEnd = parseLocalDate(a.actualEnd);
        return (
          isBefore(actualEnd, weekEndDate) ||
          actualEnd.getTime() === weekEndDate.getTime()
        );
      });

    reports.push({
      weekNumber,
      startDate: weekStart,
      endDate: weekEnd,
      completionPercentage,
      plannedPercentage,
      status,
      variance,
      currentActivityName: currentActivity?.description || null,
      isAvailableForCustomer: isAvailable || allOverlappingCompleted,
      availableAt,
    });

    // Move to next week (next Monday after the current Friday)
    weekStart = getNextMonday(addDays(weekEnd, 1));
    weekNumber++;

    if (weekNumber > 52) break;
  }

  // Return in ascending order (oldest first)
  return reports;
};

const formatDateRange = (startDate: Date, endDate: Date): string => {
  const start = format(startDate, "dd MMM", { locale: ptBR });
  const end = format(endDate, "dd MMM", { locale: ptBR });
  return `${start} - ${end}`;
};

const getStatusConfig = (status: "ahead" | "on-track" | "behind") => {
  switch (status) {
    case "ahead":
      return {
        label: "Adiantado",
        icon: TrendingUp,
        className: "bg-success/10 text-[hsl(var(--success))] border-success/20",
        iconClassName: "text-[hsl(var(--success))]",
      };
    case "behind":
      return {
        label: "Atrasado",
        icon: TrendingDown,
        className: "bg-destructive/10 text-destructive border-destructive/20",
        iconClassName: "text-destructive",
      };
    default:
      return {
        label: "Em dia",
        icon: Minus,
        className: "bg-info/10 text-[hsl(var(--info))] border-info/20",
        iconClassName: "text-[hsl(var(--info))]",
      };
  }
};

const WeeklyReportsHistory = ({
  projectStartDate,
  reportDate,
  activities,
  onReportClick,
  isStaff = false,
  projectEndDate,
}: WeeklyReportsHistoryProps) => {
  const weeklyReportsAsc = generateWeeklyReports(
    projectStartDate,
    reportDate,
    activities,
    projectEndDate,
  );
  // Display in descending order (most recent first)
  const weeklyReports = [...weeklyReportsAsc].reverse();
  const latestReport = weeklyReportsAsc[weeklyReportsAsc.length - 1]; // Latest is the last one in ascending order

  // Prepare chart data (already in chronological order)
  const _chartData = weeklyReports.map((report) => ({
    week: report.weekNumber,
    variance: report.variance,
    fill:
      report.variance >= 0
        ? "url(#positiveGradient)"
        : "url(#negativeGradient)",
  }));

  const handleReportClick = (report: ExtendedWeeklyReport, index: number) => {
    // Staff can always access, customers need to wait
    if (isStaff || report.isAvailableForCustomer) {
      onReportClick?.(report, index);
    }
  };

  return (
    <div
      className="animate-fade-in space-y-3"
      style={{ animationDelay: "0.1s" }}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-h3">Histórico de Relatórios</h2>
        <span className="text-tiny">{weeklyReports.length} relatórios</span>
      </div>

      {/* Reports List */}
      <div className="space-y-2">
        {weeklyReports.map((report, index) => {
          const statusConfig = getStatusConfig(report.status);
          const _StatusIcon = statusConfig.icon;
          const isLatest = report.weekNumber === latestReport?.weekNumber;
          const canAccess = isStaff || report.isAvailableForCustomer;

          return (
            <button
              key={report.weekNumber}
              onClick={() => handleReportClick(report, index)}
              disabled={!canAccess}
              className={cn(
                "w-full bg-card border border-border rounded-lg p-2.5 transition-all duration-200 group",
                canAccess
                  ? "active:scale-[0.99] hover:border-primary/30 hover:shadow-sm"
                  : "opacity-60 cursor-not-allowed",
                isLatest && canAccess && "ring-1 ring-primary/20",
              )}
            >
              <div className="flex items-center gap-2.5">
                {/* Week Badge */}
                <div
                  className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center",
                    isLatest && canAccess ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "text-[8px] uppercase font-medium opacity-80",
                      isLatest && canAccess
                        ? "text-white"
                        : "text-muted-foreground",
                    )}
                  >
                    Sem
                  </span>
                  <span
                    className={cn(
                      "text-body font-bold",
                      isLatest && canAccess ? "text-white" : "text-foreground",
                    )}
                  >
                    {report.weekNumber}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span className="text-tiny">
                        {formatDateRange(report.startDate, report.endDate)}
                      </span>
                    </div>
                    {isLatest && canAccess && (
                      <span className="bg-primary/10 text-primary text-[8px] font-medium px-1.5 py-0.5 rounded-full">
                        Atual
                      </span>
                    )}
                    {!canAccess && (
                      <span className="bg-muted text-muted-foreground text-[8px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Lock className="h-2 w-2" />
                        Disponível em breve
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-1">
                    <div className="flex items-center justify-between text-tiny mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Progresso</span>
                      </div>
                      <span className="font-medium">
                        {report.completionPercentage}%
                      </span>
                    </div>
                    <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                      {/* Planned indicator */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/50 z-10"
                        style={{ left: `${report.plannedPercentage}%` }}
                      />
                      {/* Actual progress - Green if ahead or on-track, red if behind */}
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500 bg-[hsl(var(--success))]",
                        )}
                        style={{ width: `${report.completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Current Activity/Phase */}
                  {report.currentActivityName && canAccess && (
                    <div className="flex items-center gap-1 text-tiny text-muted-foreground">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      <span className="line-clamp-1">
                        Etapa: {report.currentActivityName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Arrow or Lock */}
                {canAccess ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {weeklyReports.length === 0 && (
        <EmptyState
          icon={AlertTriangle}
          title="Relatórios em breve"
          description="Os relatórios semanais da obra aparecerão aqui assim que as atividades no canteiro começarem. Você poderá acompanhar fotos, avanços e observações."
          infoLink={{ label: "Entenda como funciona", href: "#faq-relatorios" }}
        />
      )}
    </div>
  );
};

export default WeeklyReportsHistory;
