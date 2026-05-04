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
  /** Compact size — reduced padding, font size & min-height */
  size?: "default" | "compact";
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
  size = "default",
  badge,
  className,
  onClick,
  tooltip,
  children,
}: KPIStatCardProps) {
  const Comp = onClick ? "button" : "div";
  const isCompact = size === "compact";

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
        "rounded-xl border flex flex-col justify-between text-left transition-all group",
        isCompact ? "px-2 py-1.5 min-h-0 gap-0.5" : "p-3 sm:p-3.5 min-h-[88px]",
        variantStyles[variant],
        onClick &&
          "cursor-pointer hover:shadow-md hover:border-primary/30 active:scale-[0.98]",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <Icon
          className={cn(
            "flex-shrink-0",
            isCompact ? "w-2.5 h-2.5" : "w-3.5 h-3.5",
            iconStyles[variant],
          )}
        />
        <span
          className={cn(
            "font-medium uppercase tracking-wider text-muted-foreground leading-none truncate",
            isCompact ? "text-[9px]" : "text-[11px]",
          )}
        >
          {label}
        </span>
        {badge}
      </div>
      {children || (
        <div className={cn("mt-auto", isCompact ? "pt-0" : "pt-1.5")}>
          <p
            className={cn(
              "font-bold tabular-nums leading-none",
              isCompact ? "text-xs" : "text-xl",
              valueStyles[variant],
            )}
          >
            {value}
          </p>
          {unit && (
            <span
              className={cn(
                "font-normal text-muted-foreground block",
                isCompact ? "text-[9px] mt-0" : "text-[11px] mt-1",
              )}
            >
              {unit}
            </span>
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
