import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface BottomSheetPickerProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Sheet title */
  title: string;
  /** Optional description for accessibility */
  description?: string;
  /** Sheet content */
  children: React.ReactNode;
  /** Additional className for content */
  className?: string;
}

/**
 * BottomSheetPicker — reusable bottom sheet for mobile selections.
 * Used for filters, timeline navigation, option picking.
 * Slides up from bottom with max height 85dvh.
 */
export function BottomSheetPicker({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: BottomSheetPickerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[88dvh] rounded-t-3xl px-4 pt-7 pb-safe overflow-y-auto",
          className,
        )}
      >
        <SheetHeader className="pb-3 border-b border-border-subtle mb-3 text-left">
          <SheetTitle className="text-base font-bold text-foreground">
            {title}
          </SheetTitle>
          {description && (
            <SheetDescription className="text-[13px] text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="min-w-0">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
