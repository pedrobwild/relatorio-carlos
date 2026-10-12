/**
 * Board do Painel de Obras: a mesma lista, agrupada por etapa.
 * Cada grupo recolhe/expande; o conteúdo é a tabela (ou os cartões) de sempre.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/** Um grupo do board: etapa do Painel (em execução) ou etapa da fase de projeto. */
export interface BoardGroup<T> {
  key: string;
  label: string;
  items: T[];
}

interface Props<T> {
  groups: readonly BoardGroup<T>[];
  /** Conteúdo do grupo. `first` = primeiro grupo aberto (mostra o cabeçalho da tabela). */
  renderGroup: (items: T[], first: boolean) => ReactNode;
  /** Resumo curto ao lado da contagem (ex.: "2 no vermelho"). */
  summary?: (items: T[]) => string | null;
}

export function EtapaBoard<T>({ groups, renderGroup, summary }: Props<T>) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const visible = groups.filter((g) => g.items.length > 0);
  const firstOpen = visible.find((g) => !collapsed.has(g.key))?.key;

  return (
    <div className="space-y-4">
      {visible.map((g, index) => {
        const open = !collapsed.has(g.key);
        const extra = summary?.(g.items) ?? null;
        // Índice, não o nome da etapa: id não pode ter espaço ("Vistoria reprovada").
        const panelId = `etapa-grupo-${index}`;
        return (
          <section key={g.key} aria-label={g.label}>
            <h2>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => toggle(g.key)}
                className="flex min-h-[40px] w-full items-center gap-2 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-foreground">{g.label}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{g.items.length}</span>
                {extra && <span className="text-sm font-medium text-destructive">· {extra}</span>}
              </button>
            </h2>
            {open && (
              <div id={panelId} className="mt-1">
                {renderGroup(g.items, g.key === firstOpen)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
