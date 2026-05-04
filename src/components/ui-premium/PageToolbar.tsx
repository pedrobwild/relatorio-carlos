/**
 * PageToolbar — barra horizontal sticky para busca, filtros e ações de lista.
 *
 * Padrão: busca à esquerda (cresce), filtros principais ao centro,
 * ações secundárias / contador à direita. Sem borda dupla — encosta
 * diretamente no PageHeader (via flush) ou em conteúdo.
 *
 * Sticky por padrão (top: var(--header-height)) para que filtros sigam o
 * scroll em listas longas — comportamento Linear/Notion.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageToolbarProps {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
  sticky?: boolean;
}

export function PageToolbar({
  search,
  filters,
  actions,
  meta,
  className,
  sticky = true,
}: PageToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 py-3 border-b border-border-subtle",
        sticky &&
          "sticky top-0 z-30 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 surface-glass",
        className,
      )}
    >
      {search && <div className="flex-1 min-w-[220px] max-w-md">{search}</div>}
      {filters && (
        <div className="flex items-center gap-1.5 flex-wrap">{filters}</div>
      )}
      {(meta || actions) && (
        <div className="flex items-center gap-2 ml-auto">
          {meta}
          {actions}
        </div>
      )}
    </div>
  );
}
