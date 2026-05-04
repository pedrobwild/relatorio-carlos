import { Skeleton } from "@/components/ui/skeleton";

export function AtividadesPageSkeleton() {
  return (
    <div className="space-y-4 px-1">
      {/* Filters bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>
      {/* Task list */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 border border-border/40 rounded-lg"
        >
          <Skeleton className="h-5 w-5 rounded shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
          <Skeleton className="h-6 w-6 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}
