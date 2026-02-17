import React, { useState, useMemo, memo, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmptyState } from "@/components/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Clock, AlertTriangle, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, X } from "lucide-react";
import { Activity } from "@/types/report";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

interface ScheduleTableProps {
  activities: Activity[];
  reportDate?: string;
  selectedActivityId?: string | null;
  onActivitySelect?: (activityId: string | null) => void;
  /** If true, actual dates become editable */
  canEditDates?: boolean;
  /** Callback to persist date changes */
  onUpdateActivityDates?: (activityId: string, updates: { actual_start?: string | null; actual_end?: string | null }) => Promise<boolean>;
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

const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00");
};

const getActivityStatus = (activity: Activity): Status => {
  if (!activity.actualStart) {
    return "pending";
  }
  if (activity.actualEnd) {
    return "completed";
  }
  return "in-progress";
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

const StatusBadge = memo(React.forwardRef<HTMLSpanElement, { status: Status }>(({ status, ...rest }, ref) => {
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
      ref={ref}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold border ${className}`}
      {...rest}
    >
      <Icon className="w-3 h-3 md:w-3.5 md:h-3.5" />
      {label}
    </span>
  );
}));
StatusBadge.displayName = 'StatusBadge';

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

/** Inline date cell with popover picker for staff */
function EditableDateCell({
  value,
  baseYear,
  activityId,
  field,
  onSave,
}: {
  value: string;
  baseYear: number;
  activityId: string;
  field: "actual_start" | "actual_end";
  onSave: (activityId: string, updates: { actual_start?: string | null; actual_end?: string | null }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentDate = value ? new Date(value + "T00:00:00") : undefined;

  const handleSelect = async (date: Date | undefined) => {
    setSaving(true);
    const isoDate = date ? toISODate(date) : null;
    await onSave(activityId, { [field]: isoDate });
    setSaving(false);
    setOpen(false);
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    await onSave(activityId, { [field]: null });
    setSaving(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm tabular-nums transition-all min-h-[32px]",
            "hover:bg-primary/10 hover:text-primary cursor-pointer group",
            value ? "font-medium text-foreground" : "text-muted-foreground",
            saving && "opacity-50 pointer-events-none"
          )}
          title={`Clique para ${value ? 'alterar' : 'definir'} a data`}
        >
          {value ? formatDate(value, baseYear) : "—"}
          <CalendarIcon className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center" sideOffset={4}>
        <div className="p-2 pb-0 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {field === "actual_start" ? "Início Real" : "Término Real"}
          </span>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleClear}
            >
              <X className="w-3 h-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={handleSelect}
          locale={ptBR}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

/** Read-only date cell for mobile editing */
function EditableDateCellMobile({
  value,
  baseYear,
  activityId,
  field,
  label,
  onSave,
}: {
  value: string;
  baseYear: number;
  activityId: string;
  field: "actual_start" | "actual_end";
  label: string;
  onSave: (activityId: string, updates: { actual_start?: string | null; actual_end?: string | null }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentDate = value ? new Date(value + "T00:00:00") : undefined;

  const handleSelect = async (date: Date | undefined) => {
    setSaving(true);
    const isoDate = date ? toISODate(date) : null;
    await onSave(activityId, { [field]: isoDate });
    setSaving(false);
    setOpen(false);
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    await onSave(activityId, { [field]: null });
    setSaving(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full text-left bg-muted/40 rounded-md px-2 py-1.5 transition-all",
            "hover:bg-primary/10 hover:ring-1 hover:ring-primary/30 cursor-pointer",
            saving && "opacity-50 pointer-events-none"
          )}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5 flex items-center gap-1">
            {label}
            <CalendarIcon className="w-2.5 h-2.5" />
          </p>
          <p className={cn(
            "text-xs font-semibold tabular-nums",
            value ? "text-foreground" : "text-muted-foreground"
          )}>
            {value ? formatDate(value, baseYear) : "Toque para definir"}
          </p>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <div className="p-2 pb-0 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleClear}
            >
              <X className="w-3 h-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={handleSelect}
          locale={ptBR}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

const ScheduleTable = ({ activities, reportDate, selectedActivityId, onActivitySelect, canEditDates, onUpdateActivityDates }: ScheduleTableProps) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  const baseYear = activities.length > 0 && activities[0].plannedStart
    ? new Date(activities[0].plannedStart + "T00:00:00").getFullYear()
    : new Date().getFullYear();

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

  const stats = useMemo(() => {
    const delayed = activities.filter(a => getActivityStatus(a) === "delayed").length;
    const completed = activities.filter(a => getActivityStatus(a) === "completed").length;
    const pending = activities.filter(a => getActivityStatus(a) === "pending").length;
    return { delayed, completed, pending, total: activities.length };
  }, [activities]);

  if (activities.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          variant="schedule"
          title="Nenhuma atividade cadastrada"
          description="As atividades do cronograma aparecerão aqui."
          compact
        />
      </div>
    );
  }

  return (
    <div className="mt-2 md:mt-4">
      {/* Header */}
      <div className="flex flex-col gap-1.5 mb-2">
        <div className="flex items-center gap-2">
          <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xs md:text-base font-bold text-foreground tracking-tight">
              Cronograma
            </h3>
            <p className="text-[9px] md:text-xs text-muted-foreground">
              {stats.total} atividades • {stats.completed} concluídas
              {canEditDates && (
                <span className="text-primary ml-1">• Datas editáveis</span>
              )}
            </p>
          </div>
          
          {stats.delayed > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-semibold bg-warning/10 text-warning border border-warning/30 shrink-0">
              <AlertTriangle className="w-2.5 h-2.5" />
              {stats.delayed}
            </span>
          )}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-1.5">
        {sortedActivities.map((activity, index) => {
          const originalIndex = activities.indexOf(activity);
          const status = getActivityStatus(activity);
          
          return (
            <div
              key={activity.id || index}
              className={cn(
                "bg-card border rounded-lg p-2.5 shadow-sm opacity-0 animate-fade-in transition-all",
                !canEditDates && onActivitySelect && "cursor-pointer active:scale-[0.98]",
                selectedActivityId === activity.id 
                  ? "border-primary ring-2 ring-primary/20" 
                  : "border-border"
              )}
              style={{ animationDelay: `${index * 30}ms` }}
              onClick={() => !canEditDates && onActivitySelect?.(selectedActivityId === activity.id ? null : activity.id || null)}
            >
              {/* Top row: Number + Status */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 bg-primary/10 text-primary">
                  {originalIndex + 1}
                </span>
                <StatusBadge status={status} />
              </div>

              {/* Title */}
              <p className="text-sm font-semibold leading-snug text-foreground mb-2">
                {activity.description}
              </p>

              {/* Dates grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/40 rounded-md px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Previsto</p>
                  <p className="text-xs font-semibold text-foreground tabular-nums">
                    {formatDate(activity.plannedStart, baseYear)} → {formatDate(activity.plannedEnd, baseYear)}
                  </p>
                </div>
                {canEditDates && onUpdateActivityDates && activity.id ? (
                  <>
                    <EditableDateCellMobile
                      value={activity.actualStart}
                      baseYear={baseYear}
                      activityId={activity.id}
                      field="actual_start"
                      label="Início Real"
                      onSave={onUpdateActivityDates}
                    />
                    <EditableDateCellMobile
                      value={activity.actualEnd}
                      baseYear={baseYear}
                      activityId={activity.id}
                      field="actual_end"
                      label="Término Real"
                      onSave={onUpdateActivityDates}
                    />
                  </>
                ) : (
                  <div className="bg-muted/40 rounded-md px-2 py-1.5">
                    <p className="text-[8px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Real</p>
                    <p className="text-[10px] font-semibold tabular-nums text-foreground">
                      {activity.actualStart ? `${formatDate(activity.actualStart, baseYear)} → ${formatDate(activity.actualEnd, baseYear)}` : "—"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <TooltipProvider>
        <div className="hidden md:block overflow-hidden rounded-xl border border-border shadow-sm">
          <Table data-testid="schedule-table">
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
                    key={activity.id || index}
                    className={cn(
                      "transition-colors border-b border-border/50 last:border-b-0",
                      !canEditDates && onActivitySelect && "cursor-pointer",
                      selectedActivityId === activity.id 
                        ? "bg-primary/10 hover:bg-primary/15 ring-1 ring-inset ring-primary/30" 
                        : index % 2 === 0 
                          ? "bg-card hover:bg-accent/30" 
                          : "bg-secondary/20 hover:bg-accent/30"
                    )}
                    onClick={() => !canEditDates && onActivitySelect?.(selectedActivityId === activity.id ? null : activity.id || null)}
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
                    <TableCell className="py-3.5 text-center">
                      {canEditDates && onUpdateActivityDates && activity.id ? (
                        <EditableDateCell
                          value={activity.actualStart}
                          baseYear={baseYear}
                          activityId={activity.id}
                          field="actual_start"
                          onSave={onUpdateActivityDates}
                        />
                      ) : (
                        <span className="text-sm font-medium text-foreground tabular-nums">
                          {formatDate(activity.actualStart, baseYear)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 text-center">
                      {canEditDates && onUpdateActivityDates && activity.id ? (
                        <EditableDateCell
                          value={activity.actualEnd}
                          baseYear={baseYear}
                          activityId={activity.id}
                          field="actual_end"
                          onSave={onUpdateActivityDates}
                        />
                      ) : (
                        <span className="text-sm font-medium tabular-nums text-foreground">
                          {formatDate(activity.actualEnd, baseYear)}
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
