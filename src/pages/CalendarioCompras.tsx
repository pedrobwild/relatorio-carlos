/**
 * Calendário de Compras — orquestrador.
 *
 * Compõe os pedaços (`CalendarioComprasFilters`, `CalendarioComprasKpis`,
 * `CalendarMonthView`, `PurchaseListTable`) em torno do estado de filtros,
 * mutations Supabase e ordenação. Lógica de cells, formatters e
 * NewPurchaseDialog vive em `./calendario-compras/`.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isSameMonth, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSkeleton } from '@/components/ui-premium';
import {
  type CalendarStatus,
  type PurchaseWithProject,
  toCalendarStatus,
} from './calendario-compras/types';
import { NewPurchaseDialog } from './calendario-compras/NewPurchaseDialog';
import { CalendarioComprasFilters } from './calendario-compras/CalendarioComprasFilters';
import { CalendarioComprasKpis } from './calendario-compras/CalendarioComprasKpis';
import { CalendarMonthView } from './calendario-compras/CalendarMonthView';
import { PurchaseListTable } from './calendario-compras/PurchaseListTable';

// Re-export para compatibilidade com consumidores externos.
export type { ProjectPurchaseInsert } from './calendario-compras/types';

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        .from('projects')
        .select('id, name')
        .in('id', projectIds);
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
        .from('project_payments')
        .select('id, project_id, amount, paid_at')
        .not('paid_at', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Lista completa de obras (pode incluir projetos sem compras) — usada no
  // dialog de Nova Solicitação.
  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects-for-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] });
      toast.success('Custo real atualizado');
    },
    onError: (e) => {
      console.error(e);
      toast.error('Erro ao atualizar custo real');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: CalendarStatus }) => {
      const { error } = await supabase.from('project_purchases').update({ status: value }).eq('id', id);
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

  const updateDateField = useMutation({
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string;
      field: 'planned_purchase_date' | 'payment_due_date';
      value: string | null;
    }) => {
      const { error } = await supabase.from('project_purchases').update({ [field]: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['all-purchases-calendar'] });
      toast.success(
        vars.field === 'planned_purchase_date'
          ? 'Data da compra atualizada'
          : 'Data de pagamento atualizada',
      );
    },
    onError: (e) => {
      console.error(e);
      toast.error('Erro ao atualizar data');
    },
  });

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    allPurchases.forEach((p) => map.set(p.project_id, p.project_name));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPurchases]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    allPurchases.forEach((p) => {
      if (p.supplier_name?.trim()) set.add(p.supplier_name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allPurchases]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allPurchases.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
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
    filtered.forEach((p) => {
      if (!p.planned_purchase_date) return;
      if (!map.has(p.planned_purchase_date)) map.set(p.planned_purchase_date, []);
      map.get(p.planned_purchase_date)!.push(p);
    });
    return map;
  }, [filtered]);

  // Comparador por created_at — trata nulos sempre por último.
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
    if (requestedSort) return base.sort((a, b) => compareByCreatedAt(a, b, requestedSort));
    return base.sort((a, b) => (a.planned_purchase_date || '').localeCompare(b.planned_purchase_date || ''));
  }, [filtered, requestedSort]);

  const withoutDate = useMemo(() => {
    const base = filtered.filter((p) => !p.planned_purchase_date);
    if (requestedSort) return [...base].sort((a, b) => compareByCreatedAt(a, b, requestedSort));
    return base;
  }, [filtered, requestedSort]);

  // KPIs
  const totalEstimated = filtered.reduce((s, p) => s + (p.estimated_cost || 0), 0);
  const itemsWithBoth = filtered.filter((p) => p.estimated_cost != null && p.actual_cost != null);
  const totalDiff = itemsWithBoth.reduce((s, p) => s + (p.estimated_cost! - p.actual_cost!), 0);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Calendário de Compras" backTo="/gestao" maxWidth="full" showLogo={false} />
        <div className="py-6">
          <PageContainer maxWidth="full">
            <PageSkeleton metrics content="table" />
          </PageContainer>
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
          <CalendarioComprasKpis
            totalItems={filtered.length}
            pendingItems={filtered.filter((p) => toCalendarStatus(p.status) === 'pending').length}
            thisMonthItems={
              filtered.filter(
                (p) => p.planned_purchase_date && isSameMonth(parseISO(p.planned_purchase_date), currentMonth),
              ).length
            }
            totalEstimated={totalEstimated}
            itemsWithBothCount={itemsWithBoth.length}
            totalDiff={totalDiff}
            diffPositive={totalDiff >= 0}
            availableBudget={availableBudget}
            budgetBalance={budgetBalance}
            balancePositive={budgetBalance >= 0}
          />

          <CalendarioComprasFilters
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterProject={filterProject}
            setFilterProject={setFilterProject}
            filterSupplier={filterSupplier}
            setFilterSupplier={setFilterSupplier}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            filterActualCost={filterActualCost}
            setFilterActualCost={setFilterActualCost}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            projects={projects}
            suppliers={suppliers}
            categories={categories}
            activeFilterCount={activeFilterCount}
            clearFilters={clearFilters}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onNew={() => setNewDialogOpen(true)}
          />

          {viewMode === 'calendar' ? (
            <CalendarMonthView
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              purchasesByDate={purchasesByDate}
            />
          ) : (
            <>
              <PurchaseListTable
                title="Compras Agendadas"
                rows={sortedForList}
                withPlannedDate
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                requestedSort={requestedSort}
                toggleRequestedSort={toggleRequestedSort}
                onUpdateActualCost={(id, value) => updateActualCost.mutate({ id, value })}
                onUpdateDateField={(id, field, value) => updateDateField.mutate({ id, field, value })}
                onUpdateStatus={(id, value) => updateStatus.mutate({ id, value })}
                hint="Clique em ▸ para ver detalhes • campos editáveis em linha"
              />

              {withoutDate.length > 0 && (
                <PurchaseListTable
                  title="Sem Data Definida"
                  titleMuted
                  rows={withoutDate}
                  withPlannedDate={false}
                  expandedRows={expandedRows}
                  toggleRow={toggleRow}
                  requestedSort={requestedSort}
                  toggleRequestedSort={toggleRequestedSort}
                  onUpdateActualCost={(id, value) => updateActualCost.mutate({ id, value })}
                  onUpdateDateField={(id, field, value) => updateDateField.mutate({ id, field, value })}
                  onUpdateStatus={(id, value) => updateStatus.mutate({ id, value })}
                />
              )}
            </>
          )}
        </PageContainer>
      </div>
    </div>
  );
}
