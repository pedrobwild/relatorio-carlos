import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface KPIStatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  unit?: string;
  variant?: "default" | "warning" | "success";
  badge?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  tooltip?: string;
  children?: React.ReactNode;
}

export function KPIStatCard({
  icon: Icon,
  label,
  value,
  unit,
  variant = "default",
  badge,
  className,
  onClick,
  tooltip,
  children,
}: KPIStatCardProps) {
  const Comp = onClick ? "button" : "div";

  const variantStyles = {
    default: "bg-card border-border",
    warning: "bg-warning/10 border-warning/30",
    success: "bg-success/10 border-success/30",
  };

  const valueStyles = {
    default: "text-foreground",
    warning: "text-warning",
    success: "text-success",
  };

  const card = (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3.5 flex flex-col text-left transition-all min-h-[88px]",
        variantStyles[variant],
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/30",
        className
      )}
    >
      <div className="text-caption uppercase tracking-wider mb-auto flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
        <span className="text-[11px] font-semibold">{label}</span>
        {badge}
      </div>
      {children || (
        <p className={cn("text-xl font-bold mt-2 tabular-nums", valueStyles[variant])}>
          {value}
          {unit && (
            <span className="text-caption font-normal ml-1">{unit}</span>
          )}
        </p>
      )}
    </Comp>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="max-w-[240px]">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return card;
}
