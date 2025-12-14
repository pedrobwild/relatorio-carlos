import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
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
      icon: CheckCircle,
      label: "Concluído",
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    delayed: {
      icon: AlertTriangle,
      label: "Atrasado",
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    "on-time": {
      icon: Clock,
      label: "No prazo",
      className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

const ScheduleTable = ({ activities }: ScheduleTableProps) => {
  if (activities.length === 0) {
    return (
      <div className="mt-6 md:mt-8 text-center text-muted-foreground py-8">
        Nenhuma atividade cadastrada.
      </div>
    );
  }
  return (
    <div className="mt-6 md:mt-8">
      <h3 className="text-base md:text-xl font-bold text-foreground mb-3 md:mb-4">
        Cronograma Detalhado
      </h3>

      {/* Mobile Card View - UX Optimized with Staggered Animations */}
      <div className="md:hidden space-y-3">
        {activities.map((activity, index) => {
          const status = getActivityStatus(activity);
          return (
            <div
              key={index}
              className="bg-card border border-border rounded-xl p-4 shadow-sm active:scale-[0.99] transition-transform opacity-0 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
            >
              {/* Header with status */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-xs text-muted-foreground font-medium">
                  #{index + 1}
                </span>
                <StatusBadge status={status} />
              </div>

              {/* Activity description */}
              <p className="text-sm font-semibold text-foreground mb-4 leading-snug">
                {activity.description}
              </p>

              {/* Timeline comparison */}
              <div className="space-y-2">
                {/* Planned */}
                <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary/60" />
                    <span className="text-xs text-muted-foreground">
                      Previsto
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {activity.plannedStart} → {activity.plannedEnd}
                  </span>
                </div>

                {/* Actual */}
                <div
                  className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                    status === "delayed"
                      ? "bg-amber-500/10"
                      : "bg-emerald-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        status === "delayed" ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                    <span className="text-xs text-muted-foreground">
                      Realizado
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {activity.actualStart} → {activity.actualEnd}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border-2 border-muted-foreground/30 shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="gradient-primary hover:bg-transparent">
              <TableHead className="text-primary-foreground font-bold text-sm w-[35%] text-left border-r-2 border-primary-dark">
                DESCRIÇÃO DE ATIVIDADES
              </TableHead>
              <TableHead className="text-primary-foreground font-bold text-sm text-center border-r-2 border-primary-dark">
                DATA DE INÍCIO
                <br />
                PREVISTA
              </TableHead>
              <TableHead className="text-primary-foreground font-bold text-sm text-center border-r-2 border-primary-dark">
                DATA DE TÉRMINO
                <br />
                PREVISTO
              </TableHead>
              <TableHead className="bg-accent text-foreground font-bold text-sm text-center border-r-2 border-muted-foreground/30">
                DATA DE INÍCIO
              </TableHead>
              <TableHead className="bg-accent text-foreground font-bold text-sm text-center border-r-2 border-muted-foreground/30">
                DATA DE TÉRMINO
              </TableHead>
              <TableHead className="bg-accent text-foreground font-bold text-sm text-center">
                STATUS
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity, index) => {
              const status = getActivityStatus(activity);
              return (
                <TableRow
                  key={index}
                  className="transition-colors hover:bg-muted/50"
                >
                  <TableCell className="bg-accent/50 text-foreground text-sm font-medium border-r-2 border-border">
                    {activity.description}
                  </TableCell>
                  <TableCell className="text-center text-sm border-r-2 border-border">
                    {activity.plannedStart}
                  </TableCell>
                  <TableCell className="text-center text-sm border-r-2 border-border">
                    {activity.plannedEnd}
                  </TableCell>
                  <TableCell className="text-center text-sm border-r-2 border-border">
                    {activity.actualStart}
                  </TableCell>
                  <TableCell className="text-center text-sm border-r-2 border-border">
                    {activity.actualEnd}
                  </TableCell>
                  <TableCell className="text-center">
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
