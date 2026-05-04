/**
 * DataTable — tabela premium reutilizável (Linear/Notion).
 *
 * Foco: densidade configurável, header sticky, zebra sutil, hover refinado,
 * suporte a sort, colunas configuráveis, slot de ações por linha.
 *
 * NÃO substitui o shadcn/ui Table — é uma camada de orquestração por cima
 * que padroniza visual e comportamento. Use shadcn Table quando precisar
 * de controle total sobre a marcação (ex: linhas expandidas, células
 * inline complexas como em PainelObras).
 *
 * Densidades:
 *  - compact:     32px linha — máxima densidade operacional
 *  - comfortable: 48px linha — padrão (Notion/Stripe), recomendado
 *  - spacious:    56px linha — leitura prolongada
 *
 * Visibilidade de colunas: controlada externamente via `visibleColumnIds`,
 * permitindo persistência via localStorage no consumidor.
 */
import { Fragment, type KeyboardEvent, type ReactNode, useMemo } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ColumnAlign = "left" | "center" | "right";
export type TableDensity = "compact" | "comfortable" | "spacious";

export interface DataTableColumn<T> {
  /** Identificador único da coluna (usado para visibilidade/sort). */
  id: string;
  /** Cabeçalho visível. Use string para ser indexável ao menu de colunas. */
  header: ReactNode;
  /** Render da célula. Recebe a linha completa. */
  cell: (row: T, rowIndex: number) => ReactNode;
  /** Largura sugerida (CSS). Ex.: '180px', '12rem', 'minmax(160px, 1fr)'. */
  width?: string;
  /** Alinhamento horizontal de header e células. */
  align?: ColumnAlign;
  /** Habilita sort nesta coluna. */
  sortable?: boolean;
  /** Sticky à esquerda (1ª/2ª col em tabelas largas). */
  sticky?: boolean;
  /** Não pode ser ocultada via menu de colunas. */
  required?: boolean;
  /** Label para menu de colunas quando header é JSX. */
  label?: string;
  /** Classes extras na célula. */
  className?: string;
  /** Classes extras no header. */
  headerClassName?: string;
}

export interface SortState {
  columnId: string;
  direction: "asc" | "desc";
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Chave única por linha. */
  rowKey: (row: T, rowIndex: number) => string;
  density?: TableDensity;
  /** IDs de colunas visíveis (em ordem). Quando undefined, todas visíveis. */
  visibleColumnIds?: string[];
  sort?: SortState | null;
  onSortChange?: (next: SortState | null) => void;
  onRowClick?: (row: T, rowIndex: number) => void;
  /** Render extra abaixo da linha (linha expandida). */
  expandedContent?: (row: T, rowIndex: number) => ReactNode;
  /** Render condicional do conteúdo expandido. */
  isRowExpanded?: (row: T, rowIndex: number) => boolean;
  /** Slot de loading e empty fica a cargo do consumidor (use LoadingState/EmptyState). */
  className?: string;
  /** Header sticky no topo do container scrollável. */
  stickyHeader?: boolean;
  /** Aplica zebra striping sutil. */
  zebra?: boolean;
  /** Aria label da tabela. */
  ariaLabel?: string;
}

const densityRow: Record<TableDensity, string> = {
  compact: "h-9",
  comfortable: "h-12",
  spacious: "h-14",
};

const densityCell: Record<TableDensity, string> = {
  compact: "px-3 py-1.5 text-[13px]",
  comfortable: "px-4 py-3 text-sm",
  spacious: "px-5 py-4 text-sm",
};

const densityHeader: Record<TableDensity, string> = {
  compact: "h-8 px-3 text-[11px]",
  comfortable: "h-10 px-4 text-[11px]",
  spacious: "h-11 px-5 text-xs",
};

const alignClass: Record<ColumnAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function DataTable<T>({
  columns,
  data,
  rowKey,
  density = "comfortable",
  visibleColumnIds,
  sort,
  onSortChange,
  onRowClick,
  expandedContent,
  isRowExpanded,
  className,
  stickyHeader = true,
  zebra = false,
  ariaLabel,
}: DataTableProps<T>) {
  const visibleColumns = useMemo(() => {
    if (!visibleColumnIds) return columns;
    const set = new Set(visibleColumnIds);
    // mantém ordem de visibleColumnIds, mas garante required sempre presentes
    const requiredIds = columns.filter((c) => c.required).map((c) => c.id);
    const finalIds = [...new Set([...visibleColumnIds, ...requiredIds])];
    return (
      finalIds
        .map((id) => columns.find((c) => c.id === id))
        .filter((c): c is DataTableColumn<T> => !!c)
        // se id não está no set mas é required, ainda inclui no fim
        .concat(columns.filter((c) => c.required && !set.has(c.id)))
    );
  }, [columns, visibleColumnIds]);

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable || !onSortChange) return;
    if (!sort || sort.columnId !== col.id) {
      onSortChange({ columnId: col.id, direction: "asc" });
    } else if (sort.direction === "asc") {
      onSortChange({ columnId: col.id, direction: "desc" });
    } else {
      onSortChange(null);
    }
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-auto rounded-xl border border-border-subtle bg-surface elevation-xs",
        className,
      )}
    >
      <table
        className="w-full caption-bottom border-collapse"
        aria-label={ariaLabel}
      >
        <thead
          className={cn("surface-sunken", stickyHeader && "sticky top-0 z-10")}
        >
          <tr className="border-b border-border-subtle">
            {visibleColumns.map((col) => {
              const isSorted = sort?.columnId === col.id;
              const Icon = !col.sortable
                ? null
                : !isSorted
                  ? ChevronsUpDown
                  : sort.direction === "asc"
                    ? ChevronUp
                    : ChevronDown;
              return (
                <th
                  key={col.id}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    densityHeader[density],
                    "font-semibold uppercase tracking-[0.06em] text-muted-foreground/90 align-middle whitespace-nowrap",
                    alignClass[col.align ?? "left"],
                    col.sticky && "sticky left-0 z-[11] surface-sunken",
                    col.headerClassName,
                  )}
                  aria-sort={
                    isSorted
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      aria-label={
                        typeof col.header === "string"
                          ? `Ordenar por ${col.header}${
                              isSorted
                                ? sort.direction === "asc"
                                  ? " (crescente)"
                                  : " (decrescente)"
                                : ""
                            }`
                          : undefined
                      }
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-foreground rounded",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        col.align === "right" && "flex-row-reverse",
                      )}
                    >
                      <span>{col.header}</span>
                      {Icon && (
                        <Icon
                          aria-hidden="true"
                          className={cn(
                            "h-3 w-3 shrink-0",
                            isSorted
                              ? "opacity-100 text-foreground"
                              : "opacity-40",
                          )}
                        />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const key = rowKey(row, idx);
            const expanded = isRowExpanded?.(row, idx) ?? false;
            const interactive = !!onRowClick;
            const handleKey = interactive
              ? (e: KeyboardEvent<HTMLTableRowElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick?.(row, idx);
                  }
                }
              : undefined;
            return (
              <Fragment key={key}>
                <tr
                  onClick={
                    interactive ? () => onRowClick?.(row, idx) : undefined
                  }
                  onKeyDown={handleKey}
                  tabIndex={interactive ? 0 : undefined}
                  role={interactive ? "button" : undefined}
                  aria-expanded={expandedContent ? expanded : undefined}
                  className={cn(
                    densityRow[density],
                    "border-b border-border-subtle transition-colors",
                    "last:border-b-0",
                    zebra && idx % 2 === 1 && "bg-surface-sunken/40",
                    interactive &&
                      "cursor-pointer hover:bg-accent/50 focus:outline-none focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  )}
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        densityCell[density],
                        "align-middle text-foreground",
                        alignClass[col.align ?? "left"],
                        col.sticky && "sticky left-0 z-[1] bg-surface",
                        col.className,
                      )}
                    >
                      {col.cell(row, idx)}
                    </td>
                  ))}
                </tr>
                {expanded && expandedContent && (
                  <tr className="border-b border-border-subtle bg-surface-sunken/40">
                    <td colSpan={visibleColumns.length} className="px-0 py-0">
                      {expandedContent(row, idx)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
