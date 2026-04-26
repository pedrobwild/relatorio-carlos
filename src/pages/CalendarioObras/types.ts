/**
 * Tipos e helpers compartilhados pela página Calendário de Obras.
 */
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { WeekActivity } from '@/hooks/useWeekActivities';

export type ViewMode = 'month' | 'week-list' | 'week-timeline' | 'day' | 'range';

export type ActivityStatusKey = 'completed' | 'in_progress' | 'overdue' | 'pending';

export interface ActivityStatusBadgeSpec {
  label: string;
  className: string;
}

export const STATUS_BADGE: Record<ActivityStatusKey, ActivityStatusBadgeSpec> = {
  completed:   { label: 'Concluída',     className: 'bg-green-500/10 text-green-600 border-green-500/30' },
  in_progress: { label: 'Em andamento',  className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  overdue:     { label: 'Atrasada',      className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  pending:     { label: 'Pendente',      className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
};

export function getActivityStatus(a: WeekActivity, today: Date): ActivityStatusKey {
  if (a.actual_end) return 'completed';
  if (a.actual_start) return 'in_progress';
  const plannedStart = parseISO(a.planned_start);
  if (today > plannedStart) return 'overdue';
  return 'pending';
}

export function isViewMode(v: string | null): v is ViewMode {
  return v === 'month' || v === 'week-list' || v === 'week-timeline' || v === 'day' || v === 'range';
}

export function periodLabel(view: ViewMode, refDate: Date, viewStart: Date, viewEnd: Date): string {
  if (view === 'month') return format(refDate, "MMMM 'de' yyyy", { locale: ptBR });
  if (view === 'day')   return format(refDate, "EEEE, d 'de' MMM 'de' yyyy", { locale: ptBR });
  return `${format(viewStart, "d 'de' MMM", { locale: ptBR })} – ${format(viewEnd, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
}

export function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
