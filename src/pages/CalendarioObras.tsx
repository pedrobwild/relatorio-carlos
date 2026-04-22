import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckCircle2,
  PlayCircle,
  RotateCcw,
  ExternalLink,
  Filter,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getProjectColor } from '@/lib/taskUtils';
import { useWeekActivities, type WeekActivity } from '@/hooks/useWeekActivities';
import { EmptyState } from '@/components/ui/states';
import { ActivityDetailDialog } from '@/components/calendar/ActivityDetailDialog';
import { CalendarMonthGrid } from '@/components/calendar/CalendarMonthGrid';
import { CalendarDayAgenda } from '@/components/calendar/CalendarDayAgenda';
import { CalendarRangeTimeline } from '@/components/calendar/CalendarRangeTimeline';

type ViewMode = 'month' | 'week' | 'day' | 'range';

function getActivityStatus(a: WeekActivity, today: Date) {
  if (a.actual_end) return 'completed' as const;
  if (a.actual_start) return 'in_progress' as const;
  const plannedStart = parseISO(a.planned_start);
  if (today > plannedStart) return 'overdue' as const;
  return 'pending' as const;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  completed: { label: 'Concluída', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
  in_progress: { label: 'Em andamento', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  overdue: { label: 'Atrasada', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  pending: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
};

export default function CalendarioObras() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<ViewMode>('week');
  const [refDate, setRefDate] = useState<Date>(today);
  const [rangeStartDate, setRangeStartDate] = useState<Date>(today);
  const [rangeEndDate, setRangeEndDate] = useState<Date>(addDays(today, 13));
  // Draft (unapplied) selection for the custom range pickers.
  const [draftRangeStart, setDraftRangeStart] = useState<Date>(today);
  const [draftRangeEnd, setDraftRangeEnd] = useState<Date>(addDays(today, 13));
  const [selectedActivity, setSelectedActivity] = useState<WeekActivity | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Range validation (start ≤ end). Used to gate the "Aplicar" button.
  const draftRangeInvalid = draftRangeStart > draftRangeEnd;
  const draftDirty =
    draftRangeStart.getTime() !== rangeStartDate.getTime() ||
    draftRangeEnd.getTime() !== rangeEndDate.getTime();

  const applyDraftRange = () => {
    if (draftRangeInvalid) return;
    setRangeStartDate(draftRangeStart);
    setRangeEndDate(draftRangeEnd);
  };
  const resetDraftRange = () => {
    setDraftRangeStart(rangeStartDate);
    setDraftRangeEnd(rangeEndDate);
  };

  // Compute fetch range based on active view.
  const { fetchStart, fetchEnd, viewStart, viewEnd } = useMemo(() => {
    if (view === 'month') {
      const ms = startOfMonth(refDate);
      const me = endOfMonth(refDate);
      // Fetch the visible grid (Mon..Sun expanded)
      return {
        fetchStart: startOfWeek(ms, { weekStartsOn: 1 }),
        fetchEnd: endOfWeek(me, { weekStartsOn: 1 }),
        viewStart: ms,
        viewEnd: me,
      };
    }
    if (view === 'day') {
      return { fetchStart: refDate, fetchEnd: refDate, viewStart: refDate, viewEnd: refDate };
    }
    if (view === 'range') {
      const s = rangeStartDate <= rangeEndDate ? rangeStartDate : rangeEndDate;
      const e = rangeStartDate <= rangeEndDate ? rangeEndDate : rangeStartDate;
      return { fetchStart: s, fetchEnd: e, viewStart: s, viewEnd: e };
    }
    // week
    const ws = startOfWeek(refDate, { weekStartsOn: 1 });
    const we = endOfWeek(refDate, { weekStartsOn: 1 });
    return { fetchStart: ws, fetchEnd: we, viewStart: ws, viewEnd: we };
  }, [view, refDate, rangeStartDate, rangeEndDate]);

  const fetchStartStr = format(fetchStart, 'yyyy-MM-dd');
  const fetchEndStr = format(fetchEnd, 'yyyy-MM-dd');

  const { byProject, activities, isLoading, updateDates, isUpdating } = useWeekActivities(
    fetchStartStr,
    fetchEndStr,
  );

  // Project options derived from full dataset (so the filter remains stable)
  const projectOptions = useMemo(
    () =>
      byProject
        .map((g) => ({ id: g.project_id, name: g.project_name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [byProject],
  );

  const filteredByProject = useMemo(
    () => (projectFilter === 'all' ? byProject : byProject.filter((g) => g.project_id === projectFilter)),
    [byProject, projectFilter],
  );

  const filteredActivities = useMemo(
    () => filteredByProject.flatMap((g) => g.items),
    [filteredByProject],
  );

  const counts = useMemo(() => {
    const c = { total: filteredActivities.length, completed: 0, in_progress: 0, overdue: 0, pending: 0 };
    for (const a of filteredActivities) {
      const s = getActivityStatus(a, today);
      c[s]++;
    }
    return c;
  }, [filteredActivities, today]);

  const handleStart = async (a: WeekActivity) => {
    await updateDates(a.id, { actual_start: format(today, 'yyyy-MM-dd') });
  };
  const handleFinish = async (a: WeekActivity) => {
    const updates: { actual_start?: string | null; actual_end?: string | null } = {
      actual_end: format(today, 'yyyy-MM-dd'),
    };
    if (!a.actual_start) updates.actual_start = a.planned_start;
    await updateDates(a.id, updates);
  };
  const handleReset = async (a: WeekActivity) => {
    await updateDates(a.id, { actual_start: null, actual_end: null });
  };

  // Navigation per view
  const goPrev = () => {
    if (view === 'month') setRefDate(addMonths(refDate, -1));
    else if (view === 'day') setRefDate(addDays(refDate, -1));
    else if (view === 'range') {
      const span = Math.max(1, Math.round((rangeEndDate.getTime() - rangeStartDate.getTime()) / 86_400_000) + 1);
      const ns = addDays(rangeStartDate, -span);
      const ne = addDays(rangeEndDate, -span);
      setRangeStartDate(ns);
      setRangeEndDate(ne);
      setDraftRangeStart(ns);
      setDraftRangeEnd(ne);
    } else setRefDate(addWeeks(refDate, -1));
  };
  const goNext = () => {
    if (view === 'month') setRefDate(addMonths(refDate, 1));
    else if (view === 'day') setRefDate(addDays(refDate, 1));
    else if (view === 'range') {
      const span = Math.max(1, Math.round((rangeEndDate.getTime() - rangeStartDate.getTime()) / 86_400_000) + 1);
      const ns = addDays(rangeStartDate, span);
      const ne = addDays(rangeEndDate, span);
      setRangeStartDate(ns);
      setRangeEndDate(ne);
      setDraftRangeStart(ns);
      setDraftRangeEnd(ne);
    } else setRefDate(addWeeks(refDate, 1));
  };
  const goToday = () => {
    setRefDate(today);
    if (view === 'range') {
      const ne = addDays(today, 13);
      setRangeStartDate(today);
      setRangeEndDate(ne);
      setDraftRangeStart(today);
      setDraftRangeEnd(ne);
    }
  };

  const periodLabel = useMemo(() => {
    if (view === 'month') return format(refDate, "MMMM 'de' yyyy", { locale: ptBR });
    if (view === 'day') return format(refDate, "EEEE, d 'de' MMM 'de' yyyy", { locale: ptBR });
    if (view === 'range')
      return `${format(viewStart, "d 'de' MMM", { locale: ptBR })} – ${format(viewEnd, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
    return `${format(viewStart, "d 'de' MMM", { locale: ptBR })} – ${format(viewEnd, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
  }, [view, refDate, viewStart, viewEnd]);

  // Capitalize first letter
  const periodLabelCap = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

  return (
    <PageContainer>
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <CalendarDays className="h-4 w-4" />
          <span>Visão de calendário</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Calendário de Obras</h1>
        <p className="text-muted-foreground mt-1">
          Atividades programadas em todas as obras. Alterne entre visões de mês, semana, dia ou período
          personalizado para acompanhar e atualizar o cronograma.
        </p>
      </header>

      {/* View toggle + navigator */}
      <Card className="mb-4">
        <CardContent className="py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="month">Mês</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="day">Dia</TabsTrigger>
                <TabsTrigger value="range">Período</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">Total: {counts.total}</Badge>
              <Badge className={statusBadge.in_progress.className}>Em andamento: {counts.in_progress}</Badge>
              <Badge className={statusBadge.overdue.className}>Atrasadas: {counts.overdue}</Badge>
              <Badge className={statusBadge.pending.className}>Pendentes: {counts.pending}</Badge>
              <Badge className={statusBadge.completed.className}>Concluídas: {counts.completed}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {view !== 'range' ? (
              <>
                <Button variant="outline" size="icon" onClick={goPrev} aria-label="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="font-semibold">
                      <CalendarDays className="h-4 w-4 mr-2" />
                      {periodLabelCap}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={refDate}
                      onSelect={(d) => d && setRefDate(d)}
                      initialFocus
                      locale={ptBR}
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" onClick={goNext} aria-label="Próximo">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={goToday}>
                  Hoje
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" onClick={goPrev} aria-label="Período anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(draftRangeInvalid && 'border-destructive text-destructive')}
                      >
                        <CalendarDays className="h-4 w-4 mr-2" />
                        Início: <strong className="ml-1">{format(draftRangeStart, 'dd/MM/yyyy')}</strong>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={draftRangeStart}
                        onSelect={(d) => d && setDraftRangeStart(d)}
                        initialFocus
                        locale={ptBR}
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground text-sm">→</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(draftRangeInvalid && 'border-destructive text-destructive')}
                      >
                        <CalendarDays className="h-4 w-4 mr-2" />
                        Fim: <strong className="ml-1">{format(draftRangeEnd, 'dd/MM/yyyy')}</strong>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={draftRangeEnd}
                        onSelect={(d) => d && setDraftRangeEnd(d)}
                        initialFocus
                        locale={ptBR}
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>

                  <Button
                    size="sm"
                    onClick={applyDraftRange}
                    disabled={draftRangeInvalid || !draftDirty}
                    title={
                      draftRangeInvalid
                        ? 'A data de início deve ser anterior ou igual à data de fim'
                        : !draftDirty
                          ? 'Nenhuma alteração pendente'
                          : 'Aplicar período selecionado'
                    }
                  >
                    Aplicar
                  </Button>
                  {draftDirty && (
                    <Button variant="ghost" size="sm" onClick={resetDraftRange} title="Descartar alterações">
                      <X className="h-3.5 w-3.5 mr-1" />
                      Resetar
                    </Button>
                  )}

                  <Button variant="outline" size="icon" onClick={goNext} aria-label="Próximo período">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={goToday}>
                    Hoje
                  </Button>
                </div>

                {draftRangeInvalid ? (
                  <p className="text-xs text-destructive">
                    A data de início deve ser anterior ou igual à data de fim.
                  </p>
                ) : draftDirty ? (
                  <p className="text-xs text-muted-foreground">
                    Período selecionado ainda não aplicado — clique em <strong>Aplicar</strong> para
                    atualizar a timeline.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Exibindo {format(rangeStartDate, 'dd/MM/yyyy')} → {format(rangeEndDate, 'dd/MM/yyyy')} (
                    {Math.round((rangeEndDate.getTime() - rangeStartDate.getTime()) / 86_400_000) + 1} dias).
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filtrar por obra:
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[280px]">
            <SelectValue placeholder="Todas as obras" />
          </SelectTrigger>
          <SelectContent position="popper" className="z-50 max-h-72">
            <SelectItem value="all">Todas as obras ({byProject.length})</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {projectFilter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setProjectFilter('all')} className="h-9">
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar filtro
          </Button>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : view === 'month' ? (
        <CalendarMonthGrid
          refDate={refDate}
          activities={filteredActivities}
          onActivityClick={setSelectedActivity}
        />
      ) : view === 'day' ? (
        <CalendarDayAgenda
          day={refDate}
          activities={filteredActivities}
          onActivityClick={setSelectedActivity}
        />
      ) : view === 'range' ? (
        <CalendarRangeTimeline
          rangeStart={viewStart}
          rangeEnd={viewEnd}
          byProject={filteredByProject}
          onActivityClick={setSelectedActivity}
        />
      ) : (
        // Week view (original list)
        <WeekListView
          filteredByProject={filteredByProject}
          today={today}
          weekStart={viewStart}
          weekEnd={viewEnd}
          isUpdating={isUpdating}
          onActivityClick={setSelectedActivity}
          onStart={handleStart}
          onFinish={handleFinish}
          onReset={handleReset}
          onOpenSchedule={(pid) => navigate(`/obra/${pid}/cronograma`)}
          projectFilter={projectFilter}
        />
      )}

      <ActivityDetailDialog
        activity={selectedActivity}
        open={!!selectedActivity}
        onOpenChange={(o) => !o && setSelectedActivity(null)}
        onSave={updateDates}
        isUpdating={isUpdating}
      />
    </PageContainer>
  );
}

// ── Week list view kept here for parity with previous UI ────────────
function WeekListView({
  filteredByProject,
  today,
  weekStart,
  weekEnd,
  isUpdating,
  onActivityClick,
  onStart,
  onFinish,
  onReset,
  onOpenSchedule,
  projectFilter,
}: {
  filteredByProject: { project_id: string; project_name: string; items: WeekActivity[] }[];
  today: Date;
  weekStart: Date;
  weekEnd: Date;
  isUpdating: boolean;
  onActivityClick: (a: WeekActivity) => void;
  onStart: (a: WeekActivity) => void;
  onFinish: (a: WeekActivity) => void;
  onReset: (a: WeekActivity) => void;
  onOpenSchedule: (projectId: string) => void;
  projectFilter: string;
}) {
  if (filteredByProject.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={projectFilter === 'all' ? 'Nenhuma atividade programada' : 'Nenhuma atividade para esta obra'}
        description={
          projectFilter === 'all'
            ? 'Não há atividades planejadas para esta semana em nenhuma obra.'
            : 'Esta obra não possui atividades planejadas para a semana selecionada.'
        }
      />
    );
  }
  const inThisWeek = isWithinInterval(today, { start: weekStart, end: weekEnd });
  return (
    <div className="space-y-4">
      {filteredByProject.map((group) => {
        const color = getProjectColor(group.project_id);
        return (
          <Card key={group.project_id} className={cn('overflow-hidden border-l-4', color.border)}>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('inline-flex items-center justify-center h-7 w-7 rounded-md', color.bg)}>
                    <Building2 className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-base font-semibold truncate">{group.project_name}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {group.items.length} ativ.
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenSchedule(group.project_id)}
                  className="h-7 text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Ver cronograma
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {group.items.map((a) => {
                const status = (() => {
                  if (a.actual_end) return 'completed' as const;
                  if (a.actual_start) return 'in_progress' as const;
                  if (today > parseISO(a.planned_start)) return 'overdue' as const;
                  return 'pending' as const;
                })();
                const sb = statusBadge[status];
                const ps = parseISO(a.planned_start);
                const pe = parseISO(a.planned_end);
                return (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onActivityClick(a)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onActivityClick(a);
                      }
                    }}
                    className="p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer focus:outline-none focus-visible:bg-muted/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{a.description}</span>
                        {a.etapa && (
                          <Badge variant="outline" className="text-[10px]">
                            {a.etapa}
                          </Badge>
                        )}
                        <Badge className={cn('text-[10px]', sb.className)}>{sb.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          Previsto: <strong>{format(ps, 'dd/MM')}</strong> →{' '}
                          <strong>{format(pe, 'dd/MM')}</strong>
                        </span>
                        {a.actual_start && (
                          <span className="text-blue-600">
                            Início real: <strong>{format(parseISO(a.actual_start), 'dd/MM')}</strong>
                          </span>
                        )}
                        {a.actual_end && (
                          <span className="text-green-600">
                            Fim real: <strong>{format(parseISO(a.actual_end), 'dd/MM')}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!a.actual_start && !a.actual_end && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => onStart(a)}
                          title={
                            inThisWeek
                              ? 'Marcar início real como hoje'
                              : 'Marcar início real como hoje (data atual do sistema)'
                          }
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Iniciar
                        </Button>
                      )}
                      {!a.actual_end && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={isUpdating}
                          onClick={() => onFinish(a)}
                          title="Marcar conclusão real como hoje"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Concluir
                        </Button>
                      )}
                      {(a.actual_start || a.actual_end) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isUpdating}
                          onClick={() => onReset(a)}
                          title="Limpar datas reais"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
