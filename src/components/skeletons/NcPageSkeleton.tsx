import { Skeleton } from "@/components/ui/skeleton";

export function NcPageSkeleton() {
  return (
    <div className="space-y-4 px-1">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      {/* Tab bar */}
      <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
      {/* NC list items */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="space-y-2 p-3 border border-border/40 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
