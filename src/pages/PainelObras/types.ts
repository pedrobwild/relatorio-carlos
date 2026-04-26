/**
 * Helpers, formatters e constantes compartilhados pela página Painel de Obras.
 *
 * Mantém todo o "look-and-feel" das células (cores, dots, classes) num único
 * lugar — qualquer ajuste de design system bate aqui sem espalhar pelas
 * sub-views.
 */
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PainelObra, PainelStatus, PainelRelacionamento } from '@/hooks/usePainelObras';

export const ALL = '__all__';
export const NONE = '__none__';

export const PAINEL_COLUMN_COUNT = 14; // checkbox + 13 colunas conteúdo

export type SortKey =
  | 'inicio_oficial'
  | 'entrega_oficial'
  | 'inicio_real'
  | 'entrega_real'
  | 'ultima_atualizacao'
  | null;

export type SortDirection = 'asc' | 'desc';

export const fmtDate = (iso: string | null) =>
  iso ? format(parseISO(iso), 'dd/MM/yy', { locale: ptBR }) : '—';

export const fmtDateTime = (iso: string) =>
  format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

export const toIsoDate = (d: Date | undefined) =>
  d ? format(d, 'yyyy-MM-dd') : null;

/**
 * Status efetivo: aplica regra "atraso automático" (entrega oficial vencida
 * sem entrega real). Não persiste — só direciona a visualização.
 */
export const computeDisplayStatus = (obra: {
  status: PainelStatus | null;
  entrega_oficial: string | null;
  entrega_real: string | null;
}): PainelStatus | null => {
  const { status, entrega_oficial, entrega_real } = obra;
  if (!entrega_oficial || entrega_real) return status;
  const hojeIso = format(new Date(), 'yyyy-MM-dd');
  if (entrega_oficial < hojeIso) return 'Atrasado';
  return status;
};

export const statusDotClass = (s: PainelStatus | null): string => {
  switch (s) {
    case 'Aguardando': return 'bg-info';
    case 'Em dia':     return 'bg-success';
    case 'Atrasado':   return 'bg-destructive';
    case 'Paralisada': return 'bg-muted-foreground';
    default:           return 'bg-muted';
  }
};

export const statusPillClass = (s: PainelStatus | null): string => {
  switch (s) {
    case 'Aguardando': return 'bg-info/10 text-info border border-info/25';
    case 'Em dia':     return 'bg-success/10 text-success border border-success/25';
    case 'Atrasado':   return 'bg-destructive/10 text-destructive border border-destructive/25';
    case 'Paralisada': return 'bg-muted text-muted-foreground border border-border';
    default:           return 'bg-muted/40 text-muted-foreground border border-dashed border-border';
  }
};

export const relacionamentoPillClass = (r: PainelRelacionamento | null): string => {
  switch (r) {
    case 'Normal':       return 'bg-success/10 text-success border border-success/25';
    case 'Atrito':       return 'bg-warning/10 text-warning border border-warning/25';
    case 'Insatisfeito': return 'bg-warning/15 text-warning border border-warning/30';
    case 'Crítico':      return 'bg-destructive/10 text-destructive border border-destructive/25';
    default:             return 'bg-muted/40 text-muted-foreground border border-dashed border-border';
  }
};

export const editableCell =
  'group/cell w-full h-full text-left px-2 py-1 rounded-md text-sm transition-colors ' +
  'hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/* ─────────────── Filter / view state ─────────────── */

export interface PainelFilterState {
  search: string;
  filterEtapa: string;
  filterStatus: string;
  filterRelacionamento: string;
  sortKey: SortKey;
  sortDir: SortDirection;
}

export const EMPTY_FILTERS: PainelFilterState = {
  search: '',
  filterEtapa: ALL,
  filterStatus: ALL,
  filterRelacionamento: ALL,
  sortKey: null,
  sortDir: 'asc',
};

export interface SavedView {
  /** Identificador estável (slug) — usado em URL e como key no map. */
  id: string;
  name: string;
  filters: PainelFilterState;
  /** Reservado pra futuro (ocultar/mostrar colunas). */
  columns?: string[];
  /** True para presets internos (não removíveis). */
  builtin?: boolean;
}

/* ─────────────── Predicados de presets ─────────────── */

export function isThisMonth(iso: string | null): boolean {
  if (!iso) return false;
  const target = parseISO(iso);
  const now = new Date();
  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth()
  );
}

/** "Críticas": atrasadas ou com relacionamento Crítico. */
export function isCritical(obra: PainelObra): boolean {
  const display = computeDisplayStatus(obra);
  return display === 'Atrasado' || obra.relacionamento === 'Crítico';
}
