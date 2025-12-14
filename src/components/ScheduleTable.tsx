import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Clock, AlertCircle, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Activity } from "@/types/report";

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
      className: "bg-success/10 text-success border-success/20",
    },
    delayed: {
      icon: AlertCircle,
      label: "Atrasado",
      className: "bg-warning/10 text-warning border-warning/20",
    },
    "on-time": {
      icon: Clock,
      label: "No prazo",
      className: "bg-info/10 text-info border-info/20",
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border tracking-wide ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
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
      className={`cursor-pointer select-none transition-colors hover:bg-primary-dark/20 ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span>{children}</span>
        {isActive ? (
          direction === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
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

  if (activities.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CalendarDays className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">Nenhuma atividade cadastrada.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 md:mt-10">
      <div className="flex items-center gap-2 mb-5">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
          Cronograma Detalhado
        </h3>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {sortedActivities.map((activity, index) => {
          const status = getActivityStatus(activity);
          return (
            <div
              key={index}
              className="bg-card border border-border rounded-xl p-4 shadow-card opacity-0 animate-fade-in"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {index + 1}
                </span>
                <StatusBadge status={status} />
              </div>

              <p className="text-sm font-semibold text-foreground mb-4 leading-relaxed">
                {activity.description}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between py-2.5 px-3 bg-secondary rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Previsto
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {activity.plannedStart} → {activity.plannedEnd}
                  </span>
                </div>

                <div
                  className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${
                    status === "delayed"
                      ? "bg-warning/10"
                      : status === "completed"
                      ? "bg-success/10"
                      : "bg-secondary"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        status === "delayed"
                          ? "bg-warning"
                          : status === "completed"
                          ? "bg-success"
                          : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Realizado
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {activity.actualStart || "—"} → {activity.actualEnd || "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b-0">
              <SortableHeader
                field="description"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                className="gradient-primary text-primary-foreground font-bold text-xs uppercase tracking-wider py-4 pl-5 text-left rounded-tl-xl"
              >
                Atividade
              </SortableHeader>
              <SortableHeader
                field="plannedStart"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                className="gradient-primary text-primary-foreground font-bold text-xs uppercase tracking-wider py-4"
              >
                Início Previsto
              </SortableHeader>
              <SortableHeader
                field="plannedEnd"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                className="gradient-primary text-primary-foreground font-bold text-xs uppercase tracking-wider py-4"
              >
                Término Previsto
              </SortableHeader>
              <SortableHeader
                field="actualStart"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                className="bg-accent text-accent-foreground font-bold text-xs uppercase tracking-wider py-4"
              >
                Início Real
              </SortableHeader>
              <SortableHeader
                field="actualEnd"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                className="bg-accent text-accent-foreground font-bold text-xs uppercase tracking-wider py-4"
              >
                Término Real
              </SortableHeader>
              <SortableHeader
                field="status"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
                className="bg-accent text-accent-foreground font-bold text-xs uppercase tracking-wider py-4 pr-5 rounded-tr-xl"
              >
                Status
              </SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedActivities.map((activity, index) => {
              const status = getActivityStatus(activity);
              const isLast = index === sortedActivities.length - 1;
              return (
                <TableRow
                  key={index}
                  className={`transition-colors hover:bg-accent/30 ${
                    index % 2 === 0 ? "bg-card" : "bg-secondary/30"
                  }`}
                >
                  <TableCell
                    className={`py-4 pl-5 pr-4 ${isLast ? "rounded-bl-xl" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground leading-snug">
                        {activity.description}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-center text-sm font-medium text-muted-foreground tabular-nums">
                    {activity.plannedStart}
                  </TableCell>
                  <TableCell className="py-4 text-center text-sm font-medium text-muted-foreground tabular-nums">
                    {activity.plannedEnd}
                  </TableCell>
                  <TableCell className="py-4 text-center text-sm font-semibold text-foreground tabular-nums">
                    {activity.actualStart || "—"}
                  </TableCell>
                  <TableCell className="py-4 text-center text-sm font-semibold text-foreground tabular-nums">
                    {activity.actualEnd || "—"}
                  </TableCell>
                  <TableCell
                    className={`py-4 pr-5 text-center ${isLast ? "rounded-br-xl" : ""}`}
                  >
                    <StatusBadge status={status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ScheduleTable;
