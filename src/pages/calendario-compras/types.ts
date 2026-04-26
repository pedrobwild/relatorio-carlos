/**
 * Tipos e formatters compartilhados pela página Calendário de Compras.
 */
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, ThumbsUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ProjectPurchase } from '@/hooks/useProjectPurchases';
import type { TablesInsert } from '@/integrations/supabase/types';

/**
 * Payload tipado para INSERT em `project_purchases`.
 * Deriva do schema gerado pelo Supabase.
 */
export type ProjectPurchaseInsert = TablesInsert<'project_purchases'>;

export interface PurchaseWithProject extends Omit<ProjectPurchase, 'created_at'> {
  project_name: string;
  payment_due_date?: string | null;
  /** Defensivo: registros antigos podem chegar sem o campo. */
  created_at?: string | null;
}

export type CalendarStatus = 'pending' | 'approved' | 'delivered' | 'delayed';

export const calendarStatusConfig: Record<
  CalendarStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pendente',
    color:
      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
    icon: Clock,
  },
  approved: {
    label: 'Aprovado',
    color:
      'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40',
    icon: ThumbsUp,
  },
  delivered: {
    label: 'Entregue',
    color:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40',
    icon: CheckCircle2,
  },
  delayed: {
    label: 'Atrasado',
    color:
      'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40',
    icon: AlertTriangle,
  },
};

export const CALENDAR_STATUS_OPTIONS: CalendarStatus[] = [
  'pending',
  'approved',
  'delivered',
  'delayed',
];

export function toCalendarStatus(s: string | null | undefined): CalendarStatus {
  if (
    s === 'approved' ||
    s === 'awaiting_approval' ||
    s === 'purchased' ||
    s === 'ordered' ||
    s === 'in_transit'
  )
    return 'approved';
  if (s === 'delivered' || s === 'sent_to_site') return 'delivered';
  if (s === 'delayed') return 'delayed';
  return 'pending';
}

export const fmtCompact = (v: number | null) =>
  v != null
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—';

export const fmt = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export const fmtDiff = (v: number) => {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const abs = Math.abs(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
  return `${sign}${abs}`;
};

/**
 * Formata `created_at` (ISO UTC) como `dd/MM/yyyy` no fuso local.
 * Retorna "—" para inválidos.
 */
export const fmtRequestedDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return '—';
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
};
