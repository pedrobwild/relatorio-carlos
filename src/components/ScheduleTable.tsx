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
}

type Status = "completed" | "delayed" | "on-time" | "pending";
type SortField = "description" | "plannedStart" | "plannedEnd" | "actualStart" | "actualEnd" | "status";
type SortDirection = "asc" | "desc";

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const [day, month] = dateStr.split("/").map(Number);
  const year = month >= 10 ? 2024 : 2025;
  return new Date(year, month - 1, day);
};

const getActivityStatus = (activity: Activity): Status => {
  if (!activity.actualEnd) {
    return "pending";
  }

  const plannedEnd = parseDate(activity.plannedEnd);
  const actualEnd = parseDate(activity.actualEnd);

  if (plannedEnd && actualEnd && actualEnd > plannedEnd) {
    return "delayed";
  }
  return "completed";
};

const getDelayDays = (activity: Activity): number | null => {
  if (!activity.actualEnd) return null;
  
  const plannedEnd = parseDate(activity.plannedEnd);
  const actualEnd = parseDate(activity.actualEnd);
  
  if (plannedEnd && actualEnd) {
    const diffTime = actualEnd.getTime() - plannedEnd.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return null;
};

const statusOrder: Record<Status, number> = {
  delayed: 0,
  pending: 1,
  "on-time": 2,
  completed: 3,
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
      className: "bg-warning/10 text-warning border-warning/30",
    },
    "on-time": {
      icon: Clock,
      label: "No prazo",
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

const ScheduleTable = ({ activities }: ScheduleTableProps) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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
    <div className="mt-6 md:mt-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
              Cronograma Detalhado
            </h3>
            <p className="text-xs text-muted-foreground">
              {stats.total} atividades • {stats.completed} concluídas • {stats.delayed} atrasadas
            </p>
          </div>
        </div>

        {/* Quick stats badges */}
        <div className="flex items-center gap-2">
          {stats.delayed > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/30">
              <AlertTriangle className="w-3 h-3" />
              {stats.delayed} atrasada{stats.delayed > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {sortedActivities.map((activity, index) => {
          const status = getActivityStatus(activity);
          const delayDays = getDelayDays(activity);
          const isDelayed = status === "delayed";
          
          return (
            <div
              key={index}
              className={`bg-card border rounded-xl p-4 shadow-sm opacity-0 animate-fade-in transition-all ${
                isDelayed ? "border-warning/40 bg-warning/5" : "border-border"
              }`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {index + 1}
                  </span>
                  {isDelayed && delayDays && (
                    <span className="text-[10px] font-semibold text-warning">
                      +{delayDays} dias
                    </span>
                  )}
                </div>
                <StatusBadge status={status} />
              </div>

              <p className="text-sm font-medium text-foreground mb-3 leading-relaxed">
                {activity.description}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/60 rounded-lg p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    Previsto
                  </p>
                  <p className="text-xs font-semibold text-foreground tabular-nums">
                    {activity.plannedStart} – {activity.plannedEnd}
                  </p>
                </div>
                
                <div className={`rounded-lg p-2.5 ${
                  isDelayed
                    ? "bg-warning/10"
                    : status === "completed"
                    ? "bg-success/10"
                    : "bg-secondary/60"
                }`}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    Realizado
                  </p>
                  <p className={`text-xs font-semibold tabular-nums ${
                    isDelayed ? "text-warning" : "text-foreground"
                  }`}>
                    {activity.actualStart || "—"} – {activity.actualEnd || "—"}
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
                const status = getActivityStatus(activity);
                const delayDays = getDelayDays(activity);
                const isDelayed = status === "delayed";
                
                return (
                  <TableRow
                    key={index}
                    className={`transition-colors border-b border-border/50 last:border-b-0 ${
                      isDelayed 
                        ? "bg-warning/5 hover:bg-warning/10" 
                        : index % 2 === 0 
                          ? "bg-card hover:bg-accent/30" 
                          : "bg-secondary/20 hover:bg-accent/30"
                    }`}
                  >
                    <TableCell className="py-3.5 pl-4 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-foreground leading-snug">
                          {activity.description}
                        </span>
                        {isDelayed && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Atraso de {delayDays} dias</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-center text-sm text-muted-foreground tabular-nums">
                      {activity.plannedStart}
                    </TableCell>
                    <TableCell className="py-3.5 text-center text-sm text-muted-foreground tabular-nums">
                      {activity.plannedEnd}
                    </TableCell>
                    <TableCell className="py-3.5 text-center text-sm font-medium text-foreground tabular-nums">
                      {activity.actualStart || "—"}
                    </TableCell>
                    <TableCell className={`py-3.5 text-center text-sm font-medium tabular-nums ${
                      isDelayed ? "text-warning" : "text-foreground"
                    }`}>
                      {activity.actualEnd || "—"}
                      {isDelayed && delayDays && (
                        <span className="ml-1.5 text-[10px] text-warning font-semibold">
                          (+{delayDays}d)
                        </span>
                      )}
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