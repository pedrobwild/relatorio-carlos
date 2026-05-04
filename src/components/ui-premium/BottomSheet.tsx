import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface BottomSheetActionItem {
  /** Visible label. */
  label: string;
  /** Optional secondary line. */
  description?: string;
  /** Icon shown to the left. */
  icon?: React.ReactNode;
  /** Click handler. The sheet closes automatically after this resolves. */
  onSelect?: () => void | Promise<void>;
  /** When true the row is rendered as `disabled` (50% opacity, no pointer events). */
  disabled?: boolean;
  /** Tone — `destructive` triggers a red accent. */
  tone?: "default" | "destructive";
  /** Trailing element (badge, chevron, value). */
  trailing?: React.ReactNode;
}

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Quick-list of action rows; for free-form layouts pass `children` instead. */
  actions?: BottomSheetActionItem[];
  children?: React.ReactNode;
  className?: string;
}

/**
 * BottomSheet — slide-up sheet anchored at the bottom of the viewport.
 *
 * Designed as the mobile equivalent of `DropdownMenu` for row actions:
 * - 56px minimum row height (touch-friendly).
 * - Drag handle + slide-down to dismiss (Radix Dialog).
 * - Safe-area-inset-bottom respected.
 * - Destructive items wear a red tone but still go through the same row.
 *
 * For pickers (filter, single selection) prefer `BottomSheetPicker`.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
  children,
  className,
}: BottomSheetProps) {
  const handleSelect = React.useCallback(
    async (action: BottomSheetActionItem) => {
      if (action.disabled) return;
      try {
        await action.onSelect?.();
      } finally {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[88dvh] rounded-t-3xl px-0 pt-7 overflow-y-auto",
          className,
        )}
      >
        <SheetHeader className="px-4 pb-3 border-b border-border-subtle text-left">
          <SheetTitle className="text-base font-bold text-foreground">{title}</SheetTitle>
          <SheetDescription
            className={cn(
              "text-[13px] text-muted-foreground",
              !description && "sr-only",
            )}
          >
            {description ?? title}
          </SheetDescription>
        </SheetHeader>

        {actions && actions.length > 0 && (
          <ul className="py-1">
            {actions.map((action, idx) => (
              <li key={`${action.label}-${idx}`}>
                <SheetClose asChild>
                  <button
                    type="button"
                    onClick={() => handleSelect(action)}
                    disabled={action.disabled}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 min-h-[56px] text-left",
                      "border-b border-border-subtle last:border-b-0",
                      "active:bg-muted transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                      action.tone === "destructive"
                        ? "text-destructive hover:bg-destructive/5 active:bg-destructive/10"
                        : "text-foreground hover:bg-muted/50",
                      action.disabled && "opacity-50 pointer-events-none",
                    )}
                  >
                    {action.icon && (
                      <span className="shrink-0 flex items-center justify-center w-6 h-6">
                        {action.icon}
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium truncate">
                        {action.label}
                      </span>
                      {action.description && (
                        <span className="block text-[12px] text-muted-foreground mt-0.5 line-clamp-2">
                          {action.description}
                        </span>
                      )}
                    </span>
                    {action.trailing && (
                      <span className="shrink-0">{action.trailing}</span>
                    )}
                  </button>
                </SheetClose>
              </li>
            ))}
          </ul>
        )}

        {children && <div className="px-4 py-2">{children}</div>}
      </SheetContent>
    </Sheet>
  );
}
