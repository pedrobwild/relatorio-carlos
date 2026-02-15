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
    warning: "bg-warning/8 border-warning/25",
    success: "bg-success/8 border-success/25",
  };

  const valueStyles = {
    default: "text-foreground",
    warning: "text-warning",
    success: "text-success",
  };

  const iconStyles = {
    default: "text-muted-foreground",
    warning: "text-warning",
    success: "text-success",
  };

  const card = (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 sm:p-3.5 flex flex-col justify-between text-left transition-all min-h-[88px] group",
        variantStyles[variant],
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/30 active:scale-[0.98]",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", iconStyles[variant])} />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground leading-none">{label}</span>
        {badge}
      </div>
      {children || (
        <div className="mt-auto pt-1.5">
          <p className={cn("text-xl font-bold tabular-nums leading-none", valueStyles[variant])}>
            {value}
          </p>
          {unit && (
            <span className="text-[11px] font-normal text-muted-foreground mt-1 block">{unit}</span>
          )}
        </div>
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
