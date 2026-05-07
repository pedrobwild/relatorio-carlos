import {
  Building2,
  Plus,
  SearchX,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── KPI Strip Skeleton ──────────────────────────────────────────────────────

export function KpiStripSkeleton() {
  return (
    <div
      className="flex gap-2 overflow-hidden pb-1 -mx-4 px-4 lg:mx-0 lg:px-0"
      aria-busy="true"
      aria-label="Carregando KPIs"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 shrink-0 rounded-xl border border-border/30 bg-card px-4 py-3 min-w-[150px] max-w-[190px]"
        >
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar Skeleton ────────────────────────────────────────────────────────

export function SidebarSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="Carregando painel lateral"
    >
      {/* Inbox skeleton */}
      <div className="rounded-xl border border-border/40 bg-card">
        <div className="p-3 border-b border-border/30 flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-5 rounded-full ml-auto" />
        </div>
        <div className="p-2 space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg">
              <Skeleton className="h-7 w-7 rounded-lg shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights skeleton */}
      <div className="rounded-xl border border-border/40 bg-card">
        <div className="p-3 border-b border-border/30 flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="p-3 space-y-3">
          <Skeleton className="h-4 w-full rounded-full" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-14" />
            ))}
          </div>
          <div className="space-y-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Grid Skeleton (table rows) ──────────────────────────────────────────────

export function GridSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="space-y-1"
      aria-busy="true"
      aria-label="Carregando lista de obras"
    >
      {/* Header row */}
      <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-muted/30">
        <Skeleton className="h-4 w-4 rounded shrink-0" />
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3.5 w-24 hidden sm:block" />
        <Skeleton className="h-3.5 w-20 hidden md:block" />
        <Skeleton className="h-3.5 w-16 ml-auto" />
        <Skeleton className="h-5 w-16 rounded-full hidden lg:block" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border/20"
          style={{ opacity: 1 - i * 0.08 }}
        >
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-44 max-w-[60%]" />
            <Skeleton className="h-3 w-28 max-w-[40%]" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full hidden sm:block" />
          <Skeleton className="h-4 w-12 hidden md:block" />
          <Skeleton className="h-7 w-7 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Command Bar Skeleton ────────────────────────────────────────────────────

export function CommandBarSkeleton() {
  return (
    <div className="flex items-center gap-3 flex-wrap" aria-busy="true">
      <Skeleton className="h-9 w-64 rounded-lg" />
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="ml-auto flex gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Full Page Loading ───────────────────────────────────────────────────────

export function PortfolioPageSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <CommandBarSkeleton />
      <KpiStripSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="order-2 lg:order-1">
          <SidebarSkeleton />
        </div>
        <div className="order-1 lg:order-2">
          <GridSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}

// ─── Empty State: Zero Projects ──────────────────────────────────────────────

interface EmptyPortfolioProps {
  onCreateProject: () => void;
}

export function EmptyPortfolio({ onCreateProject }: EmptyPortfolioProps) {
  return (
    <div
      className="rounded-xl border border-dashed border-border/50 bg-gradient-to-b from-muted/20 to-transparent p-16 text-center"
      role="status"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 border border-primary/10 mb-5">
        <Building2 className="h-8 w-8 text-primary/60" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">
        Nenhuma obra cadastrada
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
        Crie sua primeira obra para começar a gerenciar cronogramas, pendências,
        documentos e toda a jornada do cliente em um só lugar.
      </p>
      <Button onClick={onCreateProject} className="gap-2">
        <Plus className="h-4 w-4" />
        Criar primeira obra
      </Button>
    </div>
  );
}

// ─── Empty State: No Filter Results ──────────────────────────────────────────

interface NoFilterResultsProps {
  onClearFilters: () => void;
  activeFilterCount: number;
}

export function NoFilterResults({
  onClearFilters,
  activeFilterCount,
}: NoFilterResultsProps) {
  return (
    <div
      className="rounded-xl border border-dashed border-border/50 bg-muted/5 p-12 text-center"
      role="status"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/5 border border-amber-500/10 mb-4">
        <SearchX className="h-7 w-7 text-amber-500/60" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">
        Nenhuma obra encontrada
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5 leading-relaxed">
        {activeFilterCount > 1
          ? `Os ${activeFilterCount} filtros ativos não retornaram resultados. Ajuste os critérios ou limpe os filtros.`
          : "O filtro aplicado não retornou resultados. Ajuste o critério ou limpe o filtro."}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onClearFilters}
        className="gap-2"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Limpar todos os filtros
      </Button>
    </div>
  );
}

// ─── Error State with Retry ──────────────────────────────────────────────────

interface ErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

export function PortfolioErrorState({ error, onRetry }: ErrorStateProps) {
  const isNetworkError =
    error instanceof Error &&
    (error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("Failed"));

  return (
    <div
      className="rounded-xl border border-destructive/15 bg-destructive/[0.03] p-10 text-center"
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
        {isNetworkError
          ? "Sem conexão com o servidor"
          : "Erro ao carregar obras"}
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5 leading-relaxed">
        {isNetworkError
          ? "Verifique sua conexão com a internet e tente novamente."
          : "Ocorreu um problema ao carregar os dados. Tente novamente em alguns instantes."}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" />
        Tentar novamente
      </Button>
    </div>
  );
}

// ─── Stale Data Banner ───────────────────────────────────────────────────────

interface StaleDataBannerProps {
  onRefresh: () => void;
  isRefetching?: boolean;
}

export function StaleDataBanner({
  onRefresh,
  isRefetching,
}: StaleDataBannerProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-4 py-2 text-xs text-amber-700">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">Os dados podem estar desatualizados.</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={isRefetching}
        className="h-6 px-2 text-xs gap-1.5 text-amber-700 hover:text-amber-800"
      >
        <RefreshCw className={cn("h-3 w-3", isRefetching && "animate-spin")} />
        {isRefetching ? "Atualizando…" : "Atualizar"}
      </Button>
    </div>
  );
}

// ─── Partial Error Banner (sidebar failed but grid loaded) ───────────────────

interface PartialErrorBannerProps {
  section: string;
  onRetry?: () => void;
}

export function PartialErrorBanner({
  section,
  onRetry,
}: PartialErrorBannerProps) {
  return (
    <div className="rounded-lg border border-destructive/10 bg-destructive/[0.03] p-3 text-center">
      <p className="text-xs text-muted-foreground">
        Não foi possível carregar{" "}
        <span className="font-medium text-foreground">{section}</span>.
      </p>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="mt-1.5 h-6 px-2 text-xs gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
