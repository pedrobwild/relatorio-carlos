import { cn } from "@/lib/utils";

interface ResponsivePageShellProps {
  children: React.ReactNode;
  className?: string;
  /** Max width variant */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  /** Remove default vertical padding */
  noPaddingY?: boolean;
  /** Render a sticky CTA footer (mobile-first, sits above bottom nav) */
  stickyFooter?: React.ReactNode;
}

const maxWidthMap = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-7xl",
};

/**
 * ResponsivePageShell — standard mobile-first page wrapper.
 * - Fixed 16px lateral padding on mobile, scaling up on larger screens
 * - Overflow containment (no horizontal scroll)
 * - Safe-area padding for notched devices
 * - Consistent vertical rhythm
 * - Optional sticky CTA footer positioned above bottom nav
 */
export function ResponsivePageShell({
  children,
  className,
  maxWidth = "lg",
  noPaddingY = false,
  stickyFooter,
}: ResponsivePageShellProps) {
  return (
    <>
      <main
        id="main-content"
        className={cn(
          "mx-auto w-full px-4 sm:px-6 md:px-8",
          "overflow-x-hidden min-w-0",
          maxWidthMap[maxWidth],
          !noPaddingY && "py-4 md:py-8",
          stickyFooter && "pb-20 md:pb-8", // extra room for sticky CTA
          "pb-safe",
          className
        )}
      >
        {children}
      </main>

      {stickyFooter && (
        <div
          className={cn(
            "fixed inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border",
            "px-4 py-3 bottom-cta keyboard-aware",
          )}
        >
          <div className={cn("mx-auto w-full", maxWidthMap[maxWidth])}>
            {stickyFooter}
          </div>
        </div>
      )}
    </>
  );
}
