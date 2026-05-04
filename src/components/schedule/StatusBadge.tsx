import React, { memo } from "react";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Status } from "./types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const config: Record<
  Status,
  {
    icon: typeof CheckCircle2;
    label: string;
    description: string;
    className: string;
  }
> = {
  completed: {
    icon: CheckCircle2,
    label: "Concluído",
    description: "Atividade finalizada dentro ou após o prazo planejado.",
    className: "bg-success/10 text-success border-success/30",
  },
  delayed: {
    icon: AlertTriangle,
    label: "Atrasado",
    description:
      "Atividade ultrapassou o término previsto sem ter sido concluída.",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  "on-time": {
    icon: Clock,
    label: "No prazo",
    description: "Atividade está dentro do prazo planejado.",
    className: "bg-info/10 text-info border-info/30",
  },
  "in-progress": {
    icon: Clock,
    label: "Em andamento",
    description: "Atividade iniciada e ainda em execução.",
    className: "bg-info/10 text-info border-info/30",
  },
  pending: {
    icon: Clock,
    label: "Pendente",
    description: "Atividade ainda não iniciada.",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export const StatusBadge = memo(
  React.forwardRef<HTMLSpanElement, { status: Status }>(
    ({ status, ...rest }, ref) => {
      const { icon: Icon, label, description, className } = config[status];
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                ref={ref}
                role="status"
                aria-label={`${label}: ${description}`}
                className={`inline-flex items-center justify-center gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold border whitespace-nowrap shrink-0 leading-none max-w-[110px] md:max-w-none cursor-help ${className}`}
                {...rest}
              >
                <Icon className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              <p className="font-semibold">{label}</p>
              <p className="text-muted-foreground">{description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  ),
);
StatusBadge.displayName = "StatusBadge";
