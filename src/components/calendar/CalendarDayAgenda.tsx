/**
 * CalendarDayAgenda — single-day list of activities scheduled (planned interval
 * intersects the chosen day). Grouped by project, with quick visibility of
 * status and a click to open the detail dialog.
 *
 * Também exibe, em uma seção separada no topo, as solicitações de compra
 * criadas neste dia (data de cadastro = data selecionada).
 */
import { useMemo } from'react';
import { format, isWithinInterval, parseISO } from'date-fns';
import { ptBR } from'date-fns/locale';
import { Building2, CalendarDays, ShoppingCart } from'lucide-react';
import { cn } from'@/lib/utils';
import { getProjectColor } from'@/lib/taskUtils';
import type { WeekActivity } from'@/hooks/useWeekActivities';
import type { PurchaseCalendarEvent } from'@/hooks/usePurchasesByCreationRange';
import { Card, CardContent, CardHeader, CardTitle } from'@/components/ui/card';
import { Badge } from'@/components/ui/badge';
import { EmptyState } from'@/components/ui/states';

const statusBadge: Record<string, { label: string; className: string }> = {
 completed: { label:'Concluída', className:'bg-green-500/10 text-green-600 border-green-500/30' },
 in_progress: { label:'Em andamento', className:'bg-blue-500/10 text-blue-600 border-blue-500/30' },
 overdue: { label:'Atrasada', className:'bg-red-500/10 text-red-600 border-red-500/30' },
 pending: { label:'Pendente', className:'bg-amber-500/10 text-amber-600 border-amber-500/30' },
};

function statusOf(a: WeekActivity, today: Date) {
 if (a.actual_end) return'completed' as const;
 if (a.actual_start) return'in_progress' as const;
 if (today > parseISO(a.planned_start)) return'overdue' as const;
 return'pending' as const;
}

interface Props {
 day: Date;
 activities: WeekActivity[];
 onActivityClick: (a: WeekActivity) => void;
 /** Solicitações de compra criadas neste dia. */
 dayPurchases?: PurchaseCalendarEvent[];
}

export function CalendarDayAgenda({ day, activities, onActivityClick, dayPurchases = [] }: Props) {
 const today = new Date();
 const dayActivities = useMemo(
 () =>
 activities.filter((a) =>
 isWithinInterval(day, { start: parseISO(a.planned_start), end: parseISO(a.planned_end) }),
 ),
 [activities, day.getTime()],
 );

 const grouped = useMemo(() => {
 const m = new Map<
 string,
 { project_id: string; project_name: string; client_name: string | null; items: WeekActivity[] }
 >();
 for (const a of dayActivities) {
 if (!m.has(a.project_id)) {
 m.set(a.project_id, {
 project_id: a.project_id,
 project_name: a.project_name,
 client_name: a.client_name,
 items: [],
 });
 }
 m.get(a.project_id)!.items.push(a);
 }
 return Array.from(m.values()).sort((x, y) =>
 x.project_name.localeCompare(y.project_name,'pt-BR'),
 );
 }, [dayActivities]);

 const purchasesGrouped = useMemo(() => {
 const m = new Map<string, { project_id: string; project_name: string; items: PurchaseCalendarEvent[] }>();
 for (const p of dayPurchases) {
 if (!m.has(p.project_id)) {
 m.set(p.project_id, { project_id: p.project_id, project_name: p.project_name, items: [] });
 }
 m.get(p.project_id)!.items.push(p);
 }
 return Array.from(m.values()).sort((x, y) =>
 x.project_name.localeCompare(y.project_name,'pt-BR'),
 );
 }, [dayPurchases]);

 const hasContent = grouped.length > 0 || purchasesGrouped.length > 0;

 if (!hasContent) {
 return (
 <EmptyState
 icon={CalendarDays}
 title="Nenhuma atividade neste dia"
 description={`Não há atividades planejadas nem compras solicitadas em ${format(day,"EEEE, d'de' MMMM", { locale: ptBR })}.`}
 />
 );
 }

 return (
 <div className="space-y-3">
 <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
 <span>{format(day,"EEEE, d'de' MMMM'de' yyyy", { locale: ptBR })}</span>
 <span>· {dayActivities.length} atividade(s)</span>
 {dayPurchases.length > 0 && (
 <span className="inline-flex items-center gap-1 text-amber-700">
 <ShoppingCart className="h-3.5 w-3.5" />
 {dayPurchases.length} compra(s) solicitada(s)
 </span>
 )}
 </div>

 {/* Solicitações de compra criadas neste dia */}
 {purchasesGrouped.length > 0 && (
 <Card className="overflow-hidden border-l-4 border-amber-500/60">
 <CardHeader className="py-2.5 px-4 border-b bg-amber-500/5">
 <div className="flex items-center gap-2">
 <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 shrink-0">
 <ShoppingCart className="h-4 w-4" />
 </span>
 <div className="min-w-0 flex-1">
 <CardTitle className="text-sm font-semibold">Compras solicitadas neste dia</CardTitle>
 <div className="text-[11px] text-muted-foreground">
 Solicitações criadas em {format(day,'dd/MM/yyyy')}
 </div>
 </div>
 <Badge variant="secondary" className="text-[10px] shrink-0">
 {dayPurchases.length} item(ns)
 </Badge>
 </div>
 </CardHeader>
 <CardContent className="p-0 divide-y">
 {purchasesGrouped.map((g) => (
 <div key={g.project_id} className="px-4 py-2.5">
 <div className="text-[11px] font-medium text-muted-foreground mb-1 truncate">
 {g.project_name}
 </div>
 <div className="space-y-1">
 {g.items.map((p) => (
 <div key={p.id} className="flex items-center gap-2 text-sm">
 <span className="flex-1 truncate">{p.item_name}</span>
 {p.supplier_name && (
 <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
 {p.supplier_name}
 </span>
 )}
 <Badge variant="outline" className="text-[10px] shrink-0">
 {p.purchase_type ==='prestador' ?'Prestador' :'Produto'}
 </Badge>
 </div>
 ))}
 </div>
 </div>
 ))}
 </CardContent>
 </Card>
 )}

 {grouped.map((g) => {
 const color = getProjectColor(g.project_id);
 return (
 <Card key={g.project_id} className={cn('overflow-hidden border-l-4', color.border)}>
 <CardHeader className="py-2.5 px-4 border-b">
 <div className="flex items-center gap-2 min-w-0">
 <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0', color.bg)}>
 <Building2 className="h-4 w-4" />
 </span>
 <div className="min-w-0 flex-1">
 <CardTitle className="text-sm font-semibold truncate">{g.project_name}</CardTitle>
 {g.client_name && (
 <div className="text-[11px] text-muted-foreground truncate">{g.client_name}</div>
 )}
 </div>
 <Badge variant="secondary" className="text-[10px] shrink-0">{g.items.length} ativ.</Badge>
 </div>
 </CardHeader>
 <CardContent className="p-0 divide-y">
 {g.items.map((a) => {
 const s = statusOf(a, today);
 const sb = statusBadge[s];
 return (
 <button
 key={a.id}
 type="button"
 onClick={() => onActivityClick(a)}
 className="w-full text-left px-4 py-2.5 hover:bg-muted/40 transition-colors flex items-center gap-2"
 >
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium truncate">{a.description}</div>
 <div className="text-[11px] text-muted-foreground">
 Previsto: {format(parseISO(a.planned_start),'dd/MM')} →{''}
 {format(parseISO(a.planned_end),'dd/MM')}
 {a.etapa && <span className="ml-2">· {a.etapa}</span>}
 </div>
 </div>
 <Badge className={cn('text-[10px]', sb.className)}>{sb.label}</Badge>
 </button>
 );
 })}
 </CardContent>
 </Card>
 );
 })}
 </div>
 );
}
