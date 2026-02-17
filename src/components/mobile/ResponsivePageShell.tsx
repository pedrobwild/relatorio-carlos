import { cn } from "@/lib/utils";

interface ResponsivePageShellProps {
  children: React.ReactNode;
  className?: string;
  /** Max width variant */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  /** Remove default vertical padding */
  noPaddingY?: boolean;
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
 */
export function ResponsivePageShell({
  children,
  className,
  maxWidth = "lg",
  noPaddingY = false,
}: ResponsivePageShellProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full px-4 sm:px-6 md:px-8",
        "overflow-x-hidden min-w-0",
        maxWidthMap[maxWidth],
        !noPaddingY && "py-4 md:py-8",
        "pb-safe",
        className
      )}
    >
      {children}
    </main>
  );
}
