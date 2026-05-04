import { Skeleton } from "@/components/ui/skeleton";

export function VistoriasPageSkeleton() {
  return (
    <div className="space-y-4 px-1">
      {/* Search + action bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      {/* Inspection cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="p-4 border border-border/40 rounded-lg space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          {/* Progress bar */}
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
