import { format, addWeeks, startOfWeek, endOfWeek, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, WeeklyReport } from "@/types/report";
import { TrendingUp, TrendingDown, Minus, Calendar, ChevronRight, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, BarChart, Bar, Cell } from "recharts";

interface WeeklyReportsHistoryProps {
  projectStartDate: string;
  reportDate: string;
  activities: Activity[];
  onReportClick?: (report: WeeklyReport, index: number) => void;
}

const calculatePlannedProgress = (
  activities: Activity[],
  weekEndDate: Date,
  projectStartDate: Date
): number => {
  const totalActivities = activities.length;
  let plannedComplete = 0;
  
  activities.forEach(activity => {
    const plannedEnd = new Date(activity.plannedEnd);
    if (isBefore(plannedEnd, weekEndDate) || plannedEnd.getTime() === weekEndDate.getTime()) {
      plannedComplete++;
    }
  });
  
  return Math.round((plannedComplete / totalActivities) * 100);
};

const calculateActualProgress = (
  activities: Activity[],
  weekEndDate: Date
): number => {
  const totalActivities = activities.length;
  let actualComplete = 0;
  
  activities.forEach(activity => {
    if (activity.actualEnd) {
      const actualEnd = new Date(activity.actualEnd);
      if (isBefore(actualEnd, weekEndDate) || actualEnd.getTime() === weekEndDate.getTime()) {
        actualComplete++;
      }
    }
  });
  
  return Math.round((actualComplete / totalActivities) * 100);
};

export interface ExtendedWeeklyReport extends WeeklyReport {
  plannedPercentage: number;
  status: 'ahead' | 'on-track' | 'behind';
  variance: number;
  currentActivityName: string | null;
}

export const generateWeeklyReports = (
  projectStartDate: string,
  reportDate: string,
  activities: Activity[]
): ExtendedWeeklyReport[] => {
  const startDate = new Date(projectStartDate);
  const currentReportDate = new Date(reportDate);
  const reports: ExtendedWeeklyReport[] = [];
  
  let weekNumber = 1;
  let weekStart = startOfWeek(startDate, { weekStartsOn: 1 });
  let previousPercentage = 0;
  
  while (isBefore(weekStart, currentReportDate) || weekStart.getTime() === currentReportDate.getTime()) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekEndDate = isAfter(weekEnd, currentReportDate) ? currentReportDate : weekEnd;
    
    
    let completionPercentage = calculateActualProgress(activities, weekEndDate);
    completionPercentage = Math.max(completionPercentage, previousPercentage);
    previousPercentage = completionPercentage;
    
    const plannedPercentage = calculatePlannedProgress(activities, weekEndDate, startDate);
    const variance = completionPercentage - plannedPercentage;
    
    let status: 'ahead' | 'on-track' | 'behind' = 'on-track';
    if (variance > 5) status = 'ahead';
    else if (variance < -5) status = 'behind';

    // Find the current activity for this week
    const currentActivity = activities.find(activity => {
      const plannedStart = new Date(activity.plannedStart);
      const plannedEnd = new Date(activity.plannedEnd);
      return (isBefore(plannedStart, weekEndDate) || plannedStart.getTime() === weekEndDate.getTime()) &&
             (isAfter(plannedEnd, weekStart) || plannedEnd.getTime() === weekStart.getTime());
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
    });
    
    weekStart = addWeeks(weekStart, 1);
    weekNumber++;
    
    if (weekNumber > 52) break;
  }
  
  return reports.reverse();
};

const formatDateRange = (startDate: Date, endDate: Date): string => {
  const start = format(startDate, "dd MMM", { locale: ptBR });
  const end = format(endDate, "dd MMM", { locale: ptBR });
  return `${start} - ${end}`;
};

const getStatusConfig = (status: 'ahead' | 'on-track' | 'behind') => {
  switch (status) {
    case 'ahead':
      return {
        label: 'Adiantado',
        icon: TrendingUp,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        iconClassName: 'text-emerald-500',
      };
    case 'behind':
      return {
        label: 'Atrasado',
        icon: TrendingDown,
        className: 'bg-red-500/10 text-red-600 border-red-500/20',
        iconClassName: 'text-red-500',
      };
    default:
      return {
        label: 'Em dia',
        icon: Minus,
        className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        iconClassName: 'text-blue-500',
      };
  }
};

// Custom tooltip for the variance chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const variance = payload[0].value;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">Semana {label}</p>
        <p className={cn(
          "text-sm font-bold",
          variance >= 0 ? "text-emerald-600" : "text-red-600"
        )}>
          {variance > 0 ? '+' : ''}{variance}% vs previsto
        </p>
      </div>
    );
  }
  return null;
};

const WeeklyReportsHistory = ({
  projectStartDate,
  reportDate,
  activities,
  onReportClick,
}: WeeklyReportsHistoryProps) => {
  const weeklyReports = generateWeeklyReports(projectStartDate, reportDate, activities);
  const latestReport = weeklyReports[0];
  
  // Prepare chart data (chronological order for the chart)
  const chartData = [...weeklyReports].reverse().map(report => ({
    week: report.weekNumber,
    variance: report.variance,
    fill: report.variance >= 0 ? "url(#positiveGradient)" : "url(#negativeGradient)",
  }));

  return (
    <div className="animate-fade-in space-y-6" style={{ animationDelay: "0.1s" }}>
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-h1">
          Histórico de Relatórios
        </h2>
        <span className="text-caption">
          {weeklyReports.length} relatórios
        </span>
      </div>

      {/* Variance Evolution Chart - Hidden on mobile */}
      {weeklyReports.length > 1 && (
        <div className="hidden sm:block bg-card border border-border rounded-xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-h3">Evolução do Desvio</h3>
              <p className="text-caption">Realizado vs Previsto por semana</p>
            </div>
            {latestReport && (
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold",
                latestReport.variance >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
              )}>
                {latestReport.variance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {latestReport.variance > 0 ? '+' : ''}{latestReport.variance}%
              </div>
            )}
          </div>
          
          <div className="h-32 md:h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="week" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `S${value}`}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}%`}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <Bar dataKey="variance" radius={[4, 4, 4, 4]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.variance >= 0 ? "rgb(16, 185, 129)" : "rgb(239, 68, 68)"}
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex items-center justify-center gap-6 mt-3 text-caption text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/40" />
              <span>Adiantado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-500/40" />
              <span>Atrasado</span>
            </div>
          </div>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-3">
        {weeklyReports.map((report, index) => {
          const statusConfig = getStatusConfig(report.status);
          const StatusIcon = statusConfig.icon;
          const isLatest = index === 0;
          
          return (
            <button
              key={report.weekNumber}
              onClick={() => onReportClick?.(report, weeklyReports.length - 1 - index)}
              className={cn(
                "w-full bg-card border border-border rounded-xl p-4 md:p-5 transition-all duration-200 active:scale-[0.99] group hover:border-primary/30 hover:shadow-md",
                isLatest && "ring-2 ring-primary/20"
              )}
            >
              <div className="flex items-center gap-4">
                {/* Week Badge */}
                <div className={cn(
                  "flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center",
                  isLatest ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  <span className="text-tiny uppercase font-medium opacity-80">Sem</span>
                  <span className="text-h1 font-bold">{report.weekNumber}</span>
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-caption">
                        {formatDateRange(report.startDate, report.endDate)}
                      </span>
                    </div>
                    {isLatest && (
                      <span className="bg-primary/10 text-primary text-tiny font-medium px-2 py-0.5 rounded-full">
                        Atual
                      </span>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-caption mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Progresso</span>
                        {report.variance !== 0 && (
                          <span className={cn(
                            "font-medium",
                            report.variance > 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            ({report.variance > 0 ? '+' : ''}{report.variance}% vs previsto)
                          </span>
                        )}
                      </div>
                      <span className="font-medium">{report.completionPercentage}%</span>
                    </div>
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      {/* Planned indicator */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/50 z-10"
                        style={{ left: `${report.plannedPercentage}%` }}
                      />
                      {/* Actual progress - Green if ahead or on-track, red if behind */}
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          report.variance >= 0 ? "bg-emerald-500" : "bg-red-500"
                        )}
                        style={{ width: `${report.completionPercentage}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Current Activity/Phase */}
                  {report.currentActivityName && (
                    <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="truncate">Etapa: {report.currentActivityName}</span>
                    </div>
                  )}
                </div>
                
                {/* Arrow */}
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      {weeklyReports.length === 0 && (
        <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Nenhum relatório disponível</p>
          <p className="text-sm mt-1">Os relatórios semanais aparecerão aqui.</p>
        </div>
      )}
    </div>
  );
};

export default WeeklyReportsHistory;
