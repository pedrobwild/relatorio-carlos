import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface MobileListItemProps {
  /** Primary label */
  title: string;
  /** Secondary text (date, description) */
  subtitle?: string;
  /** Left element (icon, avatar, status dot) */
  leading?: React.ReactNode;
  /** Right element (badge, status, value) */
  trailing?: React.ReactNode;
  /** Show navigation chevron */
  showChevron?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional className */
  className?: string;
}

/**
 * MobileListItem — standardized list row with consistent 44px touch target.
 * Leading icon/avatar + title/subtitle + trailing status/value + optional chevron.
 */
export function MobileListItem({
  title,
  subtitle,
  leading,
  trailing,
  showChevron = true,
  onClick,
  className,
}: MobileListItemProps) {
  const isClickable = !!onClick;
  const Component = isClickable ? "button" : "div";

  return (
    <Component
      className={cn(
        "flex items-center gap-3 w-full min-h-[44px] px-4 py-3 text-left",
        "border-b border-border last:border-b-0",
        isClickable && "hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
        className
      )}
      onClick={onClick}
      type={isClickable ? "button" : undefined}
    >
      {leading && (
        <div className="shrink-0 flex items-center justify-center w-10 h-10">
          {leading}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {trailing && (
        <div className="shrink-0 flex items-center">
          {trailing}
        </div>
      )}

      {showChevron && isClickable && (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
      )}
    </Component>
  );
}
