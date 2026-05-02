import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

type MobileListItemTone = "default" | "warning" | "destructive" | "success";

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
  /** Visual emphasis tone (default · warning · destructive · success) */
  tone?: MobileListItemTone;
  /** Render as anchor (link). When provided, the row is rendered as an `<a>`. */
  href?: string;
  /** Disable interaction (button only) */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

const toneClasses: Record<MobileListItemTone, string> = {
  default: "",
  warning: "bg-warning/5 hover:bg-warning/10 active:bg-warning/15",
  destructive: "bg-destructive/5 hover:bg-destructive/10 active:bg-destructive/15",
  success: "bg-success/5 hover:bg-success/10 active:bg-success/15",
};

const toneAccentBorder: Record<MobileListItemTone, string> = {
  default: "",
  warning: "border-l-2 border-l-warning",
  destructive: "border-l-2 border-l-destructive",
  success: "border-l-2 border-l-success",
};

/**
 * MobileListItem — standardized list row.
 *
 * - 56px minimum touch target (exceeds WCAG 2.5.5 — 44×44).
 * - Optional `tone` for emphasis (warning · destructive · success).
 * - Renders as `<button>`, `<a>` (when `href` is set), or plain `<div>`.
 * - Visible focus ring; respects keyboard navigation.
 */
export function MobileListItem({
  title,
  subtitle,
  leading,
  trailing,
  showChevron = true,
  onClick,
  tone = "default",
  href,
  disabled = false,
  className,
}: MobileListItemProps) {
  const isInteractive = (!!onClick || !!href) && !disabled;
  const Component: React.ElementType = href ? "a" : isInteractive ? "button" : "div";

  const componentProps: React.HTMLAttributes<HTMLElement> & {
    href?: string;
    type?: "button";
    disabled?: boolean;
  } = {
    onClick: isInteractive ? onClick : undefined,
    className: cn(
      "flex items-center gap-3 w-full min-h-[56px] px-4 py-3 text-left",
      "border-b border-border-subtle last:border-b-0",
      isInteractive &&
        "active:scale-[0.99] transition-[transform,background-color] duration-150 cursor-pointer",
      isInteractive && tone === "default" && "hover:bg-muted/50 active:bg-muted",
      tone !== "default" && toneClasses[tone],
      tone !== "default" && toneAccentBorder[tone],
      "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
      disabled && "opacity-60 cursor-not-allowed",
      className,
    ),
  };

  if (href) componentProps.href = href;
  if (Component === "button") {
    componentProps.type = "button";
    componentProps.disabled = disabled;
  }

  return (
    <Component {...componentProps}>
      {leading && (
        <div className="shrink-0 flex items-center justify-center w-10 h-10">
          {leading}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-foreground truncate">{title}</p>
        {subtitle && (
          <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>
        )}
      </div>

      {trailing && <div className="shrink-0 flex items-center">{trailing}</div>}

      {showChevron && isInteractive && (
        <ChevronRight
          className="h-4 w-4 text-muted-foreground shrink-0"
          aria-hidden="true"
        />
      )}
    </Component>
  );
}
