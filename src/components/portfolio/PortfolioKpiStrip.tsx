import { useMemo } from'react';
import {
 HardHat, Ban, Ghost, CheckCircle2,
 CalendarX, CalendarClock, DollarSign, Package, FileEdit,
} from'lucide-react';
import { cn } from'@/lib/utils';
import type { ProjectSummary } from'@/infra/repositories/projects.repository';
import type { ProjectWithCustomer } from'@/infra/repositories';


// ─── Types ───────────────────────────────────────────────────────────────────

export type KpiFilterKey =
 |'active'
 |'draft'
 |'critical'
 |'blocked'
 |'overdue'
 |'approaching-deadline'
 |'stale-7d'
 |'cost-at-risk'
 |'critical-purchase'
 |'completed';

export interface ProjectFinancial {
 budget_approved: number;
 cost_committed: number;
 cost_realized: number;
}

export interface KpiDefinition {
 key: KpiFilterKey;
 label: string;
 description: string;
 icon: React.ReactNode;
 accent:'default' |'success' |'warning' |'destructive' |'muted';
}

interface PortfolioKpiStripProps {
 projects: ProjectWithCustomer[];
 summaries: ProjectSummary[];
 financials?: Map<string, ProjectFinancial>;
 activeFilter: KpiFilterKey | null;
 onFilterChange: (key: KpiFilterKey | null) => void;
}

// ─── Definitions ─────────────────────────────────────────────────────────────

const kpiDefinitions: KpiDefinition[] = [
 { key:'active', label:'Ativas', description:'Obras ativas em execução', icon: <HardHat className="h-4 w-4" />, accent:'success' },
 { key:'draft', label:'Rascunhos', description:'Obras em rascunho aguardando finalização do cadastro', icon: <FileEdit className="h-4 w-4" />, accent:'muted' },
 { key:'completed', label:'Concluídas', description:'Obras finalizadas', icon: <CheckCircle2 className="h-4 w-4" />, accent:'default' },
 { key:'overdue', label:'Prazo estourado', description:'Obras com data de entrega ultrapassada', icon: <CalendarX className="h-4 w-4" />, accent:'destructive' },
 { key:'approaching-deadline', label:'Entrega próxima', description:'Entrega nos próximos 14 dias', icon: <CalendarClock className="h-4 w-4" />, accent:'warning' },
 { key:'blocked', label:'Bloqueadas', description:'Pausadas ou com impedimento', icon: <Ban className="h-4 w-4" />, accent:'destructive' },
 { key:'stale-7d', label:'Sem update', description:'Sem atividade há mais de 7 dias', icon: <Ghost className="h-4 w-4" />, accent:'warning' },
 { key:'cost-at-risk', label:'Custo em risco', description:'Obras com desvio de custo acima de 15%', icon: <DollarSign className="h-4 w-4" />, accent:'destructive' },
 { key:'critical-purchase', label:'Compra crítica', description:'Obras com compra crítica pendente', icon: <Package className="h-4 w-4" />, accent:'warning' },
];

// ─── Accent styles ───────────────────────────────────────────────────────────

const accentConfig = {
 success: {
 icon:'text-emerald-600',
 value:'text-emerald-700',
 activeBg:'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200/50',
 highlight:'',
 dot:'bg-emerald-500',
 },
 destructive: {
 icon:'text-destructive',
 value:'text-destructive',
 activeBg:'bg-red-50 border-red-300 ring-1 ring-red-200/50',
 highlight:'border-red-200 bg-red-50/40',
 dot:'bg-destructive',
 },
 warning: {
 icon:'text-amber-600',
 value:'text-amber-700',
 activeBg:'bg-amber-50 border-amber-300 ring-1 ring-amber-200/50',
 highlight:'',
 dot:'bg-amber-500',
 },
 default: {
 icon:'text-foreground',
 value:'text-foreground',
 activeBg:'bg-primary/5 border-primary/30 ring-1 ring-primary/10',
 highlight:'',
 dot:'bg-primary',
 },
 muted: {
 icon:'text-muted-foreground',
 value:'text-foreground',
 activeBg:'bg-primary/5 border-primary/30 ring-1 ring-primary/10',
 highlight:'',
 dot:'bg-muted-foreground',
 },
};

// ─── Compute KPI values ──────────────────────────────────────────────────────

function computeKpiValues(
 projects: ProjectWithCustomer[],
 summaries: ProjectSummary[],
 financials?: Map<string, ProjectFinancial>,
): Map<KpiFilterKey, number> {
 const summaryMap = new Map<string, ProjectSummary>();
 for (const s of summaries) summaryMap.set(s.id, s);

 const now = Date.now();
 const MS_STALE = 7 * 24 * 60 * 60 * 1000;
 const MS_14D = 14 * 24 * 60 * 60 * 1000;

 let activeCount = 0, draftCount = 0, criticalCount = 0, blockedCount = 0;
 let stale7d = 0, overdueCount = 0, approachingCount = 0;
 let costAtRisk = 0, completedCount = 0;

 for (const p of projects) {
 const s = summaryMap.get(p.id);
 if (p.status ==='active') activeCount++;
 if (p.status ==='draft') draftCount++;
 if (p.status ==='completed') completedCount++;
 if (p.status ==='paused') blockedCount++;
 if (s && p.status ==='active' && s.overdue_count > 0) criticalCount++;

 if (p.planned_end_date && p.status ==='active') {
 const daysLeft = new Date(p.planned_end_date).getTime() - now;
 if (daysLeft < 0) overdueCount++;
 else if (daysLeft <= MS_14D) approachingCount++;
 }

 if (p.status ==='active') {
 const ref = s?.last_activity_at ?? p.created_at;
 const refTime = ref ? new Date(ref).getTime() : 0;
 if (refTime > 0 && now - refTime > MS_STALE) stale7d++;
 }

 // Cost at risk: deviation > 15%
 if (p.status ==='active' && financials) {
 const fin = financials.get(p.id);
 if (fin && fin.budget_approved > 0) {
 if ((fin.cost_committed + fin.cost_realized) / fin.budget_approved - 1 > 0.15) {
 costAtRisk++;
 }
 }
 }
 }

 const map = new Map<KpiFilterKey, number>();
 map.set('active', activeCount);
 map.set('draft', draftCount);
 map.set('completed', completedCount);
 map.set('overdue', overdueCount);
 map.set('approaching-deadline', approachingCount);
 map.set('critical', criticalCount);
 map.set('blocked', blockedCount);
 map.set('stale-7d', stale7d);
 map.set('cost-at-risk', costAtRisk);
 map.set('critical-purchase', 0); // TODO: integrate with project_purchases table
 return map;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortfolioKpiStrip({
 projects, summaries, financials, activeFilter, onFilterChange,
}: PortfolioKpiStripProps) {
 const values = useMemo(() => computeKpiValues(projects, summaries, financials), [projects, summaries, financials]);

 return (
 <div
 className="grid grid-cols-3 gap-2 px-0 pb-1 md:flex md:flex-wrap"
 role="group"
 aria-label="KPIs operacionais — clique para filtrar"
 >
 {kpiDefinitions.filter((kpi) => {
 const val = values.get(kpi.key) ?? 0;
 return val > 0 || kpi.key ==='active' || activeFilter === kpi.key;
 }).map((kpi) => {
 const val = values.get(kpi.key) ?? 0;
 const isSelected = activeFilter === kpi.key;
 const isZero = val === 0;
 const accent = accentConfig[kpi.accent];
 const shouldHighlight = (kpi.key ==='overdue' || kpi.key ==='critical') && !isZero && !isSelected;

 return (
 <button
 key={kpi.key}
 type="button"
 onClick={() => onFilterChange(isSelected ? null : kpi.key)}
 title={kpi.description}
 aria-pressed={isSelected}
 aria-label={`${kpi.label}: ${val}`}
 className={cn(
'relative flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 min-w-[72px]',
'md:flex-row md:gap-2 md:px-3 md:py-2 md:min-w-0',
'transition-all duration-150 cursor-pointer select-none active:scale-[0.96]',
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
'min-h-[64px] md:min-h-0',
 isSelected
 ?`${accent.activeBg} shadow-sm`
 : shouldHighlight
 ? accent.highlight
 :'border-border/40 bg-card hover:border-border/70 hover:bg-card/90',
 isZero && !isSelected &&'opacity-40',
 )}
 >
 <div className={cn('shrink-0', isSelected || !isZero ? accent.icon :'text-muted-foreground/60')} aria-hidden="true">
 {kpi.icon}
 </div>
 <span className={cn(
'text-xl font-bold tabular-nums leading-none md:text-base',
 isSelected || !isZero ? accent.value :'text-muted-foreground',
 )}>
 {val}
 </span>
 <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center md:text-left md:truncate">
 {kpi.label}
 </span>
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
 financials?: Map<string, ProjectFinancial>,
): ProjectWithCustomer[] {
 const summaryMap = new Map<string, ProjectSummary>();
 for (const s of summaries) summaryMap.set(s.id, s);

 const now = Date.now();
 const MS_STALE = 7 * 24 * 60 * 60 * 1000;
 const MS_14D = 14 * 24 * 60 * 60 * 1000;

 switch (filter) {
 case'active':
 return projects.filter(p => p.status ==='active');
 case'draft':
 return projects.filter(p => p.status ==='draft');
 case'completed':
 return projects.filter(p => p.status ==='completed');
 case'overdue':
 return projects.filter(p => {
 if (!p.planned_end_date || p.status !=='active') return false;
 return new Date(p.planned_end_date).getTime() < now;
 });
 case'approaching-deadline':
 return projects.filter(p => {
 if (!p.planned_end_date || p.status !=='active') return false;
 const diff = new Date(p.planned_end_date).getTime() - now;
 return diff >= 0 && diff <= MS_14D;
 });
 case'critical':
 return projects.filter(p => {
 const s = summaryMap.get(p.id);
 return p.status ==='active' && s && s.overdue_count > 0;
 });
 case'blocked':
 return projects.filter(p => p.status ==='paused');
 case'stale-7d':
 return projects.filter(p => {
 if (p.status !=='active') return false;
 const s = summaryMap.get(p.id);
 const ref = s?.last_activity_at ?? p.created_at;
 const refTime = ref ? new Date(ref).getTime() : 0;
 return refTime > 0 && now - refTime > MS_STALE;
 });
 case'cost-at-risk':
 return projects.filter(p => {
 const fin = financials?.get(p.id);
 if (!fin || fin.budget_approved <= 0) return false;
 return (fin.cost_committed + fin.cost_realized) / fin.budget_approved - 1 > 0.15;
 });
 case'critical-purchase':
 return projects; // TODO: filter when purchases table exists
 default:
 return projects;
 }
}
