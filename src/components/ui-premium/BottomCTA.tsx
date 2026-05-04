import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface BottomCTAAction {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  form?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonProps["variant"];
  icon?: React.ReactNode;
  /** When provided overrides default button render (e.g. router Link). */
  asChild?: boolean;
  children?: React.ReactNode;
  ariaLabel?: string;
}

interface BottomCTAProps {
  primary: BottomCTAAction;
  secondary?: BottomCTAAction;
  /**
   * When true, sits above the mobile bottom navigation. Use inside ProjectShell
   * pages where MobileBottomNav is rendered. Default: true (safe default).
   */
  aboveBottomNav?: boolean;
  /**
   * Render mode override. By default: fixed bar on mobile, inline-flex on
   * desktop (so the same component fits both layouts without duplication).
   */
  mode?: "auto" | "fixed" | "inline";
  className?: string;
}

const renderAction = (action: BottomCTAAction, isPrimary: boolean) => {
  const variant = action.variant ?? (isPrimary ? "default" : "outline");
  return (
    <Button
      type={action.type ?? "button"}
      form={action.form}
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      variant={variant}
      asChild={action.asChild}
      aria-label={action.ariaLabel ?? action.label}
      className={cn(
        "min-h-[44px] flex-1 text-base font-semibold",
        isPrimary ? "shadow-sm" : "",
      )}
    >
      {action.children ?? (
        <>
          {action.loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            action.icon
          )}
          <span>{action.label}</span>
        </>
      )}
    </Button>
  );
};

/**
 * BottomCTA — primary action bar anchored to the bottom of the viewport on
 * mobile. Inline on desktop. Respects safe-area-inset-bottom and avoids the
 * mobile bottom navigation when present.
 *
 * Variants are inferred from props: `primary` only or `primary + secondary`.
 * Destructive actions belong inside an overflow menu, never here.
 */
export function BottomCTA({
  primary,
  secondary,
  aboveBottomNav = true,
  mode = "auto",
  className,
}: BottomCTAProps) {
  const isMobile = useIsMobile();
  const renderFixed =
    mode === "fixed" || (mode === "auto" && isMobile);

  if (!renderFixed) {
    return (
      <div
        className={cn(
          "flex items-center justify-end gap-2 pt-4",
          className,
        )}
      >
        {secondary && renderAction(secondary, false)}
        {renderAction(primary, true)}
      </div>
    );
  }

  return (
    <>
      {/* Spacer so content above doesn't sit underneath the fixed bar. */}
      <div aria-hidden="true" className="h-[88px]" />
      <div
        className={cn(
          "fixed inset-x-0 z-shell border-t border-border bg-background/95 backdrop-blur",
          "pl-safe pr-safe pb-safe",
          aboveBottomNav ? "bottom-cta" : "bottom-0",
          className,
        )}
        data-component="bottom-cta"
      >
        <div className="flex items-center gap-2 px-4 py-3">
          {secondary && renderAction(secondary, false)}
          {renderAction(primary, true)}
        </div>
      </div>
    </>
  );
}
