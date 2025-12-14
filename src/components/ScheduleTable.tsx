import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Clock, AlertTriangle, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Activity } from "@/types/report";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScheduleTableProps {
  activities: Activity[];
  reportDate?: string;
}

type Status = "completed" | "delayed" | "on-time" | "in-progress" | "pending";
type SortField = "description" | "plannedStart" | "plannedEnd" | "actualStart" | "actualEnd" | "status";
type SortDirection = "asc" | "desc";

// Formata data ISO (YYYY-MM-DD) para dd/mm ou dd/mm/aa se ano diferente do base
const formatDate = (dateStr: string, baseYear?: number): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  
  if (baseYear && year !== baseYear) {
    return `${day}/${month}/${year.toString().slice(-2)}`;
  }
  return `${day}/${month}`;
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00");
};

const getActivityStatus = (activity: Activity): Status => {
  // Not started yet
  if (!activity.actualStart) {
    return "pending";
  }
  
  // Has actual end date = completed (regardless of delay)
  if (activity.actualEnd) {
    return "completed";
  }
  
  // Started but not finished
  return "in-progress";
};

const getDelayDays = (activity: Activity): number | null => {
  if (!activity.actualEnd) return null;
  
  const plannedEnd = parseDate(activity.plannedEnd);
  const actualEnd = parseDate(activity.actualEnd);
  
  if (plannedEnd && actualEnd) {
    const diffTime = actualEnd.getTime() - plannedEnd.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays; // Positive = delayed, Negative = ahead
  }
  return null;
};

// Formatação do desvio em dias
const formatDeviation = (days: number | null): { text: string; className: string } => {
  if (days === null) return { text: "—", className: "text-muted-foreground" };
  if (days === 0) return { text: "No prazo", className: "text-success" };
  if (days > 0) return { text: `+${days}d`, className: "text-destructive font-semibold" };
  return { text: `${days}d`, className: "text-success font-semibold" };
};

const statusOrder: Record<Status, number> = {
  delayed: 0,
  "in-progress": 1,
  pending: 2,
  "on-time": 3,
  completed: 4,
};

const StatusBadge = ({ status }: { status: Status }) => {
  const config = {
    completed: {
      icon: CheckCircle2,
      label: "Concluído",
      className: "bg-success/10 text-success border-success/30",
    },
    delayed: {
      icon: AlertTriangle,
      label: "Atrasado",
      className: "bg-destructive/10 text-destructive border-destructive/30",
    },
    "on-time": {
      icon: Clock,
      label: "No prazo",
      className: "bg-info/10 text-info border-info/30",
    },
    "in-progress": {
      icon: Clock,
      label: "Em andamento",
      className: "bg-info/10 text-info border-info/30",
    },
    pending: {
      icon: Clock,
      label: "Pendente",
      className: "bg-muted text-muted-foreground border-border",
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold border ${className}`}
    >
      <Icon className="w-3 h-3 md:w-3.5 md:h-3.5" />
      {label}
    </span>
  );
};

interface SortableHeaderProps {
  field: SortField;
  currentField: SortField | null;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
}

const SortableHeader = ({ field, currentField, direction, onSort, children, className = "" }: SortableHeaderProps) => {
  const isActive = currentField === field;
  
  return (
    <TableHead
      className={`cursor-pointer select-none transition-all hover:bg-primary/10 group ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        <span className="truncate">{children}</span>
        {isActive ? (
          direction === "asc" ? (
            <ArrowUp className="w-3 h-3 shrink-0" />
          ) : (
            <ArrowDown className="w-3 h-3 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0 transition-opacity" />
        )}
      </div>
    </TableHead>
  );
};

const ScheduleTable = ({ activities, reportDate }: ScheduleTableProps) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Get base year from first activity's planned start
  const baseYear = activities.length > 0 && activities[0].plannedStart
    ? new Date(activities[0].plannedStart + "T00:00:00").getFullYear()
    : new Date().getFullYear();

  // Find current activity index based on reportDate
  const currentActivityIndex = useMemo(() => {
    if (!reportDate) return -1;
    const currentDate = new Date(reportDate + "T00:00:00");
    
    return activities.findIndex(activity => {
      const plannedStart = new Date(activity.plannedStart + "T00:00:00");
      const plannedEnd = new Date(activity.plannedEnd + "T00:00:00");
      return currentDate >= plannedStart && currentDate <= plannedEnd;
    });
  }, [activities, reportDate]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedActivities = useMemo(() => {
    if (!sortField) return activities;

    return [...activities].sort((a, b) => {
      let comparison = 0;

      if (sortField === "status") {
        const statusA = getActivityStatus(a);
        const statusB = getActivityStatus(b);
        comparison = statusOrder[statusA] - statusOrder[statusB];
      } else if (sortField === "description") {
        comparison = a.description.localeCompare(b.description, "pt-BR");
      } else {
        const dateA = parseDate(a[sortField]);
        const dateB = parseDate(b[sortField]);
        
        if (!dateA && !dateB) comparison = 0;
        else if (!dateA) comparison = 1;
        else if (!dateB) comparison = -1;
        else comparison = dateA.getTime() - dateB.getTime();
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [activities, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => {
    const delayed = activities.filter(a => getActivityStatus(a) === "delayed").length;
    const completed = activities.filter(a => getActivityStatus(a) === "completed").length;
    const pending = activities.filter(a => getActivityStatus(a) === "pending").length;
    return { delayed, completed, pending, total: activities.length };
  }, [activities]);

  if (activities.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center py-12 text-muted-foreground bg-secondary/30 rounded-xl border border-border/50">
        <CalendarDays className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">Nenhuma atividade cadastrada.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 md:mt-8">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base md:text-xl font-bold text-foreground tracking-tight">
              Cronograma
            </h3>
            <p className="text-xs text-muted-foreground">
              {stats.total} atividades • {stats.completed} concluídas
            </p>
          </div>
          
          {/* Quick stats badge - inline on mobile */}
          {stats.delayed > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] md:text-xs font-semibold bg-warning/10 text-warning border border-warning/30 shrink-0">
              <AlertTriangle className="w-3 h-3" />
              {stats.delayed}
            </span>
          )}
        </div>
      </div>

      {/* Mobile Card View - Optimized for touch */}
      <div className="md:hidden space-y-2">
        {sortedActivities.map((activity, index) => {
          const originalIndex = activities.indexOf(activity);
          const status = getActivityStatus(activity);
          const isCurrentPhase = originalIndex === currentActivityIndex;
          const delayDays = getDelayDays(activity);
          const isDelayed = delayDays !== null && delayDays > 0;
          const isAhead = delayDays !== null && delayDays < 0;
          
          return (
            <div
              key={index}
              className="bg-card border rounded-xl p-3.5 shadow-sm opacity-0 animate-fade-in transition-all active:scale-[0.98] border-border"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {/* Top row: Number + Status */}
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 bg-primary/10 text-primary">
                  {originalIndex + 1}
                </span>
                <StatusBadge status={status} />
              </div>

              {/* Title - Full width, no truncation */}
              <p className="text-sm font-semibold leading-snug text-foreground mb-3">
                {activity.description}
              </p>

              {/* Dates grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-lg px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Previsto</p>
                  <p className="text-[11px] font-semibold text-foreground tabular-nums">
                    {formatDate(activity.plannedStart, baseYear)} → {formatDate(activity.plannedEnd, baseYear)}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Real</p>
                  <p className="text-[11px] font-semibold tabular-nums text-foreground">
                    {activity.actualStart ? `${formatDate(activity.actualStart, baseYear)} → ${formatDate(activity.actualEnd, baseYear)}` : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <TooltipProvider>
        <div className="hidden md:block overflow-hidden rounded-xl border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-0">
                <SortableHeader
                  field="description"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="bg-primary text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5 pl-4 text-left w-[35%]"
                >
                  Atividade
                </SortableHeader>
                <SortableHeader
                  field="plannedStart"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="bg-primary text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5"
                >
                  Início Prev.
                </SortableHeader>
                <SortableHeader
                  field="plannedEnd"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="bg-primary text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5"
                >
                  Término Prev.
                </SortableHeader>
                <SortableHeader
                  field="actualStart"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="bg-primary-dark text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5"
                >
                  Início Real
                </SortableHeader>
                <SortableHeader
                  field="actualEnd"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="bg-primary-dark text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5"
                >
                  Término Real
                </SortableHeader>
                <SortableHeader
                  field="status"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="bg-primary-dark text-primary-foreground font-semibold text-[11px] uppercase tracking-wider py-3.5 pr-4"
                >
                  Status
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedActivities.map((activity, index) => {
                const originalIndex = activities.indexOf(activity);
                const status = getActivityStatus(activity);
                
                return (
                  <TableRow
                    key={index}
                    className={`transition-colors border-b border-border/50 last:border-b-0 ${
                      index % 2 === 0 
                        ? "bg-card hover:bg-accent/30" 
                        : "bg-secondary/20 hover:bg-accent/30"
                    }`}
                  >
                    <TableCell className="py-3.5 pl-4 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 bg-primary/10 text-primary">
                          {originalIndex + 1}
                        </span>
                        <span className="text-sm font-medium leading-snug text-foreground">
                          {activity.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-center text-sm text-muted-foreground tabular-nums">
                      {formatDate(activity.plannedStart, baseYear)}
                    </TableCell>
                    <TableCell className="py-3.5 text-center text-sm text-muted-foreground tabular-nums">
                      {formatDate(activity.plannedEnd, baseYear)}
                    </TableCell>
                    <TableCell className="py-3.5 text-center text-sm font-medium text-foreground tabular-nums">
                      {formatDate(activity.actualStart, baseYear)}
                    </TableCell>
                    <TableCell className="py-3.5 text-center text-sm font-medium tabular-nums text-foreground">
                      {formatDate(activity.actualEnd, baseYear)}
                    </TableCell>
                    <TableCell className="py-3.5 pr-4 text-center">
                      <StatusBadge status={status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>
    </div>
  );
};

export default ScheduleTable;