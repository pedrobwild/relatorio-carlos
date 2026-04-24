import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Check, X, Pencil, CalendarIcon, FilterX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import type { ProjectPurchase } from '@/hooks/useProjectPurchases';
import { Clock, ThumbsUp, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PurchaseWithProject extends ProjectPurchase {
  project_name: string;
}

// Simplified status set requested for the calendar view.
// "delayed" is a UI-managed status (string stored in the same column).
type CalendarStatus = 'pending' | 'approved' | 'delivered' | 'delayed';

const calendarStatusConfig: Record<CalendarStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: 'Pendente',  color: 'bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30', icon: Clock },
  approved:  { label: 'Aprovado',  color: 'bg-blue-500/20 text-blue-600 border-blue-500/30', icon: ThumbsUp },
  delivered: { label: 'Concluído', color: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30', icon: CheckCircle2 },
  delayed:   { label: 'Atrasado',  color: 'bg-red-500/20 text-red-600 border-red-500/30', icon: AlertTriangle },
};

const CALENDAR_STATUS_OPTIONS: CalendarStatus[] = ['pending', 'approved', 'delivered', 'delayed'];

/** Map any DB status to one of the 4 calendar buckets for display */
function toCalendarStatus(s: string | null | undefined): CalendarStatus {
  if (s === 'approved' || s === 'awaiting_approval' || s === 'purchased' || s === 'ordered' || s === 'in_transit') return 'approved';
  if (s === 'delivered' || s === 'sent_to_site') return 'delivered';
  if (s === 'delayed') return 'delayed';
  return 'pending';
}

// Editable date cell — opens a calendar popover, commits on selection or clear.
function DateCell({
  value,
  onSave,
  placeholder = 'Definir',
}: {
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = format(date, 'yyyy-MM-dd');
    if (iso !== value) onSave(iso);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) onSave(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted whitespace-nowrap',
            !value && 'text-muted-foreground italic',
          )}
          title="Clique para editar"
        >
          {value ? format(parseISO(value), 'dd/MM/yy') : placeholder}
          {value ? (
            <X
              className="h-3 w-3 opacity-0 group-hover:opacity-60 hover:text-destructive transition-opacity"
              onClick={handleClear}
            />
          ) : (
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[200]" align="start">
        <CalendarPicker
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          locale={ptBR}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

function StatusCell({
  purchase,
  onSave,
}: {
  purchase: PurchaseWithProject;
  onSave: (id: string, value: CalendarStatus) => void;
}) {
  const current = toCalendarStatus(purchase.status);
  return (
    <Select value={current} onValueChange={(v) => onSave(purchase.id, v as CalendarStatus)}>
      <SelectTrigger className="h-7 w-[120px] text-[10px] px-2 py-0 gap-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CALENDAR_STATUS_OPTIONS.map((s) => {
          const cfg = calendarStatusConfig[s];
          const Icon = cfg.icon;
          return (
            <SelectItem key={s} value={s} className="text-xs">
              <span className="inline-flex items-center gap-1.5">
                <Icon className="h-3 w-3" />
                {cfg.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

const fmt = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

// Compact format used inside table cells (R$ 1.500)
const fmtCompact = (v: number | null) =>
  v != null
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—';

// Signed compact format for differences ("+R$ 200" / "-R$ 150")
const fmtDiff = (v: number) => {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const abs = Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return `${sign}${abs}`;
};

// Editable currency cell — uses raw number input, commits on blur/Enter.
function ActualCostCell({
  purchase,
  onSave,
}: {
  purchase: PurchaseWithProject;
  onSave: (id: string, value: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(
    purchase.actual_cost != null ? String(purchase.actual_cost) : '',
  );

  useEffect(() => {
    setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : '');
  }, [purchase.actual_cost]);

  const commit = () => {
    const trimmed = value.trim().replace(',', '.');
    const num = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && (isNaN(num as number) || (num as number) < 0)) {
      toast.error('Valor inválido');
      setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : '');
      setEditing(false);
      return;
    }
    if (num !== purchase.actual_cost) onSave(purchase.id, num);
    setEditing(false);
  };

  const cancel = () => {
    setValue(purchase.actual_cost != null ? String(purchase.actual_cost) : '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={commit}
          className="h-7 w-24 text-xs px-2"
        />
        <Button size="icon" variant="ghost" className="h-6 w-6" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onMouseDown={(e) => e.preventDefault()} onClick={cancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted whitespace-nowrap"
      title="Clique para editar"
    >
      <span className={cn(purchase.actual_cost == null && 'text-muted-foreground italic')}>
        {purchase.actual_cost != null ? fmtCompact(purchase.actual_cost) : 'Adicionar'}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

export default function CalendarioCompras() {
  const navigate = useNavigate();
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

  // Fetch all purchases across all projects with project names
  const { data: allPurchases = [], isLoading } = useQuery({
    queryKey: ['all-purchases-calendar'],
    queryFn: async () => {
      const { data: purchases, error } = await supabase
        .from('project_purchases')
        .select('*')
        .order('planned_purchase_date', { ascending: true });

      if (error) throw error;

      const projectIds = [...new Set((purchases || []).map(p => p.project_id))];
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);

      const projectMap = new Map((projects || []).map(p => [p.id, p.name]));

      return (purchases || []).map(p => ({
        ...p,
        project_name: projectMap.get(p.project_id) || 'Projeto',
      })) as PurchaseWithProject[];
    },
    staleTime: 60_000,
  });

  // Fetch paid payments across all projects (used for "available budget" KPI)
  const { data: allPayments = [] } = useQuery({
    queryKey: ['all-payments-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_payments')
        .select('id, project_id, amount, paid_at')
        .not('paid_at', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Mutation: update actual_cost inline
  const updateActualCost = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number | null }) => {
      const { error } = await supabase
        .from('project_purchases')
        .update({ actual_cost: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] });
      toast.success('Custo real atualizado');
    },
    onError: (e) => {
      console.error(e);
      toast.error('Erro ao atualizar custo real');
    },
  });

  // Mutation: update status inline
  const updateStatus = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: CalendarStatus }) => {
      const { error } = await supabase
        .from('project_purchases')
        .update({ status: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] });
      toast.success('Status atualizado');
    },
    onError: (e) => {
      console.error(e);
      toast.error('Erro ao atualizar status');
    },
  });

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    allPurchases.forEach(p => map.set(p.project_id, p.project_name));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPurchases]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    allPurchases.forEach(p => {
      if (p.supplier_name && p.supplier_name.trim()) set.add(p.supplier_name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allPurchases]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allPurchases.forEach(p => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allPurchases]);

  const dateFromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : null;
  const dateToStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : null;

  const filtered = useMemo(() => {
    return allPurchases.filter(p => {
      if (filterStatus !== 'all' && toCalendarStatus(p.status) !== filterStatus) return false;
      if (filterProject !== 'all' && p.project_id !== filterProject) return false;
      if (filterSupplier !== 'all' && (p.supplier_name || '') !== filterSupplier) return false;
      if (filterCategory !== 'all' && (p.category || '') !== filterCategory) return false;
      if (filterActualCost === 'informed' && (p.actual_cost == null)) return false;
      if (filterActualCost === 'pending' && (p.actual_cost != null)) return false;
      // Period filter applies only to items with a planned_purchase_date.
      // Items without date are excluded when a period is active.
      if (dateFromStr || dateToStr) {
        if (!p.planned_purchase_date) return false;
        if (dateFromStr && p.planned_purchase_date < dateFromStr) return false;
        if (dateToStr && p.planned_purchase_date > dateToStr) return false;
      }
      return true;
    });
  }, [allPurchases, filterStatus, filterProject, filterSupplier, filterCategory, filterActualCost, dateFromStr, dateToStr]);

  const activeFilterCount =
    (filterStatus !== 'all' ? 1 : 0) +
    (filterProject !== 'all' ? 1 : 0) +
    (filterSupplier !== 'all' ? 1 : 0) +
    (filterCategory !== 'all' ? 1 : 0) +
    (filterActualCost !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterProject('all');
    setFilterSupplier('all');
    setFilterCategory('all');
    setFilterActualCost('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const purchasesByDate = useMemo(() => {
    const map = new Map<string, PurchaseWithProject[]>();
    filtered.forEach(p => {
      const date = p.planned_purchase_date;
      if (!date) return;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(p);
    });
    return map;
  }, [filtered]);

  const sortedForList = useMemo(() => {
    return [...filtered]
      .filter(p => p.planned_purchase_date)
      .sort((a, b) => (a.planned_purchase_date || '').localeCompare(b.planned_purchase_date || ''));
  }, [filtered]);

  const withoutDate = useMemo(() => filtered.filter(p => !p.planned_purchase_date), [filtered]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // KPIs
  const totalItems = filtered.length;
  const pendingItems = filtered.filter(p => toCalendarStatus(p.status) === 'pending').length;
  const thisMonthItems = filtered.filter(p => {
    if (!p.planned_purchase_date) return false;
    return isSameMonth(parseISO(p.planned_purchase_date), currentMonth);
  }).length;
  const totalEstimated = filtered.reduce((s, p) => s + (p.estimated_cost || 0), 0);
  // Difference summary considers only items with both values informed
  const itemsWithBoth = filtered.filter(p => p.estimated_cost != null && p.actual_cost != null);
  const totalEstimatedWithBoth = itemsWithBoth.reduce((s, p) => s + (p.estimated_cost || 0), 0);
  const totalActualWithBoth = itemsWithBoth.reduce((s, p) => s + (p.actual_cost || 0), 0);
  // Positive = saved money (estimated > actual)
  const totalDiff = totalEstimatedWithBoth - totalActualWithBoth;
  const diffPositive = totalDiff >= 0;

  // Available budget: sum of payments received from clients of the projects shown,
  // restricted to the same period filter (when active). Project filter also applies.
  const availableBudget = useMemo(() => {
    const projectIdSet = new Set(filtered.map(p => p.project_id));
    return allPayments.reduce((sum, pay) => {
      if (!pay.paid_at) return sum;
      // Restrict to projects currently in the filtered view
      if (projectIdSet.size > 0 && !projectIdSet.has(pay.project_id)) return sum;
      // If a single project filter is active but no purchases match, still respect the project
      if (filterProject !== 'all' && pay.project_id !== filterProject) return sum;
      // Apply period filter to paid_at
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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Calendário de Compras"
        backTo="/gestao"
        maxWidth="full"
        showLogo={false}
        breadcrumbs={[
          { label: 'Gestão', href: '/gestao' },
          { label: 'Calendário de Compras' },
        ]}
      />
      <div className="py-6">
        <PageContainer maxWidth="full" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground whitespace-nowrap">Total de Itens</p>
                <p className="text-2xl font-bold tabular-nums">{totalItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground whitespace-nowrap">Pendentes</p>
                <p className="text-2xl font-bold tabular-nums text-amber-600">{pendingItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground whitespace-nowrap">Este Mês</p>
                <p className="text-2xl font-bold tabular-nums">{thisMonthItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground whitespace-nowrap">Total Estimado</p>
                <p className="text-xl font-bold tabular-nums whitespace-nowrap">{fmt(totalEstimated)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  Diferença <span className="text-[10px]">({itemsWithBoth.length})</span>
                </p>
                <p
                  className={cn(
                    'text-xl font-bold tabular-nums whitespace-nowrap',
                    diffPositive ? 'text-emerald-600' : 'text-red-600',
                  )}
                >
                  {itemsWithBoth.length === 0 ? '—' : fmtDiff(totalDiff)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p
                  className="text-xs text-muted-foreground whitespace-nowrap"
                  title="Soma dos pagamentos recebidos dos clientes das obras filtradas (no período, se selecionado)"
                >
                  Orçamento Disponível
                </p>
                <p className="text-xl font-bold tabular-nums whitespace-nowrap text-emerald-600">
                  {fmt(availableBudget)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p
                  className="text-xs text-muted-foreground whitespace-nowrap"
                  title="Disponível − Total Estimado"
                >
                  Saldo
                </p>
                <p
                  className={cn(
                    'text-xl font-bold tabular-nums whitespace-nowrap',
                    balancePositive ? 'text-emerald-600' : 'text-red-600',
                  )}
                >
                  {fmtDiff(budgetBalance)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters & View Toggle */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                {/* Period: From */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'w-36 justify-start text-left font-normal',
                          !dateFrom && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Início'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        locale={ptBR}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Period: To */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'w-36 justify-start text-left font-normal',
                          !dateTo && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Fim'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        locale={ptBR}
                        disabled={(date) => (dateFrom ? date < dateFrom : false)}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="approved">Aprovado</SelectItem>
                      <SelectItem value="delivered">Concluído</SelectItem>
                      <SelectItem value="delayed">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Project */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Obra</Label>
                  <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Obra" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as obras</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Supplier */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                  <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                    <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos fornecedores</SelectItem>
                      {suppliers.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custo Real status */}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Custo Real</Label>
                  <Select
                    value={filterActualCost}
                    onValueChange={(v) => setFilterActualCost(v as 'all' | 'informed' | 'pending')}
                  >
                    <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Custo Real" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="informed">Informado</SelectItem>
                      <SelectItem value="pending">Não informado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear filters */}
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground">
                    <FilterX className="h-3.5 w-3.5 mr-1" />
                    Limpar ({activeFilterCount})
                  </Button>
                )}

                <div className="ml-auto flex gap-1 self-end">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    Lista
                  </Button>
                  <Button
                    variant={viewMode === 'calendar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('calendar')}
                  >
                    <Calendar className="h-4 w-4 mr-1" /> Calendário
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {viewMode === 'calendar' ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                    <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
                  ))}
                  {days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayPurchases = purchasesByDate.get(dateStr) || [];
                    const isToday = isSameDay(day, new Date());
                    const weekend = isWeekend(day);

                    return (
                      <div
                        key={dateStr}
                        className={cn(
                          'bg-background p-1.5 min-h-[80px] text-xs',
                          isToday && 'ring-2 ring-primary ring-inset',
                          weekend && 'bg-muted/50',
                        )}
                      >
                        <span className={cn('font-medium', isToday && 'text-primary')}>{format(day, 'd')}</span>
                        <div className="mt-1 space-y-0.5">
                          {dayPurchases.slice(0, 3).map(p => {
                            const cs = toCalendarStatus(p.status);
                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  'text-[10px] leading-tight rounded px-1 py-0.5 truncate cursor-default',
                                  cs === 'pending' && 'bg-amber-100 text-amber-800',
                                  cs === 'approved' && 'bg-blue-100 text-blue-800',
                                  cs === 'delivered' && 'bg-green-100 text-green-800',
                                  cs === 'delayed' && 'bg-red-100 text-red-800',
                                )}
                                title={`${p.project_name} — ${p.item_name}`}
                              >
                                {p.item_name}
                              </div>
                            );
                          })}
                          {dayPurchases.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{dayPurchases.length - 3}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Compras Agendadas ({sortedForList.length})</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table className="text-xs [&_th]:px-2 [&_td]:px-2 [&_th]:h-9 [&_td]:py-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Data</TableHead>
                        <TableHead className="whitespace-nowrap">Obra</TableHead>
                        <TableHead className="whitespace-nowrap">Categoria</TableHead>
                        <TableHead className="whitespace-nowrap">Item</TableHead>
                        <TableHead className="whitespace-nowrap">Fornecedor</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Previsto</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Real</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Diferença</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedForList.map(p => {
                        const hasBoth = p.estimated_cost != null && p.actual_cost != null;
                        const diff = hasBoth ? (p.estimated_cost! - p.actual_cost!) : null;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {p.planned_purchase_date ? format(parseISO(p.planned_purchase_date), 'dd/MM/yy') : '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap max-w-[140px]">
                              <Badge variant="outline" className="text-[10px] truncate max-w-full inline-block">
                                {p.project_name}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap max-w-[120px] truncate">
                              {p.category || '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap max-w-[180px]">
                              <p className="font-medium truncate" title={p.item_name}>{p.item_name}</p>
                            </TableCell>
                            <TableCell className="whitespace-nowrap max-w-[120px] truncate" title={p.supplier_name || ''}>
                              {p.supplier_name || '—'}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {fmtCompact(p.estimated_cost)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              <ActualCostCell
                                purchase={p}
                                onSave={(id, value) => updateActualCost.mutate({ id, value })}
                              />
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right whitespace-nowrap tabular-nums font-medium',
                                diff == null && 'text-muted-foreground',
                                diff != null && diff >= 0 && 'text-emerald-600',
                                diff != null && diff < 0 && 'text-red-600',
                              )}
                            >
                              {diff == null ? '—' : fmtDiff(diff)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <StatusCell
                                purchase={p}
                                onSave={(id, value) => updateStatus.mutate({ id, value })}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {sortedForList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            Nenhuma compra agendada encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {withoutDate.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-muted-foreground">
                      Sem Data Definida ({withoutDate.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table className="text-xs [&_th]:px-2 [&_td]:px-2 [&_th]:h-9 [&_td]:py-2">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Obra</TableHead>
                          <TableHead className="whitespace-nowrap">Categoria</TableHead>
                          <TableHead className="whitespace-nowrap">Item</TableHead>
                          <TableHead className="whitespace-nowrap">Fornecedor</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Previsto</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Real</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Diferença</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withoutDate.map(p => {
                          const hasBoth = p.estimated_cost != null && p.actual_cost != null;
                          const diff = hasBoth ? (p.estimated_cost! - p.actual_cost!) : null;
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="whitespace-nowrap max-w-[140px]">
                                <Badge variant="outline" className="text-[10px] truncate max-w-full inline-block">
                                  {p.project_name}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap max-w-[120px] truncate">
                                {p.category || '—'}
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap max-w-[180px] truncate" title={p.item_name}>
                                {p.item_name}
                              </TableCell>
                              <TableCell className="whitespace-nowrap max-w-[120px] truncate" title={p.supplier_name || ''}>
                                {p.supplier_name || '—'}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap tabular-nums">
                                {fmtCompact(p.estimated_cost)}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap tabular-nums">
                                <ActualCostCell
                                  purchase={p}
                                  onSave={(id, value) => updateActualCost.mutate({ id, value })}
                                />
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right whitespace-nowrap tabular-nums font-medium',
                                  diff == null && 'text-muted-foreground',
                                  diff != null && diff >= 0 && 'text-emerald-600',
                                  diff != null && diff < 0 && 'text-red-600',
                                )}
                              >
                                {diff == null ? '—' : fmtDiff(diff)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <StatusCell
                                  purchase={p}
                                  onSave={(id, value) => updateStatus.mutate({ id, value })}
                                />
                              </TableCell>
                            </TableRow>
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
