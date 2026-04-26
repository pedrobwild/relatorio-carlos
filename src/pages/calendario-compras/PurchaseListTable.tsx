/**
 * Tabela densa que renderiza tanto "Compras Agendadas" quanto "Sem Data
 * Definida" — ambas compartilham a mesma estrutura de linhas (item, custo,
 * pagamento, status) variando apenas a presença da coluna "Data Compra".
 *
 * Quem persiste mutations é o consumidor: passamos os 3 callbacks de
 * `onUpdateActualCost`, `onUpdateDateField` e `onUpdateStatus`.
 */
import { Fragment } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ActualCostCell, DateCell, PurchaseRowDetail, StatusCell } from './cells';
import {
  type CalendarStatus,
  type PurchaseWithProject,
  fmtCompact,
  fmtDiff,
  fmtRequestedDate,
} from './types';

interface PurchaseListTableProps {
  title: string;
  titleMuted?: boolean;
  rows: PurchaseWithProject[];
  /** Quando `false`, oculta a coluna "Data Compra" (caso "Sem Data Definida"). */
  withPlannedDate?: boolean;
  expandedRows: Set<string>;
  toggleRow: (id: string) => void;
  requestedSort: 'asc' | 'desc' | null;
  toggleRequestedSort: () => void;
  onUpdateActualCost: (id: string, value: number | null) => void;
  onUpdateDateField: (id: string, field: 'planned_purchase_date' | 'payment_due_date', value: string | null) => void;
  onUpdateStatus: (id: string, value: CalendarStatus) => void;
  /** Mostrado quando lista vazia. Default: "Nenhuma compra agendada encontrada". */
  emptyMessage?: string;
  /** Frase auxiliar opcional no header (ex.: "Clique em ▸ para ver detalhes"). */
  hint?: string;
}

const REQUESTED_HEADER_LABEL = 'Solicitada em';

export function PurchaseListTable({
  title,
  titleMuted,
  rows,
  withPlannedDate = true,
  expandedRows,
  toggleRow,
  requestedSort,
  toggleRequestedSort,
  onUpdateActualCost,
  onUpdateDateField,
  onUpdateStatus,
  emptyMessage = 'Nenhuma compra agendada encontrada',
  hint,
}: PurchaseListTableProps) {
  const colSpan = withPlannedDate ? 10 : 9;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={cn('text-base', titleMuted && 'text-muted-foreground')}>
            {title}{' '}
            <span className="text-muted-foreground font-normal text-sm">({rows.length})</span>
          </CardTitle>
          {hint && <p className="text-xs text-muted-foreground hidden sm:block">{hint}</p>}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table className="text-xs [&_th]:px-3 [&_td]:px-3 [&_th]:h-9 [&_td]:py-2">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-8" />
              {withPlannedDate && <TableHead className="whitespace-nowrap">Data Compra</TableHead>}
              <TableHead className="whitespace-nowrap">Obra</TableHead>
              <TableHead className="whitespace-nowrap">Item</TableHead>
              <TableHead className="whitespace-nowrap p-0">
                <button
                  type="button"
                  onClick={toggleRequestedSort}
                  aria-label={`Ordenar por solicitada em${requestedSort ? ` (${requestedSort === 'asc' ? 'ascendente' : 'descendente'})` : ''}`}
                  aria-sort={
                    requestedSort === 'asc'
                      ? 'ascending'
                      : requestedSort === 'desc'
                        ? 'descending'
                        : 'none'
                  }
                  className={cn(
                    'flex h-9 w-full items-center gap-1 px-3 text-left font-medium whitespace-nowrap',
                    'hover:bg-muted/60 hover:text-foreground transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    requestedSort && 'text-foreground bg-muted/40',
                  )}
                >
                  {REQUESTED_HEADER_LABEL}
                  {requestedSort === 'asc' && <ChevronUp className="h-3.5 w-3.5 text-primary" aria-hidden />}
                  {requestedSort === 'desc' && <ChevronDown className="h-3.5 w-3.5 text-primary" aria-hidden />}
                  {requestedSort === null && <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />}
                </button>
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">Previsto</TableHead>
              <TableHead className="whitespace-nowrap text-right">Real</TableHead>
              <TableHead className="whitespace-nowrap text-right">Dif.</TableHead>
              <TableHead className="whitespace-nowrap">Pagamento</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const hasBoth = p.estimated_cost != null && p.actual_cost != null;
              const diff = hasBoth ? p.estimated_cost! - p.actual_cost! : null;
              const expanded = expandedRows.has(p.id);
              const hasDetails = !!(
                p.description ||
                p.quantity ||
                p.delivery_address ||
                p.notes ||
                p.category ||
                p.supplier_name
              );
              return (
                <Fragment key={p.id}>
                  <TableRow className={cn('hover:bg-muted/30 transition-colors', expanded && 'bg-muted/20')}>
                    <TableCell className="w-8 text-center">
                      {hasDetails ? (
                        <button
                          type="button"
                          onClick={() => toggleRow(p.id)}
                          className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <span className="inline-block w-5" />
                      )}
                    </TableCell>

                    {withPlannedDate && (
                      <TableCell className="font-medium whitespace-nowrap">
                        <DateCell
                          value={p.planned_purchase_date}
                          onSave={(v) => onUpdateDateField(p.id, 'planned_purchase_date', v)}
                        />
                      </TableCell>
                    )}

                    <TableCell className="whitespace-nowrap max-w-[160px]">
                      <Badge variant="outline" className="text-[10px] truncate max-w-full inline-block font-normal">
                        {p.project_name}
                      </Badge>
                    </TableCell>

                    <TableCell className="max-w-[200px]">
                      <p className="font-medium truncate" title={p.item_name}>{p.item_name}</p>
                    </TableCell>

                    <TableCell className={cn(
                      'text-muted-foreground whitespace-nowrap text-xs tabular-nums',
                      !p.created_at && 'italic',
                    )}>
                      {fmtRequestedDate(p.created_at)}
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtCompact(p.estimated_cost)}</TableCell>

                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      <ActualCostCell purchase={p} onSave={onUpdateActualCost} />
                    </TableCell>

                    <TableCell className={cn(
                      'text-right whitespace-nowrap tabular-nums font-medium',
                      diff == null && 'text-muted-foreground',
                      diff != null && diff >= 0 && 'text-emerald-600',
                      diff != null && diff < 0 && 'text-red-600',
                    )}>
                      {diff == null ? '—' : fmtDiff(diff)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      <DateCell
                        value={p.payment_due_date}
                        onSave={(v) => onUpdateDateField(p.id, 'payment_due_date', v)}
                      />
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      <StatusCell purchase={p} onSave={onUpdateStatus} />
                    </TableCell>
                  </TableRow>

                  {expanded && hasDetails && (
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableCell colSpan={colSpan} className="p-0">
                        <PurchaseRowDetail p={p} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
