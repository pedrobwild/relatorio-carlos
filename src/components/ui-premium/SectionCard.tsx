/**
 * SectionCard — agrupador padrão para conteúdo dentro de uma página.
 *
 * Substitui o uso ad-hoc de <Card> shadcn por uma superfície consistente:
 *  - bg surface
 *  - border subtle
 *  - elevation xs (quase imperceptível)
 *  - radius lg
 *  - header opcional com título, descrição e ações
 *  - padding interno padronizado (p-5 md:p-6)
 *
 * Variantes:
 *  - default: padding interno
 *  - flush:   sem padding (para tabelas que ocupam o card inteiro)
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  flush?: boolean;
}

export function SectionCard({
  title,
  description,
  actions,
  meta,
  children,
  className,
  contentClassName,
  flush = false,
}: SectionCardProps) {
  const hasHeader = title || description || actions || meta;
  return (
    <section
      className={cn(
        "surface-card rounded-xl border border-border-subtle elevation-xs overflow-hidden",
        className,
      )}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 md:px-6 py-4 border-b border-border-subtle">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-[15px] font-semibold text-foreground leading-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-muted-foreground leading-snug mt-1">
                {description}
              </p>
            )}
            {meta && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {meta}
              </div>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
          )}
        </header>
      )}
      <div className={cn(!flush && "p-5 md:p-6", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
