import { ReactNode } from "react";
import {
  AlertTriangle,
  RefreshCw,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Generic Empty State ─────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border/50 bg-gradient-to-b from-muted/20 to-transparent p-10 md:p-16 text-center",
        className,
      )}
      role="status"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 border border-primary/10 mb-4">
        <Icon className="h-7 w-7 text-primary/60" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm" className="gap-2">
          {action.icon && <action.icon className="h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ─── Generic Error State ─────────────────────────────────────────────────────

interface ErrorStateProps {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  description?: string;
  className?: string;
}

export function ErrorState({
  error,
  onRetry,
  title,
  description,
  className,
}: ErrorStateProps) {
  const isNetworkError =
    error instanceof Error &&
    (error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("Failed"));

  return (
    <div
      className={cn(
        "rounded-xl border border-destructive/15 bg-destructive/[0.03] p-8 md:p-10 text-center",
        className,
      )}
      role="alert"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/5 border border-destructive/10 mb-4">
        {isNetworkError ? (
          <WifiOff className="h-7 w-7 text-destructive/60" aria-hidden="true" />
        ) : (
          <AlertTriangle
            className="h-7 w-7 text-destructive/60"
            aria-hidden="true"
          />
        )}
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">
        {title ??
          (isNetworkError
            ? "Sem conexão com o servidor"
            : "Erro ao carregar dados")}
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5 leading-relaxed">
        {description ??
          (isNetworkError
            ? "Verifique sua conexão com a internet e tente novamente."
            : "Ocorreu um problema ao carregar os dados. Tente novamente em alguns instantes.")}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

// ─── Generic Page Skeleton ───────────────────────────────────────────────────

interface PageSkeletonProps {
  /** Number of content rows */
  rows?: number;
  /** Show a header skeleton */
  header?: boolean;
  className?: string;
}

export function PageSkeleton({
  rows = 5,
  header = true,
  className,
}: PageSkeletonProps) {
  return (
    <div
      className={cn("space-y-4 animate-in fade-in duration-300", className)}
      aria-busy="true"
    >
      {header && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24 ml-auto" />
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 rounded-lg border border-border/20"
            style={{ opacity: 1 - i * 0.1 }}
          >
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
