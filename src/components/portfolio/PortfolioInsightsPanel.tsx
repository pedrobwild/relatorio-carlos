import { useMemo } from 'react';
import { Users, Milestone, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

interface PortfolioInsightsPanelProps {
  projects: ProjectWithCustomer[];
  summaries: ProjectSummary[];
}

// ─── Health tier config ──────────────────────────────────────────────────────

interface HealthTier {
  label: string;
  range: string;
  color: string;
  bg: string;
}

const healthTiers: HealthTier[] = [
  { label: 'Excelente', range: '80–100', color: 'bg-emerald-500', bg: 'text-emerald-600' },
  { label: 'Bom', range: '60–79', color: 'bg-blue-500', bg: 'text-blue-600' },
  { label: 'Atenção', range: '40–59', color: 'bg-amber-500', bg: 'text-amber-600' },
  { label: 'Crítico', range: '0–39', color: 'bg-red-500', bg: 'text-red-600' },
];

// ─── Simple health score heuristic ──────────────────────────────────────────

function estimateHealth(s: ProjectSummary): number {
  let score = 100;
  if (s.overdue_count > 0) score -= Math.min(40, s.overdue_count * 15);
  if (s.unsigned_formalizations > 0) score -= Math.min(20, s.unsigned_formalizations * 10);
  if (s.pending_documents > 0) score -= Math.min(15, s.pending_documents * 5);
  if (s.progress_percentage < 20 && s.status === 'active') score -= 10;
  return Math.max(0, Math.min(100, score));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortfolioInsightsPanel({ projects, summaries }: PortfolioInsightsPanelProps) {
  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'active'),
    [projects],
  );

  // ── Health distribution ────────────────────────────────────────────────────

  const healthDistribution = useMemo(() => {
    const buckets = [0, 0, 0, 0]; // excellent, good, attention, critical
    for (const s of summaries) {
      if (s.status !== 'active') continue;
      const h = estimateHealth(s);
      if (h >= 80) buckets[0]++;
      else if (h >= 60) buckets[1]++;
      else if (h >= 40) buckets[2]++;
      else buckets[3]++;
    }
    return buckets;
  }, [summaries]);

  const totalHealth = healthDistribution.reduce((a, b) => a + b, 0);

  // ── Engineer load ──────────────────────────────────────────────────────────

  const engineerLoad = useMemo(() => {
    const map = new Map<string, { name: string; count: number; overdueTotal: number }>();
    const summaryMap = new Map<string, ProjectSummary>();
    for (const s of summaries) summaryMap.set(s.id, s);

    for (const p of activeProjects) {
      if (!p.engineer_name) continue;
      const key = p.engineer_user_id ?? p.engineer_name;
      const existing = map.get(key) ?? { name: p.engineer_name, count: 0, overdueTotal: 0 };
      existing.count++;
      const s = summaryMap.get(p.id);
      if (s) existing.overdueTotal += s.overdue_count;
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [activeProjects, summaries]);

  // ── Upcoming milestones ────────────────────────────────────────────────────

  const upcomingMilestones = useMemo(() => {
    const now = Date.now();
    const MS_30D = 30 * 24 * 60 * 60 * 1000;

    return activeProjects
      .filter(p => p.planned_end_date)
      .map(p => {
        const end = new Date(p.planned_end_date!).getTime();
        const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        return { name: p.name, daysLeft, id: p.id };
      })
      .filter(m => m.daysLeft >= 0 && m.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [activeProjects]);

  return (
    <div className="space-y-3">
      {/* Health Distribution */}
      <InsightCard
        icon={<HeartPulse className="h-3.5 w-3.5" />}
        title="Saúde do Portfólio"
      >
        {totalHealth === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Sem dados de saúde disponíveis</p>
        ) : (
          <div className="space-y-2.5">
            {/* Bar */}
            <div className="flex h-2 rounded-full overflow-hidden bg-muted/40">
              {healthDistribution.map((count, i) => {
                const pct = totalHealth > 0 ? (count / totalHealth) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={i}
                    className={cn('h-full transition-all', healthTiers[i].color)}
                    style={{ width: `${pct}%` }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {healthTiers.map((tier, i) => (
                <div key={tier.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-2 w-2 rounded-full', tier.color)} />
                    <span className="text-[11px] text-muted-foreground">{tier.label}</span>
                  </div>
                  <span className={cn('text-[11px] font-bold tabular-nums', tier.bg)}>
                    {healthDistribution[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </InsightCard>

      {/* Engineer Load */}
      {engineerLoad.length > 0 && (
        <InsightCard
          icon={<Users className="h-3.5 w-3.5" />}
          title="Carga por Engenheiro"
        >
          <div className="space-y-2">
            {engineerLoad.map((eng) => {
              const maxCount = engineerLoad[0]?.count ?? 1;
              const pct = (eng.count / maxCount) * 100;
              return (
                <div key={eng.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground font-medium truncate max-w-[140px]">
                      {eng.name.split(' ')[0]}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tabular-nums text-foreground">
                        {eng.count}
                      </span>
                      {eng.overdueTotal > 0 && (
                        <span className="text-[10px] font-semibold text-red-600 tabular-nums">
                          {eng.overdueTotal} atraso
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        eng.overdueTotal > 0 ? 'bg-amber-500' : 'bg-primary'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </InsightCard>
      )}

      {/* Upcoming Milestones */}
      {upcomingMilestones.length > 0 && (
        <InsightCard
          icon={<Milestone className="h-3.5 w-3.5" />}
          title="Marcos Próximos"
        >
          <div className="space-y-1.5">
            {upcomingMilestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground truncate">{m.name}</span>
                <span className={cn(
                  'text-[11px] font-bold tabular-nums shrink-0',
                  m.daysLeft <= 3 ? 'text-red-600' :
                  m.daysLeft <= 7 ? 'text-amber-600' :
                  'text-muted-foreground'
                )}>
                  {m.daysLeft}d
                </span>
              </div>
            ))}
          </div>
        </InsightCard>
      )}
    </div>
  );
}

// ─── Shared card shell ───────────────────────────────────────────────────────

function InsightCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/20">
        <span className="text-muted-foreground">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      </div>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}
