import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PurchaseAlertBadgeProps {
  urgencyLevel: "overdue" | "critical" | "warning" | "approaching" | "normal";
  daysUntil: number;
  showIcon?: boolean;
  size?: "sm" | "default";
}

export function PurchaseAlertBadge({
  urgencyLevel,
  daysUntil,
  showIcon = true,
  size = "default",
}: PurchaseAlertBadgeProps) {
  if (urgencyLevel === "normal") return null;

  const configs = {
    overdue: {
      variant: "destructive" as const,
      icon: AlertCircle,
      label: `${Math.abs(daysUntil)} dia(s) atrasado`,
      className: "animate-pulse",
    },
    critical: {
      variant: "destructive" as const,
      icon: AlertTriangle,
      label: daysUntil === 0 ? "Hoje" : `${daysUntil} dia(s)`,
      className: "",
    },
    warning: {
      variant: "outline" as const,
      icon: Clock,
      label: `${daysUntil} dias`,
      className:
        "border-[hsl(var(--warning))] text-[hsl(var(--warning))] bg-warning/5",
    },
    approaching: {
      variant: "secondary" as const,
      icon: Clock,
      label: `${daysUntil} dias`,
      className: "",
    },
  };

  const config = configs[urgencyLevel];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, size === "sm" && "text-xs px-1.5 py-0")}
    >
      {showIcon && (
        <Icon
          className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
        />
      )}
      {config.label}
    </Badge>
  );
}
