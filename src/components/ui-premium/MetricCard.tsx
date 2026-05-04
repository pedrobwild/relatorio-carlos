/**
 * MetricCard / MetricRail — KPIs premium para cockpit operacional.
 *
 * MetricCard: superfície limpa com label + valor grande tabular + delta
 * opcional. Estética Stripe Dashboard (sem ícones coloridos competindo).
 * Variantes só por accent — peso vem da cor do valor, não do fundo.
 *
 * MetricRail: container responsivo que organiza N cards em linha,
 * com divisão sutil entre eles em vez de border de cada card. Reduz ruído.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MetricAccent =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

const accentText: Record<MetricAccent, string> = {
  default: "text-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

const accentDot: Record<MetricAccent, string> = {
  default: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
};

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  hint?: ReactNode;
  accent?: MetricAccent;
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  delta,
  hint,
  accent = "default",
  className,
  onClick,
}: MetricCardProps) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 p-4 md:p-5 text-left min-w-0",
        onClick &&
          "transition-colors hover:bg-accent/40 focus:outline-none focus-visible:bg-accent/50 ring-premium",
        className,
      )}
    >
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", accentDot[accent])}
        />
        {label}
      </span>
      <span
        className={cn(
          "text-[28px] md:text-[32px] font-semibold tabular-nums leading-none tracking-tight",
          accentText[accent],
        )}
      >
        {value}
      </span>
      {(delta || hint) && (
        <span className="text-xs text-muted-foreground leading-snug mt-0.5">
          {delta}
          {delta && hint && <span className="mx-1.5 opacity-40">•</span>}
          {hint}
        </span>
      )}
    </Component>
  );
}

interface MetricRailProps {
  children: ReactNode;
  className?: string;
}

/**
 * Container premium para uma fileira de KPIs.
 * Visual: 1 card grande dividido por linhas verticais — não N cards soltos.
 * Inspirado em Stripe Dashboard.
 */
export function MetricRail({ children, className }: MetricRailProps) {
  return (
    <div
      className={cn(
        "surface-card rounded-xl border border-border-subtle elevation-xs overflow-hidden",
        "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
        "[&>*]:border-b [&>*]:border-border-subtle md:[&>*]:border-b-0",
        "[&>*]:border-r [&>*]:border-border-subtle",
        "[&>*:nth-child(2n)]:border-r-0 md:[&>*:nth-child(2n)]:border-r",
        "md:[&>*:nth-child(3n)]:border-r-0 lg:[&>*:nth-child(3n)]:border-r",
        "lg:[&>*:nth-child(5n)]:border-r-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
