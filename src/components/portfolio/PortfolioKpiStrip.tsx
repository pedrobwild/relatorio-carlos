import { useMemo } from 'react';
import {
  HardHat, AlertTriangle, Ban, Milestone, Ghost,
  FileText, FileSignature, TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';
import type { ProjectWithCustomer } from '@/infra/repositories';

// ─── Types ───────────────────────────────────────────────────────────────────

export type KpiFilterKey =
  | 'active'
  | 'critical'
  | 'blocked'
  | 'milestone-7d'
  | 'stale-7d'
  | 'pending-docs'
  | 'pending-sign'
  | 'financial-deviation';

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
  { key: 'critical', label: 'Críticas', description: 'Health Score abaixo de 50', icon: <AlertTriangle className="h-4 w-4" />, accent: 'destructive' },
  { key: 'blocked', label: 'Bloqueadas', description: 'Pausadas ou com impedimento', icon: <Ban className="h-4 w-4" />, accent: 'destructive' },
  { key: 'milestone-7d', label: 'Marco em 7d', description: 'Prazo final nos próximos 7 dias', icon: <Milestone className="h-4 w-4" />, accent: 'warning' },
  { key: 'stale-48h', label: 'Sem update 48h', description: 'Sem atividade registrada há 2 dias', icon: <Ghost className="h-4 w-4" />, accent: 'warning' },
  { key: 'pending-docs', label: 'Docs pendentes', description: 'Documentos aguardando envio', icon: <FileText className="h-4 w-4" />, accent: 'warning' },
  { key: 'pending-sign', label: 'Assinaturas', description: 'Formalizações aguardando assinatura', icon: <FileSignature className="h-4 w-4" />, accent: 'warning' },
  { key: 'financial-deviation', label: 'Desvio financeiro', description: 'Soma de desvios sobre contratos ativos', icon: <TrendingDown className="h-4 w-4" />, accent: 'muted' },
];

// ─── Accent styles ───────────────────────────────────────────────────────────

const iconBg: Record<string, string> = {
  default: 'bg-muted/60 text-foreground',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  destructive: 'bg-destructive/10 text-destructive',
  muted: 'bg-muted/60 text-muted-foreground',
};

const valueColor: Record<string, string> = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  destructive: 'text-destructive',
  muted: 'text-foreground',
};

// ─── Compute KPI values ──────────────────────────────────────────────────────

function computeKpiValues(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
): Map<KpiFilterKey, number | string> {
  const summaryMap = new Map<string, ProjectSummary>();
  for (const s of summaries) summaryMap.set(s.id, s);

  const now = Date.now();
  const MS_48H = 48 * 60 * 60 * 1000;
  const MS_7D = 7 * 24 * 60 * 60 * 1000;

  let activeCount = 0, criticalCount = 0, blockedCount = 0;
  let milestone7d = 0, stale48h = 0;
  let pendingDocsTotal = 0, pendingSignTotal = 0;

  for (const p of projects) {
    const s = summaryMap.get(p.id);
    if (p.status === 'active') activeCount++;
    if (p.status === 'paused') blockedCount++;
    if (s && p.status === 'active' && s.overdue_count > 0) criticalCount++;

    if (p.planned_end_date && p.status === 'active') {
      const daysLeft = new Date(p.planned_end_date).getTime() - now;
      if (daysLeft >= 0 && daysLeft <= MS_7D) milestone7d++;
    }

    if (p.status === 'active') {
      if (s?.last_activity_at) {
        if (now - new Date(s.last_activity_at).getTime() > MS_48H) stale48h++;
      } else {
        stale48h++;
      }
    }

    if (s) {
      pendingDocsTotal += s.pending_documents;
      pendingSignTotal += s.unsigned_formalizations;
    }
  }

  const map = new Map<KpiFilterKey, number | string>();
  map.set('active', activeCount);
  map.set('critical', criticalCount);
  map.set('blocked', blockedCount);
  map.set('milestone-7d', milestone7d);
  map.set('stale-48h', stale48h);
  map.set('pending-docs', pendingDocsTotal);
  map.set('pending-sign', pendingSignTotal);
  map.set('financial-deviation', '—');
  return map;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortfolioKpiStrip({
  projects, summaries, activeFilter, onFilterChange,
}: PortfolioKpiStripProps) {
  const values = useMemo(() => computeKpiValues(projects, summaries), [projects, summaries]);

  return (
    <div
      className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 lg:mx-0 lg:px-0"
      role="group"
      aria-label="KPIs operacionais — clique para filtrar"
    >
      {kpiDefinitions.map((kpi) => {
        const val = values.get(kpi.key) ?? '—';
        const isSelected = activeFilter === kpi.key;
        const isZero = val === 0;

        return (
          <button
            key={kpi.key}
            type="button"
            onClick={() => onFilterChange(isSelected ? null : kpi.key)}
            title={kpi.description}
            aria-pressed={isSelected}
            aria-label={`${kpi.label}: ${val}`}
            className={cn(
              'group relative flex items-center gap-3 shrink-0 rounded-xl border px-4 py-3 min-w-[150px] max-w-[190px]',
              'transition-all duration-150 cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected
                ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                : 'border-border/30 bg-card hover:border-border/60 hover:bg-muted/20 hover:shadow-sm',
              isZero && !isSelected && 'opacity-50',
            )}
          >
            <div className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg shrink-0 transition-colors',
              iconBg[kpi.accent],
            )} aria-hidden="true">
              {kpi.icon}
            </div>
            <div className="min-w-0 text-left">
              <p className={cn(
                'text-lg font-bold tabular-nums leading-none transition-colors',
                isSelected || !isZero ? valueColor[kpi.accent] : 'text-muted-foreground',
              )}>
                {val}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate leading-tight">
                {kpi.label}
              </p>
            </div>
            {isSelected && (
              <div className="absolute -bottom-px left-4 right-4 h-0.5 rounded-full bg-primary" />
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
  const MS_48H = 48 * 60 * 60 * 1000;
  const MS_7D = 7 * 24 * 60 * 60 * 1000;

  switch (filter) {
    case 'active':
      return projects.filter(p => p.status === 'active');
    case 'critical':
      return projects.filter(p => {
        const s = summaryMap.get(p.id);
        return p.status === 'active' && s && s.overdue_count > 0;
      });
    case 'blocked':
      return projects.filter(p => p.status === 'paused');
    case 'milestone-7d':
      return projects.filter(p => {
        if (!p.planned_end_date || p.status !== 'active') return false;
        const diff = new Date(p.planned_end_date).getTime() - now;
        return diff >= 0 && diff <= MS_7D;
      });
    case 'stale-48h':
      return projects.filter(p => {
        if (p.status !== 'active') return false;
        const s = summaryMap.get(p.id);
        if (!s?.last_activity_at) return true;
        return now - new Date(s.last_activity_at).getTime() > MS_48H;
      });
    case 'pending-docs':
      return projects.filter(p => {
        const s = summaryMap.get(p.id);
        return s && s.pending_documents > 0;
      });
    case 'pending-sign':
      return projects.filter(p => {
        const s = summaryMap.get(p.id);
        return s && s.unsigned_formalizations > 0;
      });
    case 'financial-deviation':
      return projects.filter(p => p.status === 'active');
    default:
      return projects;
  }
}
