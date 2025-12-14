import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Clock, AlertCircle, CalendarDays } from "lucide-react";
import { Activity } from "@/types/report";

interface ScheduleTableProps {
  activities: Activity[];
}

type Status = "completed" | "delayed" | "on-time" | "pending";

const getActivityStatus = (activity: Activity): Status => {
  if (!activity.actualEnd) {
    return "pending";
  }

  const parseDate = (dateStr: string): Date => {
    const [day, month] = dateStr.split("/").map(Number);
    const year = month >= 10 ? 2024 : 2025;
    return new Date(year, month - 1, day);
  };

  const plannedEnd = parseDate(activity.plannedEnd);
  const actualEnd = parseDate(activity.actualEnd);

  if (actualEnd > plannedEnd) {
    return "delayed";
  }
  return "completed";
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

const ScheduleTable = ({ activities }: ScheduleTableProps) => {
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
        {activities.map((activity, index) => {
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
              <TableHead className="gradient-primary text-primary-foreground font-bold text-xs uppercase tracking-wider py-4 pl-5 text-left rounded-tl-xl">
                Atividade
              </TableHead>
              <TableHead className="gradient-primary text-primary-foreground font-bold text-xs uppercase tracking-wider py-4 text-center">
                Início Previsto
              </TableHead>
              <TableHead className="gradient-primary text-primary-foreground font-bold text-xs uppercase tracking-wider py-4 text-center">
                Término Previsto
              </TableHead>
              <TableHead className="bg-accent text-accent-foreground font-bold text-xs uppercase tracking-wider py-4 text-center">
                Início Real
              </TableHead>
              <TableHead className="bg-accent text-accent-foreground font-bold text-xs uppercase tracking-wider py-4 text-center">
                Término Real
              </TableHead>
              <TableHead className="bg-accent text-accent-foreground font-bold text-xs uppercase tracking-wider py-4 pr-5 text-center rounded-tr-xl">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity, index) => {
              const status = getActivityStatus(activity);
              const isLast = index === activities.length - 1;
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
