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
  /** Apply horizontal/vertical breathing room appropriate for mobile (default true) */
  padded?: boolean;
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
 *
 * - 16px lateral padding on mobile, scaling on larger screens.
 * - Overflow containment (no horizontal scroll).
 * - Safe-area padding for notched devices.
 * - Consistent vertical rhythm.
 * - Optional sticky CTA footer positioned above the bottom nav.
 * - When `stickyFooter` is set, content gets bottom padding so the CTA never
 *   overlaps the last row.
 */
export function ResponsivePageShell({
  children,
  className,
  maxWidth = "lg",
  noPaddingY = false,
  stickyFooter,
  padded = true,
}: ResponsivePageShellProps) {
  return (
    <>
      <main
        id="main-content"
        className={cn(
          "mx-auto w-full",
          padded && "px-4 sm:px-6 md:px-8",
          "overflow-x-hidden min-w-0",
          maxWidthMap[maxWidth],
          !noPaddingY && "py-3 md:py-8",
          // Reserve room for sticky CTA so the last row isn't covered
          stickyFooter && "pb-[calc(var(--sticky-cta-height)+24px)] md:pb-8",
          "pb-safe",
          className,
        )}
      >
        {children}
      </main>

      {stickyFooter && (
        <div
          className={cn(
            "fixed inset-x-0 z-shell bg-card/95 backdrop-blur-md border-t border-border",
            "px-4 py-3 bottom-cta keyboard-aware pl-safe pr-safe",
          )}
        >
          <div className={cn("mx-auto w-full", maxWidthMap[maxWidth])}>{stickyFooter}</div>
        </div>
      )}
    </>
  );
}
