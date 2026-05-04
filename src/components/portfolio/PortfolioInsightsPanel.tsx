import { useMemo } from'react';
import { Users, Milestone } from'lucide-react';
import { cn } from'@/lib/utils';
import type { ProjectWithCustomer } from'@/infra/repositories';
import type { ProjectSummary } from'@/infra/repositories/projects.repository';

interface PortfolioInsightsPanelProps {
 projects: ProjectWithCustomer[];
 summaries: ProjectSummary[];
}

export function PortfolioInsightsPanel({ projects, summaries }: PortfolioInsightsPanelProps) {
 const activeProjects = useMemo(() => projects.filter(p => p.status ==='active'), [projects]);

 // ── Engineer load ──────────────────────────────────────────────────────
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

 // ── Upcoming milestones ────────────────────────────────────────────────
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
 <div className="space-y-3" role="region" aria-label="Insights do portfólio">

 {/* Engineer Load */}
 {engineerLoad.length > 0 && (
 <InsightCard icon={<Users className="h-3.5 w-3.5" />} title="Carga por Engenheiro">
 <div className="space-y-2">
 {engineerLoad.map((eng) => {
 const maxCount = engineerLoad[0]?.count ?? 1;
 const pct = (eng.count / maxCount) * 100;
 return (
 <div key={eng.name} className="space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-xs text-foreground font-medium truncate max-w-[130px]">
 {eng.name.split('')[0]}
 </span>
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold tabular-nums text-foreground">{eng.count}</span>
 {eng.overdueTotal > 0 && (
 <span className="text-[10px] font-semibold text-destructive tabular-nums">
 {eng.overdueTotal} atraso
 </span>
 )}
 </div>
 </div>
 <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
 <div
 className={cn('h-full rounded-full transition-all', eng.overdueTotal > 0 ?'bg-amber-500' :'bg-primary')}
 style={{ width:`${pct}%` }}
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
 <InsightCard icon={<Milestone className="h-3.5 w-3.5" />} title="Marcos Próximos">
 <div className="space-y-1.5">
 {upcomingMilestones.map((m) => (
 <div key={m.id} className="flex items-center justify-between gap-2">
 <span className="text-xs text-foreground truncate">{m.name}</span>
 <MilestoneBadge daysLeft={m.daysLeft} />
 </div>
 ))}
 </div>
 </InsightCard>
 )}
 </div>
 );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MilestoneBadge({ daysLeft }: { daysLeft: number }) {
 const isUrgent = daysLeft <= 3;
 const isWarning = daysLeft <= 7;
 return (
 <span className={cn(
'inline-flex items-center gap-1 text-[11px] font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded',
 isUrgent ?'bg-destructive/10 text-destructive' :
 isWarning ?'bg-amber-500/10 text-amber-600' :
'text-muted-foreground'
 )}>
 {isUrgent && <span aria-hidden="true">⚠</span>}
 {daysLeft}d
 </span>
 );
}

function InsightCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
 return (
 <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
 <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/15">
 <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
 <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
 </div>
 <div className="px-3 py-3">{children}</div>
 </div>
 );
}
