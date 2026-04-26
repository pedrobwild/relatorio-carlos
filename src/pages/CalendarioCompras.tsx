import { Fragment, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, addMonths, subMonths, isWeekend,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Calendar, CalendarIcon, X, FilterX, Plus, ChevronDown, ChevronUp,
  ExternalLink, ArrowUpDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageSkeleton } from '@/components/ui-premium';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  type CalendarStatus,
  type PurchaseWithProject,
  CALENDAR_STATUS_OPTIONS,
  calendarStatusConfig,
  fmt,
  fmtCompact,
  fmtDiff,
  fmtRequestedDate,
  toCalendarStatus,
} from './calendario-compras/types';
import { ActualCostCell, DateCell, PurchaseRowDetail, StatusCell } from './calendario-compras/cells';
import { NewPurchaseDialog } from './calendario-compras/NewPurchaseDialog';

// `ProjectPurchaseInsert` re-exportado para compatibilidade com consumidores
// externos que possam estar importando dessa página.
export type { ProjectPurchaseInsert } from './calendario-compras/types';


// ─── Main page ────────────────────────────────────────────────────────────────
export default function CalendarioCompras() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterActualCost, setFilterActualCost] = useState<'all' | 'informed' | 'pending'>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  // Ordenação por "Solicitada em" (created_at). null = ordem padrão (planned_purchase_date asc).
  const [requestedSort, setRequestedSort] = useState<'asc' | 'desc' | null>(null);
  const toggleRequestedSort = () => {
    setRequestedSort((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null));
  };

  const toggleRow = (id: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const { data: allPurchases = [], isLoading } = useQuery({
    queryKey: ['all-purchases-calendar'],
    queryFn: async () => {
      const { data: purchases, error } = await supabase
        .from('project_purchases')
        .select('*')
        .order('planned_purchase_date', { ascending: true });
      if (error) throw error;
      const projectIds = [...new Set((purchases || []).map((p) => p.project_id))];
      const { data: projects } = await supabase
        .from('projects').select('id, name').in('id', projectIds);
      const projectMap = new Map((projects || []).map((p) => [p.id, p.name]));
      return (purchases || []).map((p) => ({
        ...p,
        project_name: projectMap.get(p.project_id) || 'Projeto',
      })) as PurchaseWithProject[];
    },
    staleTime: 60_000,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['all-payments-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_payments').select('id, project_id, amount, paid_at').not('paid_at', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Fetch all projects for the New Purchase dialog (not just the ones with purchases)
  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects-for-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects').select('id, name').order('name');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    staleTime: 120_000,
  });

  const updateActualCost = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number | null }) => {
      const { error } = await supabase.from('project_purchases').update({ actual_cost: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] }); toast.success('Custo real atualizado'); },
    onError: (e) => { console.error(e); toast.error('Erro ao atualizar custo real'); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: CalendarStatus }) => {
      const { error } = await supabase.from('project_purchases').update({ status: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] }); toast.success('Status atualizado'); },
    onError: (e) => { console.error(e); toast.error('Erro ao atualizar status'); },
  });

  const updateDateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'planned_purchase_date' | 'payment_due_date'; value: string | null }) => {
      const { error } = await supabase.from('project_purchases').update({ [field]: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] });
      toast.success(vars.field === 'planned_purchase_date' ? 'Data da compra atualizada' : 'Data de pagamento atualizada');
    },
    onError: (e) => { console.error(e); toast.error('Erro ao atualizar data'); },
  });

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    allPurchases.forEach((p) => map.set(p.project_id, p.project_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPurchases]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    allPurchases.forEach((p) => { if (p.supplier_name?.trim()) set.add(p.supplier_name.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allPurchases]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allPurchases.forEach((p) => { if (p.category?.trim()) set.add(p.category.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allPurchases]);

  const dateFromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : null;
  const dateToStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : null;

  const filtered = useMemo(() => {
    return allPurchases.filter((p) => {
      if (filterStatus !== 'all' && toCalendarStatus(p.status) !== filterStatus) return false;
      if (filterProject !== 'all' && p.project_id !== filterProject) return false;
      if (filterSupplier !== 'all' && (p.supplier_name || '') !== filterSupplier) return false;
      if (filterCategory !== 'all' && (p.category || '') !== filterCategory) return false;
      if (filterActualCost === 'informed' && p.actual_cost == null) return false;
      if (filterActualCost === 'pending' && p.actual_cost != null) return false;
      if (dateFromStr || dateToStr) {
        if (!p.planned_purchase_date) return false;
        if (dateFromStr && p.planned_purchase_date < dateFromStr) return false;
        if (dateToStr && p.planned_purchase_date > dateToStr) return false;
      }
      return true;
    });
  }, [allPurchases, filterStatus, filterProject, filterSupplier, filterCategory, filterActualCost, dateFromStr, dateToStr]);

  const activeFilterCount =
    (filterStatus !== 'all' ? 1 : 0) + (filterProject !== 'all' ? 1 : 0) +
    (filterSupplier !== 'all' ? 1 : 0) + (filterCategory !== 'all' ? 1 : 0) +
    (filterActualCost !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearFilters = () => {
    setFilterStatus('all'); setFilterProject('all'); setFilterSupplier('all');
    setFilterCategory('all'); setFilterActualCost('all');
    setDateFrom(undefined); setDateTo(undefined);
  };

  const purchasesByDate = useMemo(() => {
    const map = new Map<string, PurchaseWithProject[]>();
    filtered.forEach((p) => {
      if (!p.planned_purchase_date) return;
      if (!map.has(p.planned_purchase_date)) map.set(p.planned_purchase_date, []);
      map.get(p.planned_purchase_date)!.push(p);
    });
    return map;
  }, [filtered]);

  // Comparador por created_at — trata nulos sempre por último, qualquer que seja a direção.
  const compareByCreatedAt = (a: PurchaseWithProject, b: PurchaseWithProject, dir: 'asc' | 'desc') => {
    const av = a.created_at ?? '';
    const bv = b.created_at ?? '';
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  };

  const sortedForList = useMemo(() => {
    const base = [...filtered].filter((p) => p.planned_purchase_date);
    if (requestedSort) {
      return base.sort((a, b) => compareByCreatedAt(a, b, requestedSort));
    }
    return base.sort((a, b) => (a.planned_purchase_date || '').localeCompare(b.planned_purchase_date || ''));
  }, [filtered, requestedSort]);

  const withoutDate = useMemo(() => {
    const base = filtered.filter((p) => !p.planned_purchase_date);
    if (requestedSort) {
      return [...base].sort((a, b) => compareByCreatedAt(a, b, requestedSort));
    }
    return base;
  }, [filtered, requestedSort]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // KPIs
  const totalItems = filtered.length;
  const pendingItems = filtered.filter((p) => toCalendarStatus(p.status) === 'pending').length;
  const thisMonthItems = filtered.filter((p) => p.planned_purchase_date && isSameMonth(parseISO(p.planned_purchase_date), currentMonth)).length;
  const totalEstimated = filtered.reduce((s, p) => s + (p.estimated_cost || 0), 0);
  const itemsWithBoth = filtered.filter((p) => p.estimated_cost != null && p.actual_cost != null);
  const totalDiff = itemsWithBoth.reduce((s, p) => s + (p.estimated_cost! - p.actual_cost!), 0);
  const diffPositive = totalDiff >= 0;

  const availableBudget = useMemo(() => {
    const projectIdSet = new Set(filtered.map((p) => p.project_id));
    return allPayments.reduce((sum, pay) => {
      if (!pay.paid_at) return sum;
      if (projectIdSet.size > 0 && !projectIdSet.has(pay.project_id)) return sum;
      if (filterProject !== 'all' && pay.project_id !== filterProject) return sum;
      const paidDate = pay.paid_at.slice(0, 10);
      if (dateFromStr && paidDate < dateFromStr) return sum;
      if (dateToStr && paidDate > dateToStr) return sum;
      return sum + (Number(pay.amount) || 0);
    }, 0);
  }, [allPayments, filtered, filterProject, dateFromStr, dateToStr]);

  const budgetBalance = availableBudget - totalEstimated;
  const balancePositive = budgetBalance >= 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Calendário de Compras" backTo="/gestao" maxWidth="full" showLogo={false} />
        <div className="py-6"><PageContainer maxWidth="full"><PageSkeleton metrics content="table" /></PageContainer></div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Calendário de Compras"
        backTo="/gestao"
        maxWidth="full"
        showLogo={false}
        breadcrumbs={[{ label: 'Gestão', href: '/gestao' }, { label: 'Calendário de Compras' }]}
      />

      <NewPurchaseDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        projects={allProjects}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] })}
      />

      <div className="py-6">
        <PageContainer maxWidth="full" className="space-y-6">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total de Itens', value: totalItems, cls: '' },
              { label: 'Pendentes', value: pendingItems, cls: 'text-amber-600' },
              { label: 'Este Mês', value: thisMonthItems, cls: '' },
              { label: 'Total Estimado', value: fmt(totalEstimated), cls: 'text-xl' },
              {
                label: `Diferença (${itemsWithBoth.length})`,
                value: itemsWithBoth.length === 0 ? '—' : fmtDiff(totalDiff),
                cls: cn('text-xl', diffPositive ? 'text-emerald-600' : 'text-red-600'),
              },
              { label: 'Orçamento Disponível', value: fmt(availableBudget), cls: 'text-xl text-emerald-600' },
              {
                label: 'Saldo',
                value: fmtDiff(budgetBalance),
                cls: cn('text-xl', balancePositive ? 'text-emerald-600' : 'text-red-600'),
              },
            ].map(({ label, value, cls }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">{label}</p>
                  <p className={cn('font-bold tabular-nums', cls.includes('text-xl') ? 'text-xl whitespace-nowrap' : 'text-2xl')}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Filters + View Toggle + New Button ── */}
          {/* sticky para manter filtros e ações de troca de visão sempre visíveis ao rolar listas longas */}
          <Card className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                {/* Period: From */}
                {[{ label: 'De', val: dateFrom, set: setDateFrom, placeholder: 'Início' },
                  { label: 'Até', val: dateTo, set: setDateTo, placeholder: 'Fim' }].map(({ label, val, set: setVal, placeholder }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn('w-36 justify-start text-left font-normal', !val && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {val ? format(val, 'dd/MM/yyyy') : placeholder}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker mode="single" selected={val} onSelect={setVal as (d: Date | undefined) => void}
                          locale={ptBR} initialFocus className="p-3 pointer-events-auto"
                          disabled={label === 'Até' && dateFrom ? (d) => d < dateFrom : undefined} />
                      </PopoverContent>
                    </Popover>
                  </div>
                ))}

                {/* Status */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {CALENDAR_STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{calendarStatusConfig[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Obra */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Obra</Label>
                  <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Obra" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as obras</SelectItem>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fornecedor */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                  <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                    <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos fornecedores</SelectItem>
                      {suppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Categoria */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custo Real */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Custo Real</Label>
                  <Select value={filterActualCost} onValueChange={(v) => setFilterActualCost(v as 'all' | 'informed' | 'pending')}>
                    <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="informed">Informado</SelectItem>
                      <SelectItem value="pending">Não informado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground">
                    <FilterX className="h-3.5 w-3.5 mr-1" />Limpar ({activeFilterCount})
                  </Button>
                )}

                {/* View toggle + Nova Solicitação */}
                <div className="ml-auto flex items-center gap-2 self-end">
                  <div className="flex gap-1">
                    <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>Lista</Button>
                    <Button variant={viewMode === 'calendar' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('calendar')}>
                      <Calendar className="h-4 w-4 mr-1" />Calendário
                    </Button>
                  </div>
                  <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setNewDialogOpen(true)}>
                    <Plus className="h-4 w-4" />Nova Solicitação
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Calendar view ── */}
          {viewMode === 'calendar' ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                    <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                  ))}
                  {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
                  ))}
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayPurchases = purchasesByDate.get(dateStr) || [];
                    const isToday = isSameDay(day, new Date());
                    const weekend = isWeekend(day);
                    return (
                      <div key={dateStr} className={cn('bg-background p-1.5 min-h-[80px] text-xs', isToday && 'ring-2 ring-primary ring-inset', weekend && 'bg-muted/40')}>
                        <span className={cn('font-medium', isToday && 'text-primary')}>{format(day, 'd')}</span>
                        <div className="mt-1 space-y-0.5">
                          {dayPurchases.slice(0, 3).map((p) => {
                            const cs = toCalendarStatus(p.status);
                            const cfg = calendarStatusConfig[cs];
                            return (
                              <div key={p.id} className={cn('text-[10px] leading-tight rounded-sm px-1 py-0.5 truncate border', cfg.color)} title={`${p.project_name} — ${p.item_name}`}>
                                {p.item_name}
                              </div>
                            );
                          })}
                          {dayPurchases.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayPurchases.length - 3} mais</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── List view: Agendadas ── */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Compras Agendadas <span className="text-muted-foreground font-normal text-sm">({sortedForList.length})</span></CardTitle>
                    <p className="text-xs text-muted-foreground hidden sm:block">Clique em ▸ para ver detalhes • campos editáveis em linha</p>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <Table className="text-xs [&_th]:px-3 [&_td]:px-3 [&_th]:h-9 [&_td]:py-2">
                  <TableHeader>
                      <TableRow className="bg-muted/50">
                        {/* expand toggle col */}
                        <TableHead className="w-8" />
                        <TableHead className="whitespace-nowrap">Data Compra</TableHead>
                        <TableHead className="whitespace-nowrap">Obra</TableHead>
                        <TableHead className="whitespace-nowrap">Item</TableHead>
                        <TableHead className="whitespace-nowrap p-0">
                          <button
                            type="button"
                            onClick={toggleRequestedSort}
                            aria-label={`Ordenar por solicitada em${requestedSort ? ` (${requestedSort === 'asc' ? 'ascendente' : 'descendente'})` : ''}`}
                            aria-sort={requestedSort === 'asc' ? 'ascending' : requestedSort === 'desc' ? 'descending' : 'none'}
                            className={cn(
                              'flex h-9 w-full items-center gap-1 px-3 text-left font-medium whitespace-nowrap',
                              'hover:bg-muted/60 hover:text-foreground transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                              requestedSort && 'text-foreground bg-muted/40',
                            )}
                          >
                            Solicitada em
                            {requestedSort === 'asc' && <ChevronUp className="h-3.5 w-3.5 text-primary" aria-hidden />}
                            {requestedSort === 'desc' && <ChevronDown className="h-3.5 w-3.5 text-primary" aria-hidden />}
                            {requestedSort === null && <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />}
                          </button>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right">Previsto</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Real</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Dif.</TableHead>
                        <TableHead className="whitespace-nowrap">Pagamento</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedForList.map((p) => {
                        const hasBoth = p.estimated_cost != null && p.actual_cost != null;
                        const diff = hasBoth ? p.estimated_cost! - p.actual_cost! : null;
                        const expanded = expandedRows.has(p.id);
                        const hasDetails = !!(p.description || p.quantity || p.delivery_address || p.notes || p.category || p.supplier_name);
                        return (
                          <Fragment key={p.id}>
                            <TableRow className={cn('hover:bg-muted/30 transition-colors', expanded && 'bg-muted/20')}>
                              {/* expand */}
                              <TableCell className="w-8 text-center">
                                {hasDetails ? (
                                  <button type="button" onClick={() => toggleRow(p.id)}
                                    className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  </button>
                                ) : <span className="inline-block w-5" />}
                              </TableCell>

                              <TableCell className="font-medium whitespace-nowrap">
                                <DateCell value={p.planned_purchase_date}
                                  onSave={(v) => updateDateField.mutate({ id: p.id, field: 'planned_purchase_date', value: v })} />
                              </TableCell>

                              <TableCell className="whitespace-nowrap max-w-[160px]">
                                <Badge variant="outline" className="text-[10px] truncate max-w-full inline-block font-normal">
                                  {p.project_name}
                                </Badge>
                              </TableCell>

                              <TableCell className="max-w-[200px]">
                                <p className="font-medium truncate" title={p.item_name}>{p.item_name}</p>
                              </TableCell>

                              <TableCell className={cn(
                                'text-muted-foreground whitespace-nowrap text-xs tabular-nums',
                                !p.created_at && 'italic',
                              )}>
                                {fmtRequestedDate(p.created_at)}
                              </TableCell>

                              <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtCompact(p.estimated_cost)}</TableCell>

                              <TableCell className="text-right whitespace-nowrap tabular-nums">
                                <ActualCostCell purchase={p} onSave={(id, v) => updateActualCost.mutate({ id, value: v })} />
                              </TableCell>

                              <TableCell className={cn('text-right whitespace-nowrap tabular-nums font-medium',
                                diff == null && 'text-muted-foreground',
                                diff != null && diff >= 0 && 'text-emerald-600',
                                diff != null && diff < 0 && 'text-red-600',
                              )}>
                                {diff == null ? '—' : fmtDiff(diff)}
                              </TableCell>

                              <TableCell className="whitespace-nowrap">
                                <DateCell value={p.payment_due_date}
                                  onSave={(v) => updateDateField.mutate({ id: p.id, field: 'payment_due_date', value: v })} />
                              </TableCell>

                              <TableCell className="whitespace-nowrap">
                                <StatusCell purchase={p} onSave={(id, v) => updateStatus.mutate({ id, value: v })} />
                              </TableCell>
                            </TableRow>

                            {/* Expanded detail row */}
                            {expanded && hasDetails && (
                              <TableRow className="bg-muted/10 hover:bg-muted/10">
                                <TableCell colSpan={10} className="p-0">
                                  <PurchaseRowDetail p={p} />
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                      {sortedForList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                            Nenhuma compra agendada encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* ── List view: Sem data ── */}
              {withoutDate.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-muted-foreground">
                      Sem Data Definida <span className="font-normal text-sm">({withoutDate.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <Table className="text-xs [&_th]:px-3 [&_td]:px-3 [&_th]:h-9 [&_td]:py-2">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-8" />
                          <TableHead className="whitespace-nowrap">Obra</TableHead>
                          <TableHead className="whitespace-nowrap">Item</TableHead>
                          <TableHead className="whitespace-nowrap p-0">
                            <button
                              type="button"
                              onClick={toggleRequestedSort}
                              aria-label={`Ordenar por solicitada em${requestedSort ? ` (${requestedSort === 'asc' ? 'ascendente' : 'descendente'})` : ''}`}
                              aria-sort={requestedSort === 'asc' ? 'ascending' : requestedSort === 'desc' ? 'descending' : 'none'}
                              className={cn(
                                'flex h-9 w-full items-center gap-1 px-3 text-left font-medium whitespace-nowrap',
                                'hover:bg-muted/60 hover:text-foreground transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                                requestedSort && 'text-foreground bg-muted/40',
                              )}
                            >
                              Solicitada em
                              {requestedSort === 'asc' && <ChevronUp className="h-3.5 w-3.5 text-primary" aria-hidden />}
                              {requestedSort === 'desc' && <ChevronDown className="h-3.5 w-3.5 text-primary" aria-hidden />}
                              {requestedSort === null && <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />}
                            </button>
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">Previsto</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Real</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Dif.</TableHead>
                          <TableHead className="whitespace-nowrap">Pagamento</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withoutDate.map((p) => {
                          const hasBoth = p.estimated_cost != null && p.actual_cost != null;
                          const diff = hasBoth ? p.estimated_cost! - p.actual_cost! : null;
                          const expanded = expandedRows.has(p.id);
                          const hasDetails = !!(p.description || p.quantity || p.delivery_address || p.notes || p.category || p.supplier_name);
                          return (
                            <Fragment key={p.id}>
                              <TableRow className={cn('hover:bg-muted/30', expanded && 'bg-muted/20')}>
                                <TableCell className="w-8 text-center">
                                  {hasDetails ? (
                                    <button type="button" onClick={() => toggleRow(p.id)}
                                      className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </button>
                                  ) : <span className="inline-block w-5" />}
                                </TableCell>
                                <TableCell className="whitespace-nowrap max-w-[160px]">
                                  <Badge variant="outline" className="text-[10px] truncate max-w-full inline-block font-normal">{p.project_name}</Badge>
                                </TableCell>
                                <TableCell className="max-w-[200px]"><p className="font-medium truncate" title={p.item_name}>{p.item_name}</p></TableCell>
                                <TableCell className={cn(
                                  'text-muted-foreground whitespace-nowrap text-xs tabular-nums',
                                  !p.created_at && 'italic',
                                )}>
                                  {fmtRequestedDate(p.created_at)}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtCompact(p.estimated_cost)}</TableCell>
                                <TableCell className="text-right whitespace-nowrap tabular-nums">
                                  <ActualCostCell purchase={p} onSave={(id, v) => updateActualCost.mutate({ id, value: v })} />
                                </TableCell>
                                <TableCell className={cn('text-right whitespace-nowrap tabular-nums font-medium',
                                  diff == null && 'text-muted-foreground',
                                  diff != null && diff >= 0 && 'text-emerald-600',
                                  diff != null && diff < 0 && 'text-red-600',
                                )}>{diff == null ? '—' : fmtDiff(diff)}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <DateCell value={p.payment_due_date}
                                    onSave={(v) => updateDateField.mutate({ id: p.id, field: 'payment_due_date', value: v })} />
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <StatusCell purchase={p} onSave={(id, v) => updateStatus.mutate({ id, value: v })} />
                                </TableCell>
                              </TableRow>
                              {expanded && hasDetails && (
                                <TableRow className="bg-muted/10 hover:bg-muted/10">
                                  <TableCell colSpan={9} className="p-0">
                                    <PurchaseRowDetail p={p} />
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </PageContainer>
      </div>
    </div>
  );
}
