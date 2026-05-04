import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ContentSkeletonProps {
  variant?: "chart" | "table" | "cards" | "list" | "report" | "gantt";
  className?: string;
  rows?: number;
}

/**
 * Consistent skeleton loading states for different content types.
 * Reserves height to prevent layout shift.
 */
export function ContentSkeleton({
  variant = "list",
  className,
  rows = 5,
}: ContentSkeletonProps) {
  switch (variant) {
    case "chart":
      return (
        <div className={cn("space-y-4", className)}>
          {/* Chart header */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
          {/* Chart area - reserve 300px height */}
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
      );

    case "gantt":
      return (
        <div className={cn("space-y-3", className)}>
          {/* Gantt header */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 rounded-t-lg">
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
            </div>
          </div>
          {/* Gantt rows */}
          <div className="space-y-2 p-4">
            {Array.from({ length: Math.min(rows, 8) }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32 shrink-0" />
                <Skeleton
                  className="h-6 rounded"
                  style={{ width: `${30 + Math.random() * 50}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      );

    case "table":
      return (
        <div className={cn("space-y-3", className)}>
          {/* Table header */}
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-5 w-24" />
          </div>
          {/* Table rows */}
          <div className="border rounded-xl overflow-hidden">
            <div className="bg-primary/10 p-3">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="p-3 border-t border-border/50">
                <div className="flex gap-4 items-center">
                  <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                  <Skeleton className="h-4 flex-1 max-w-48" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "cards":
      return (
        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
            className,
          )}
        >
          {Array.from({ length: Math.min(rows, 6) }).map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      );

    case "report":
      return (
        <div className={cn("space-y-6", className)}>
          {/* Report header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          {/* Report content sections */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      );

    case "list":
    default:
      return (
        <div className={cn("space-y-3", className)}>
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      );
  }
}

/**
 * Full-page loading state with centered spinner
 */
export function PageSkeleton({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

/**
 * Skeleton for tab content - maintains layout stability
 */
export function TabContentSkeleton({
  variant = "chart",
}: {
  variant?: "chart" | "table" | "report";
}) {
  return (
    <div className="min-h-[400px] animate-pulse">
      <ContentSkeleton variant={variant} />
      {variant === "chart" && (
        <div className="mt-4">
          <ContentSkeleton variant="table" rows={5} />
        </div>
      )}
    </div>
  );
}
