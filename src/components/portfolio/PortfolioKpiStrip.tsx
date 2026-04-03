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
  | 'stale-48h'
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

export interface KpiData {
  key: KpiFilterKey;
  value: number | string;
}

interface PortfolioKpiStripProps {
  projects: ProjectWithCustomer[];
  summaries: ProjectSummary[];
  activeFilter: KpiFilterKey | null;
  onFilterChange: (key: KpiFilterKey | null) => void;
}

// ─── Definitions ─────────────────────────────────────────────────────────────

const kpiDefinitions: KpiDefinition[] = [
  {
    key: 'active',
    label: 'Em andamento',
    description: 'Obras ativas em execução',
    icon: <HardHat className="h-4 w-4" />,
    accent: 'success',
  },
  {
    key: 'critical',
    label: 'Críticas',
    description: 'Health Score abaixo de 50',
    icon: <AlertTriangle className="h-4 w-4" />,
    accent: 'destructive',
  },
  {
    key: 'blocked',
    label: 'Bloqueadas',
    description: 'Pausadas ou com impedimento',
    icon: <Ban className="h-4 w-4" />,
    accent: 'destructive',
  },
  {
    key: 'milestone-7d',
    label: 'Marco em 7d',
    description: 'Prazo final nos próximos 7 dias',
    icon: <Milestone className="h-4 w-4" />,
    accent: 'warning',
  },
  {
    key: 'stale-48h',
    label: 'Sem update 48h',
    description: 'Sem atividade registrada há 2 dias',
    icon: <Ghost className="h-4 w-4" />,
    accent: 'warning',
  },
  {
    key: 'pending-docs',
    label: 'Docs pendentes',
    description: 'Documentos aguardando envio',
    icon: <FileText className="h-4 w-4" />,
    accent: 'warning',
  },
  {
    key: 'pending-sign',
    label: 'Assinaturas',
    description: 'Formalizações aguardando assinatura',
    icon: <FileSignature className="h-4 w-4" />,
    accent: 'warning',
  },
  {
    key: 'financial-deviation',
    label: 'Desvio financeiro',
    description: 'Soma de desvios sobre contratos ativos',
    icon: <TrendingDown className="h-4 w-4" />,
    accent: 'muted',
  },
];

// ─── Accent styles ───────────────────────────────────────────────────────────

const iconBg: Record<string, string> = {
  default: 'bg-muted/60 text-foreground',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  destructive: 'bg-red-500/10 text-red-600 dark:text-red-400',
  muted: 'bg-muted/60 text-muted-foreground',
};

const valueColor: Record<string, string> = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  destructive: 'text-red-600 dark:text-red-400',
  muted: 'text-foreground',
};

// ─── Compute KPI values from real data ───────────────────────────────────────

function computeKpiValues(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
): Map<KpiFilterKey, number | string> {
  const summaryMap = new Map<string, ProjectSummary>();
  for (const s of summaries) summaryMap.set(s.id, s);

  const now = Date.now();
  const MS_48H = 48 * 60 * 60 * 1000;
  const MS_7D = 7 * 24 * 60 * 60 * 1000;

  let activeCount = 0;
  let criticalCount = 0;
  let blockedCount = 0;
  let milestone7d = 0;
  let stale48h = 0;
  let pendingDocsTotal = 0;
  let pendingSignTotal = 0;

  for (const p of projects) {
    const s = summaryMap.get(p.id);

    if (p.status === 'active') activeCount++;
    if (p.status === 'paused') blockedCount++;

    // Critical: health-based heuristic — overdue > 0 or progress very low
    if (s && p.status === 'active' && s.overdue_count > 0) criticalCount++;

    // Milestone in 7 days
    if (p.planned_end_date && p.status === 'active') {
      const daysLeft = new Date(p.planned_end_date).getTime() - now;
      if (daysLeft >= 0 && daysLeft <= MS_7D) milestone7d++;
    }

    // Stale 48h
    if (s?.last_activity_at && p.status === 'active') {
      const elapsed = now - new Date(s.last_activity_at).getTime();
      if (elapsed > MS_48H) stale48h++;
    } else if (!s?.last_activity_at && p.status === 'active') {
      stale48h++; // never updated
    }

    // Docs & signatures
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
  map.set('financial-deviation', '—'); // needs real financial data
  return map;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortfolioKpiStrip({
  projects,
  summaries,
  activeFilter,
  onFilterChange,
}: PortfolioKpiStripProps) {
  const values = useMemo(
    () => computeKpiValues(projects, summaries),
    [projects, summaries],
  );

  return (
    <div
      className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 lg:mx-0 lg:px-0"
      role="group"
      aria-label="KPIs operacionais"
    >
      {kpiDefinitions.map((kpi) => {
        const val = values.get(kpi.key) ?? '—';
        const isSelected = activeFilter === kpi.key;
        const isZero = val === 0;

        return (
          <KpiCard
            key={kpi.key}
            definition={kpi}
            value={val}
            isSelected={isSelected}
            isZero={isZero}
            onClick={() => onFilterChange(isSelected ? null : kpi.key)}
          />
        );
      })}
    </div>
  );
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  definition: KpiDefinition;
  value: number | string;
  isSelected: boolean;
  isZero: boolean;
  onClick: () => void;
}

function KpiCard({ definition, value, isSelected, isZero, onClick }: KpiCardProps) {
  const { label, description, icon, accent } = definition;

  return (
    <button
      type="button"
      onClick={onClick}
      title={description}
      aria-pressed={isSelected}
      className={cn(
        'group relative flex items-center gap-3 shrink-0 rounded-xl border px-4 py-3 min-w-[150px] max-w-[190px]',
        'transition-all duration-150 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isSelected
          ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border/40 bg-card hover:border-border hover:bg-muted/30',
        isZero && !isSelected && 'opacity-60',
      )}
    >
      {/* Icon container */}
      <div className={cn(
        'flex items-center justify-center h-9 w-9 rounded-lg shrink-0 transition-colors',
        isSelected ? iconBg[accent] : iconBg[accent],
      )}>
        {icon}
      </div>

      {/* Text */}
      <div className="min-w-0 text-left">
        <p className={cn(
          'text-lg font-bold tabular-nums leading-none transition-colors',
          isSelected ? valueColor[accent] : (isZero ? 'text-muted-foreground' : valueColor[accent]),
        )}>
          {value}
        </p>
        <p className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate leading-tight">
          {label}
        </p>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -bottom-px left-4 right-4 h-0.5 rounded-full bg-primary" />
      )}
    </button>
  );
}

// ─── Filter helper (used by PortfolioPage) ───────────────────────────────────

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
      // Placeholder — return active for now
      return projects.filter(p => p.status === 'active');
    default:
      return projects;
  }
}
