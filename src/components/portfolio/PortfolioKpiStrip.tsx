import { useMemo } from 'react';
import {
  HardHat, AlertTriangle, Ban, Ghost,
  CalendarX, CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';
import type { ProjectWithCustomer } from '@/infra/repositories';

// ─── Types ───────────────────────────────────────────────────────────────────

export type KpiFilterKey =
  | 'active'
  | 'critical'
  | 'blocked'
  | 'overdue'
  | 'approaching-deadline'
  | 'stale-7d';

export interface KpiDefinition {
  key: KpiFilterKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: 'default' | 'success' | 'warning' | 'destructive' | 'muted';
}

interface PortfolioKpiStripProps {
  projects: ProjectWithCustomer[];
  summaries: ProjectSummary[];
  activeFilter: KpiFilterKey | null;
  onFilterChange: (key: KpiFilterKey | null) => void;
}

// ─── Definitions ─────────────────────────────────────────────────────────────

const kpiDefinitions: KpiDefinition[] = [
  { key: 'active', label: 'Em andamento', description: 'Obras ativas em execução', icon: <HardHat className="h-4 w-4" />, accent: 'success' },
  { key: 'overdue', label: 'Prazo estourado', description: 'Obras com data de entrega ultrapassada', icon: <CalendarX className="h-4 w-4" />, accent: 'destructive' },
  { key: 'approaching-deadline', label: 'Entrega próxima', description: 'Entrega nos próximos 14 dias', icon: <CalendarClock className="h-4 w-4" />, accent: 'warning' },
  { key: 'critical', label: 'Críticas', description: 'Health Score abaixo de 50', icon: <AlertTriangle className="h-4 w-4" />, accent: 'destructive' },
  { key: 'blocked', label: 'Bloqueadas', description: 'Pausadas ou com impedimento', icon: <Ban className="h-4 w-4" />, accent: 'destructive' },
  { key: 'stale-7d', label: 'Sem update 7d+', description: 'Sem atividade há mais de 7 dias', icon: <Ghost className="h-4 w-4" />, accent: 'warning' },
];

// ─── Accent styles ───────────────────────────────────────────────────────────

const accentConfig = {
  success: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-600 dark:text-emerald-400',
    activeBg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
    highlight: '',
  },
  destructive: {
    icon: 'text-destructive',
    value: 'text-destructive',
    activeBg: 'bg-red-50 border-red-200 dark:bg-destructive/10 dark:border-destructive/30',
    highlight: 'border-red-200/60 bg-red-50/50 dark:border-destructive/20 dark:bg-destructive/[0.04]',
  },
  warning: {
    icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-600 dark:text-amber-400',
    activeBg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
    highlight: '',
  },
  default: {
    icon: 'text-foreground',
    value: 'text-foreground',
    activeBg: 'bg-primary/5 border-primary/30',
    highlight: '',
  },
  muted: {
    icon: 'text-muted-foreground',
    value: 'text-foreground',
    activeBg: 'bg-primary/5 border-primary/30',
    highlight: '',
  },
};

// ─── Compute KPI values ──────────────────────────────────────────────────────

function computeKpiValues(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
): Map<KpiFilterKey, number> {
  const summaryMap = new Map<string, ProjectSummary>();
  for (const s of summaries) summaryMap.set(s.id, s);

  const now = Date.now();
  const MS_STALE = 7 * 24 * 60 * 60 * 1000;
  const MS_14D = 14 * 24 * 60 * 60 * 1000;

  let activeCount = 0, criticalCount = 0, blockedCount = 0;
  let stale7d = 0, overdueCount = 0, approachingCount = 0;

  for (const p of projects) {
    const s = summaryMap.get(p.id);
    if (p.status === 'active') activeCount++;
    if (p.status === 'paused') blockedCount++;
    if (s && p.status === 'active' && s.overdue_count > 0) criticalCount++;

    if (p.planned_end_date && p.status === 'active') {
      const daysLeft = new Date(p.planned_end_date).getTime() - now;
      if (daysLeft < 0) overdueCount++;
      else if (daysLeft <= MS_14D) approachingCount++;
    }

    if (p.status === 'active') {
      const ref = s?.last_activity_at ?? p.created_at;
      const refTime = ref ? new Date(ref).getTime() : 0;
      if (refTime > 0 && now - refTime > MS_STALE) stale7d++;
    }
  }

  const map = new Map<KpiFilterKey, number>();
  map.set('active', activeCount);
  map.set('overdue', overdueCount);
  map.set('approaching-deadline', approachingCount);
  map.set('critical', criticalCount);
  map.set('blocked', blockedCount);
  map.set('stale-7d', stale7d);
  return map;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortfolioKpiStrip({
  projects, summaries, activeFilter, onFilterChange,
}: PortfolioKpiStripProps) {
  const values = useMemo(() => computeKpiValues(projects, summaries), [projects, summaries]);

  return (
    <div
      className="grid grid-cols-3 lg:grid-cols-6 gap-2.5"
      role="group"
      aria-label="KPIs operacionais — clique para filtrar"
    >
      {kpiDefinitions.map((kpi) => {
        const val = values.get(kpi.key) ?? 0;
        const isSelected = activeFilter === kpi.key;
        const isZero = val === 0;
        const accent = accentConfig[kpi.accent];
        const shouldHighlight = kpi.key === 'overdue' && !isZero && !isSelected;

        return (
          <button
            key={kpi.key}
            type="button"
            onClick={() => onFilterChange(isSelected ? null : kpi.key)}
            title={kpi.description}
            aria-pressed={isSelected}
            aria-label={`${kpi.label}: ${val}`}
            className={cn(
              'relative flex items-center gap-3 rounded-xl border px-3.5 py-3',
              'transition-all duration-150 cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected
                ? `${accent.activeBg} shadow-sm`
                : shouldHighlight
                  ? accent.highlight
                  : 'border-border/50 bg-card hover:border-border hover:shadow-sm',
              isZero && !isSelected && 'opacity-40',
            )}
          >
            <div className={cn('shrink-0', isSelected || !isZero ? accent.icon : 'text-muted-foreground')} aria-hidden="true">
              {kpi.icon}
            </div>
            <div className="min-w-0 text-left">
              <p className={cn(
                'text-lg font-bold tabular-nums leading-none',
                isSelected || !isZero ? accent.value : 'text-muted-foreground',
              )}>
                {val}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground mt-1 truncate leading-tight">
                {kpi.label}
              </p>
            </div>
            {isSelected && (
              <div className="absolute -bottom-px left-4 right-4 h-0.5 rounded-full bg-current opacity-60" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Filter helper ───────────────────────────────────────────────────────────

export function applyKpiFilter(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
  filter: KpiFilterKey,
): ProjectWithCustomer[] {
  const summaryMap = new Map<string, ProjectSummary>();
  for (const s of summaries) summaryMap.set(s.id, s);

  const now = Date.now();
  const MS_STALE = 7 * 24 * 60 * 60 * 1000;
  const MS_14D = 14 * 24 * 60 * 60 * 1000;

  switch (filter) {
    case 'active':
      return projects.filter(p => p.status === 'active');
    case 'overdue':
      return projects.filter(p => {
        if (!p.planned_end_date || p.status !== 'active') return false;
        return new Date(p.planned_end_date).getTime() < now;
      });
    case 'approaching-deadline':
      return projects.filter(p => {
        if (!p.planned_end_date || p.status !== 'active') return false;
        const diff = new Date(p.planned_end_date).getTime() - now;
        return diff >= 0 && diff <= MS_14D;
      });
    case 'critical':
      return projects.filter(p => {
        const s = summaryMap.get(p.id);
        return p.status === 'active' && s && s.overdue_count > 0;
      });
    case 'blocked':
      return projects.filter(p => p.status === 'paused');
    case 'stale-7d':
      return projects.filter(p => {
        if (p.status !== 'active') return false;
        const s = summaryMap.get(p.id);
        const ref = s?.last_activity_at ?? p.created_at;
        const refTime = ref ? new Date(ref).getTime() : 0;
        return refTime > 0 && now - refTime > MS_STALE;
      });
    default:
      return projects;
  }
}
