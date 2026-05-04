/**
 * StatusBadge — badge premium padronizado para status, severidade e tags.
 *
 * Substitui declarações ad-hoc tipo `bg-success/10 text-success border-success/25`
 * espalhadas pelo código. Formato Linear: dot + texto, fundo soft, sem
 * border pesado.
 *
 * Tone reflete a intenção semântica (não a cor literal):
 *  - neutral: estados sem ação (ex: rascunho, indefinido)
 *  - info:    em andamento, aguardando
 *  - success: ok, concluído, em dia
 *  - warning: atenção, atrito
 *  - danger:  bloqueio, atraso, crítico
 *  - muted:   pausado, arquivado
 *
 * Variant:
 *  - soft (default): fundo translúcido, melhor para alta densidade
 *  - solid:          fundo cheio, alto contraste — use 1x por tela
 *  - outline:        só borda, ideal para tabelas densas
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "muted";
export type StatusVariant = "soft" | "solid" | "outline";
export type StatusSize = "sm" | "md";

const dotByTone: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/40",
};

const softByTone: Record<StatusTone, string> = {
  neutral: "bg-muted text-foreground/80",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const solidByTone: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground text-background",
  info: "bg-info text-info-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-destructive text-destructive-foreground",
  muted: "bg-muted text-muted-foreground",
};

const outlineByTone: Record<StatusTone, string> = {
  neutral: "border border-border text-foreground/80",
  info: "border border-info/40 text-info",
  success: "border border-success/40 text-success",
  warning: "border border-warning/40 text-warning",
  danger: "border border-destructive/40 text-destructive",
  muted: "border border-border text-muted-foreground",
};

const sizeClass: Record<StatusSize, string> = {
  sm: "h-5 px-1.5 text-[11px] gap-1",
  md: "h-6 px-2 text-xs gap-1.5",
};

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  variant?: StatusVariant;
  size?: StatusSize;
  showDot?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function StatusBadge({
  children,
  tone = "neutral",
  variant = "soft",
  size = "md",
  showDot = true,
  icon,
  className,
}: StatusBadgeProps) {
  const variantClass =
    variant === "soft"
      ? softByTone[tone]
      : variant === "solid"
        ? solidByTone[tone]
        : outlineByTone[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-medium tabular-nums whitespace-nowrap",
        sizeClass[size],
        variantClass,
        className,
      )}
    >
      {showDot && !icon && (
        <span
          aria-hidden
          className={cn(
            "rounded-full shrink-0",
            size === "sm" ? "h-1 w-1" : "h-1.5 w-1.5",
            dotByTone[tone],
          )}
        />
      )}
      {icon && <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}
