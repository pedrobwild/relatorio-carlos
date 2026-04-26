/**
 * Tabela densa do Painel — header sticky, ordenação, checkbox de seleção em massa,
 * empty/loading state.
 */
import { ChevronDown, Table2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard } from '@/components/ui-premium';
import { EmptyState } from '@/components/ui/states';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  PainelObra,
  PainelObraPatch,
} from '@/hooks/usePainelObras';
import { PainelObraRow } from './PainelObraRow';
import type { SortKey, SortDirection } from './types';

interface PainelTableProps {
  isLoading: boolean;
  rows: PainelObra[];
  totalRows: number;
  sortKey: SortKey;
  sortDir: SortDirection;
  onToggleSort: (key: NonNullable<SortKey>) => void;

  selection: {
    has: (id: string) => boolean;
    toggle: (id: string) => void;
    toggleAll: () => void;
    allSelected: boolean;
  };
  onUpdateRow: (id: string, patch: PainelObraPatch) => void;
  onOpenDetail: (obra: PainelObra) => void;
  onOpenObra: (obraId: string) => void;
  onDeleteRequest: (obra: PainelObra) => void;
}

export function PainelTable({
  isLoading,
  rows,
  totalRows,
  sortKey,
  sortDir,
  onToggleSort,
  selection,
  onUpdateRow,
  onOpenDetail,
  onOpenObra,
  onDeleteRequest,
}: PainelTableProps) {
  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  if (rows.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          icon={Table2}
          title={totalRows === 0 ? 'Nenhuma obra cadastrada' : 'Nenhum resultado'}
          description={
            totalRows === 0
              ? 'Crie uma nova obra a partir do botão acima.'
              : 'Tente ajustar ou limpar os filtros.'
          }
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard flush>
      <div className="overflow-x-auto">
        <Table className="text-sm [&_th]:h-11 [&_td]:py-3 [&_td]:px-3 [&_th]:px-3 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:text-muted-foreground [&_th]:bg-surface-sunken [&_th]:uppercase [&_th]:tracking-[0.04em] [&_tr]:border-border-subtle">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border-subtle">
              <TableHead className="w-10 sticky left-0 z-20 bg-surface-sunken">
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={selection.allSelected}
                    onCheckedChange={selection.toggleAll}
                    aria-label="Selecionar todas as obras visíveis"
                  />
                </div>
              </TableHead>
              <TableHead className="min-w-[260px] sticky left-10 z-20 bg-surface-sunken border-r border-border-subtle">
                Cliente / Obra
              </TableHead>
              <TableHead className="min-w-[130px]">Status</TableHead>
              <TableHead className="min-w-[150px]">Etapa</TableHead>
              <TableHead className="min-w-[130px]">Responsável</TableHead>
              <TableHead className="min-w-[110px] text-right">Progresso</TableHead>
              <TableHead className="min-w-[110px]">
                <SortableHeader
                  label="Início Of."
                  sortKey="inicio_oficial"
                  active={sortKey === 'inicio_oficial'}
                  dir={sortDir}
                  onClick={() => onToggleSort('inicio_oficial')}
                />
              </TableHead>
              <TableHead className="min-w-[110px]">
                <SortableHeader
                  label="Entrega Of."
                  sortKey="entrega_oficial"
                  active={sortKey === 'entrega_oficial'}
                  dir={sortDir}
                  onClick={() => onToggleSort('entrega_oficial')}
                />
              </TableHead>
              <TableHead className="min-w-[110px]">
                <SortableHeader
                  label="Início Real"
                  sortKey="inicio_real"
                  active={sortKey === 'inicio_real'}
                  dir={sortDir}
                  onClick={() => onToggleSort('inicio_real')}
                />
              </TableHead>
              <TableHead className="min-w-[110px]">
                <SortableHeader
                  label="Entrega Real"
                  sortKey="entrega_real"
                  active={sortKey === 'entrega_real'}
                  dir={sortDir}
                  onClick={() => onToggleSort('entrega_real')}
                />
              </TableHead>
              <TableHead className="min-w-[140px]">Relacionamento</TableHead>
              <TableHead className="min-w-[150px]">Orçamento público</TableHead>
              <TableHead className="min-w-[110px]">
                <SortableHeader
                  label="Atualizado"
                  sortKey="ultima_atualizacao"
                  active={sortKey === 'ultima_atualizacao'}
                  dir={sortDir}
                  onClick={() => onToggleSort('ultima_atualizacao')}
                />
              </TableHead>
              <TableHead className="w-16 sticky right-0 bg-surface-sunken border-l border-border-subtle" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o) => (
              <PainelObraRow
                key={o.id}
                obra={o}
                isSelected={selection.has(o.id)}
                onToggleSelected={() => selection.toggle(o.id)}
                onUpdate={(patch) => onUpdateRow(o.id, patch)}
                onOpenDetail={() => onOpenDetail(o)}
                onOpenObra={() => onOpenObra(o.id)}
                onDeleteRequest={() => onDeleteRequest(o)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

interface SortableHeaderProps {
  label: string;
  sortKey: NonNullable<SortKey>;
  active: boolean;
  dir: SortDirection;
  onClick: () => void;
}

function SortableHeader({ label, active, dir, onClick }: SortableHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 hover:text-foreground transition-colors uppercase tracking-wide"
    >
      {label}
      {active ? (
        <span className="text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>
      ) : (
        <ChevronDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  );
}
