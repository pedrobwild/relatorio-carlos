import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LucideIcon, ChevronRight } from "lucide-react";

interface MobileSectionCardProps {
  /** Card title */
  title: string;
  /** Optional subtitle / description */
  subtitle?: string;
  /** Optional left icon */
  icon?: LucideIcon;
  /** Right-side action element (button, badge, etc.) */
  action?: React.ReactNode;
  /** Card content */
  children?: React.ReactNode;
  /** Make entire card clickable */
  onClick?: () => void;
  /** Show chevron indicator for navigation */
  showChevron?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * MobileSectionCard — standard mobile card.
 *
 * - 44px minimum hit area when clickable.
 * - Visible focus ring + active scale feedback.
 * - Title/subtitle hierarchy tuned for mobile reading (14px / 12px).
 */
export function MobileSectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  onClick,
  showChevron = false,
  className,
}: MobileSectionCardProps) {
  const isClickable = !!onClick;

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isClickable &&
          "cursor-pointer active:bg-muted/50 active:scale-[0.995] transition-[transform,background-color] duration-150",
        isClickable &&
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
              <Icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-foreground truncate">{title}</h3>
            {subtitle && (
              <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
          {showChevron && !action && (
            <ChevronRight
              className="h-4 w-4 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
          )}
        </div>
      </CardHeader>
      {children && <CardContent className="p-4 pt-3">{children}</CardContent>}
    </Card>
  );
}
