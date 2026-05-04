/**
 * LoadingState — esqueletos padronizados premium.
 *
 * 3 presets prontos:
 *  - table: cabeçalho + N linhas (default 5)
 *  - cards: grade responsiva de cards
 *  - rail:  esqueleto do MetricRail (5 KPIs)
 *
 * Para casos custom, exporta também <SkeletonBlock>.
 */
import { cn } from "@/lib/utils";

interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted/70", className)} />
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 6,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-surface elevation-xs overflow-hidden",
        className,
      )}
    >
      <div className="surface-sunken h-10 border-b border-border-subtle px-4 flex items-center gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 flex-1 max-w-[140px]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="h-12 border-b border-border-subtle last:border-b-0 px-4 flex items-center gap-4"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <SkeletonBlock key={c} className="h-3 flex-1 max-w-[160px]" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface CardsSkeletonProps {
  count?: number;
  className?: string;
}

export function CardsSkeleton({ count = 6, className }: CardsSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border-subtle bg-surface elevation-xs p-5 space-y-3"
        >
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-3 w-1/2" />
          <div className="flex gap-2 pt-2">
            <SkeletonBlock className="h-6 w-16" />
            <SkeletonBlock className="h-6 w-16" />
          </div>
          <SkeletonBlock className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

export function MetricRailSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "surface-card rounded-xl border border-border-subtle elevation-xs overflow-hidden",
        "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
        className,
      )}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="p-5 space-y-2 border-r border-border-subtle last:border-r-0"
        >
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-7 w-12" />
          <SkeletonBlock className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

interface PageSkeletonProps {
  /** Inclui esqueleto de KPI rail (default: true). */
  metrics?: boolean;
  /** Tipo de conteúdo principal. */
  content?: "table" | "cards";
  className?: string;
}

export function PageSkeleton({
  metrics = true,
  content = "table",
  className,
}: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-3 pt-2">
        <SkeletonBlock className="h-8 w-72" />
        <SkeletonBlock className="h-4 w-96" />
      </div>
      {metrics && <MetricRailSkeleton />}
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-9 flex-1 max-w-md" />
        <SkeletonBlock className="h-8 w-24" />
        <SkeletonBlock className="h-8 w-24" />
      </div>
      {content === "table" ? (
        <TableSkeleton rows={6} />
      ) : (
        <CardsSkeleton count={6} />
      )}
    </div>
  );
}
