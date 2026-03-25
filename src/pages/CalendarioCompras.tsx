import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import type { ProjectPurchase, PurchaseStatus } from '@/hooks/useProjectPurchases';
import { statusConfig } from '@/pages/compras/types';

interface PurchaseWithProject extends ProjectPurchase {
  project_name: string;
}

const fmt = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export default function CalendarioCompras() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');

  // Fetch all purchases across all projects with project names
  const { data: allPurchases = [], isLoading } = useQuery({
    queryKey: ['all-purchases-calendar'],
    queryFn: async () => {
      const { data: purchases, error } = await supabase
        .from('project_purchases')
        .select('*')
        .order('planned_purchase_date', { ascending: true });

      if (error) throw error;

      // Fetch project names
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

  // Get unique projects for filter
  const projects = useMemo(() => {
    const map = new Map<string, string>();
    allPurchases.forEach(p => map.set(p.project_id, p.project_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allPurchases]);

  // Filter purchases
  const filtered = useMemo(() => {
    return allPurchases.filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterProject !== 'all' && p.project_id !== filterProject) return false;
      return true;
    });
  }, [allPurchases, filterStatus, filterProject]);

  // Group by date for calendar view
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

  // Sort for list view by planned_purchase_date
  const sortedForList = useMemo(() => {
    return [...filtered]
      .filter(p => p.planned_purchase_date)
      .sort((a, b) => (a.planned_purchase_date || '').localeCompare(b.planned_purchase_date || ''));
  }, [filtered]);

  const withoutDate = useMemo(() => filtered.filter(p => !p.planned_purchase_date), [filtered]);

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // KPIs
  const totalItems = filtered.length;
  const pendingItems = filtered.filter(p => p.status === 'pending').length;
  const thisMonthItems = filtered.filter(p => {
    if (!p.planned_purchase_date) return false;
    return isSameMonth(parseISO(p.planned_purchase_date), currentMonth);
  }).length;
  const totalEstimated = filtered.reduce((s, p) => s + (p.estimated_cost || 0), 0);

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total de Itens</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">{pendingItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Este Mês</p>
                <p className="text-2xl font-bold">{thisMonthItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Estimado</p>
                <p className="text-xl font-bold">{fmt(totalEstimated)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters & View Toggle */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="ordered">Pedido</SelectItem>
                    <SelectItem value="in_transit">Em Trânsito</SelectItem>
                    <SelectItem value="delivered">Concluído</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterProject} onValueChange={setFilterProject}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Obra" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as obras</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto flex gap-1">
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
                  {/* Empty cells for days before month start */}
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
                          {dayPurchases.slice(0, 3).map(p => (
                            <div
                              key={p.id}
                              className={cn(
                                'text-[10px] leading-tight rounded px-1 py-0.5 truncate cursor-default',
                                p.status === 'pending' && 'bg-amber-100 text-amber-800',
                                p.status === 'ordered' && 'bg-blue-100 text-blue-800',
                                p.status === 'delivered' && 'bg-green-100 text-green-800',
                                p.status === 'in_transit' && 'bg-purple-100 text-purple-800',
                              )}
                              title={`${p.project_name} — ${p.item_name}`}
                            >
                              {p.item_name}
                            </div>
                          ))}
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Compra</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Custo Previsto</TableHead>
                        <TableHead>Custo Real</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedForList.map(p => {
                        const config = statusConfig[p.status as PurchaseStatus];
                        const StatusIcon = config?.icon;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium text-sm whitespace-nowrap">
                              {p.planned_purchase_date ? format(parseISO(p.planned_purchase_date), 'dd/MM/yyyy') : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                {p.project_name}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.category || '—'}</TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{p.item_name}</p>
                              {p.description && <p className="text-xs text-muted-foreground truncate max-w-40">{p.description}</p>}
                            </TableCell>
                            <TableCell className="text-sm">{p.supplier_name || '—'}</TableCell>
                            <TableCell className="text-sm">{fmt(p.estimated_cost)}</TableCell>
                            <TableCell className="text-sm">{fmt(p.actual_cost)}</TableCell>
                            <TableCell>
                              {config && StatusIcon && (
                                <Badge className={cn('gap-1', config.color)}>
                                  <StatusIcon className="h-3 w-3" />
                                  {config.label}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {sortedForList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Obra</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Custo Previsto</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withoutDate.map(p => {
                          const config = statusConfig[p.status as PurchaseStatus];
                          const StatusIcon = config?.icon;
                          return (
                            <TableRow key={p.id}>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{p.project_name}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{p.category || '—'}</TableCell>
                              <TableCell className="text-sm font-medium">{p.item_name}</TableCell>
                              <TableCell className="text-sm">{p.supplier_name || '—'}</TableCell>
                              <TableCell className="text-sm">{fmt(p.estimated_cost)}</TableCell>
                              <TableCell>
                                {config && StatusIcon && (
                                  <Badge className={cn('gap-1', config.color)}>
                                    <StatusIcon className="h-3 w-3" />
                                    {config.label}
                                  </Badge>
                                )}
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
