import React, { memo } from "react";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Status } from "./types";

const config: Record<Status, { icon: typeof CheckCircle2; label: string; className: string }> = {
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

export const StatusBadge = memo(
  React.forwardRef<HTMLSpanElement, { status: Status }>(({ status, ...rest }, ref) => {
    const { icon: Icon, label, className } = config[status];
    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold border whitespace-nowrap ${className}`}
        {...rest}
      >
        <Icon className="w-3 h-3 md:w-3.5 md:h-3.5" />
        {label}
      </span>
    );
  })
);
StatusBadge.displayName = "StatusBadge";
