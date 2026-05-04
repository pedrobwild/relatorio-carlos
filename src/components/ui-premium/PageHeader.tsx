/**
 * PageHeader — cabeçalho premium reutilizável para páginas internas.
 *
 * Padrão Linear/Stripe: título dominante, subtítulo discreto, eyebrow para
 * categoria/breadcrumb, slot de ações primárias top-right, slot de meta
 * (badges, contadores) abaixo do título.
 *
 * Hierarquia:
 *  - eyebrow (caption maiúsculo, opcional) → contexto
 *  - title (h1, dominante)                  → o que é
 *  - description (body, 1 linha)            → por quê
 *  - meta (badges/contadores)               → estado atual
 *  - actions                                → o que fazer
 *
 * Acessibilidade: title é sempre <h1>, ações têm aria-label exigida.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Quando true, remove a borda inferior (use quando vier toolbar logo abaixo). */
  flush?: boolean;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
  flush = false,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 pt-6 pb-5 md:pt-8 md:pb-6",
        !flush && "border-b border-border-subtle",
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          {eyebrow && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {eyebrow}
            </span>
          )}
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
          {meta && (
            <div className="flex flex-wrap items-center gap-2 mt-1">{meta}</div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 md:pt-0.5">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
