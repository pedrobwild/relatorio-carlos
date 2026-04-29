import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckCircle2,
  PlayCircle,
  RotateCcw,
  ExternalLink,
  Filter,
  X,
  ShoppingCart,
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getProjectColor } from '@/lib/taskUtils';
import { useWeekActivities, type WeekActivity } from '@/hooks/useWeekActivities';
import { useProjectsWithOverduePrevious } from '@/hooks/useProjectsWithOverduePrevious';
import { usePurchasesByCreationRange } from '@/hooks/usePurchasesByCreationRange';
import { useUserRole } from '@/hooks/useUserRole';
import { EmptyState } from '@/components/ui/states';
import { ActivityDetailDialog } from '@/components/calendar/ActivityDetailDialog';
import { BreakActivityDialog } from '@/components/calendar/BreakActivityDialog';
import { CalendarMonthGrid } from '@/components/calendar/CalendarMonthGrid';
import { CalendarDayAgenda } from '@/components/calendar/CalendarDayAgenda';
import { CalendarRangeTimeline } from '@/components/calendar/CalendarRangeTimeline';
import { NonWorkingDaysDialog } from '@/components/calendar/NonWorkingDaysDialog';

type ViewMode = 'month' | 'week-list' | 'week-timeline' | 'day' | 'range';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, hasRole } = useUserRole();
  // Apenas Admin e Engenheiro podem criar/ver micro-etapas internas no Calendário.
  const canBreak = isAdmin || hasRole('engineer');
  const today = useMemo(() => new Date(), []);

  // ── Restauração da visualização e datas a partir da query string ────────
  // Mantemos `view`, `date` (refDate), `from`/`to` (range) na URL para que ao
  // recarregar ou compartilhar o link, o usuário caia exatamente no mesmo
  // recorte temporal que estava vendo.
  const parseDateParam = (raw: string | null, fallback: Date): Date => {
    if (!raw) return fallback;
    // Aceita YYYY-MM-DD; date-fns parseISO trata corretamente.
    try {
      const d = parseISO(raw);
      if (isNaN(d.getTime())) return fallback;
      return d;
    } catch {
      return fallback;
    }
  };
  const isViewMode = (v: string | null): v is ViewMode =>
    v === 'month' || v === 'week-list' || v === 'week-timeline' || v === 'day' || v === 'range';

  const initialView: ViewMode = isViewMode(searchParams.get('view'))
    ? (searchParams.get('view') as ViewMode)
    : 'week-timeline';
  const initialRefDate = parseDateParam(searchParams.get('date'), today);
  const initialRangeStart = parseDateParam(searchParams.get('from'), today);
  const initialRangeEnd = parseDateParam(searchParams.get('to'), addDays(today, 13));

  const [view, setView] = useState<ViewMode>(initialView);
  const [refDate, setRefDate] = useState<Date>(initialRefDate);
  const [rangeStartDate, setRangeStartDate] = useState<Date>(initialRangeStart);
  const [rangeEndDate, setRangeEndDate] = useState<Date>(initialRangeEnd);
  // Draft (unapplied) selection for the custom range pickers.
  const [draftRangeStart, setDraftRangeStart] = useState<Date>(initialRangeStart);
  const [draftRangeEnd, setDraftRangeEnd] = useState<Date>(initialRangeEnd);
  const [selectedActivity, setSelectedActivity] = useState<WeekActivity | null>(null);
  const [breakingActivity, setBreakingActivity] = useState<WeekActivity | null>(null);
  // Filtros persistidos via query string (?obra=, ?etapa=, ?concluidas=1) para que
  // ao compartilhar a URL ou recarregar a página o mesmo recorte seja restaurado.
  const [projectFilter, setProjectFilter] = useState<string>(
    () => searchParams.get('obra') || 'all',
  );
  // Filtro por etapa do cronograma (project_activities.etapa). 'all' inclui tudo,
  // '__none__' representa atividades sem etapa preenchida.
  const [etapaFilter, setEtapaFilter] = useState<string>(
    () => searchParams.get('etapa') || 'all',
  );
  // Por padrão, ocultamos atividades de obras já concluídas para focar no que está em andamento.
  // O usuário pode reativar via toggle "Incluir concluídas" na barra de filtros.
  const [includeCompleted, setIncludeCompleted] = useState<boolean>(
    () => searchParams.get('concluidas') === '1',
  );
  // Filtro (somente week-timeline + staff): mostrar apenas micro-etapas, ou seja,
  // atividades-mãe que já foram quebradas em sub-atividades. Útil para focar no
  // detalhamento granular de execução. Persistido via ?microetapas=1.
  const [onlyMicroSteps, setOnlyMicroSteps] = useState<boolean>(
    () => searchParams.get('microetapas') === '1',
  );

  // Sincroniza os filtros + visualização atuais para a query string. Usamos
  // `replace` para não poluir o histórico de navegação a cada toggle e
  // preservamos quaisquer outros parâmetros existentes na URL. Persistimos:
  //   - obra / etapa / concluidas → filtros do recorte
  //   - view                      → modo de visualização ativo
  //   - date                      → data de referência (mês/semana/dia)
  //   - from / to                 → período personalizado (modo "range")
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (projectFilter && projectFilter !== 'all') next.set('obra', projectFilter);
    else next.delete('obra');
    if (etapaFilter && etapaFilter !== 'all') next.set('etapa', etapaFilter);
    else next.delete('etapa');
    if (includeCompleted) next.set('concluidas', '1');
    else next.delete('concluidas');
    if (onlyMicroSteps && view === 'week-timeline') next.set('microetapas', '1');
    else next.delete('microetapas');

    // Visualização: só persiste se diferente do default ('week-timeline') para manter URLs limpas.
    if (view && view !== 'week-timeline') next.set('view', view);
    else next.delete('view');

    // Datas: only persist when the user actually navigated away from "today"
    // / default range. Comparamos pelo formato YYYY-MM-DD para evitar ruído
    // de horários (today guardado no estado é um Date com hora atual).
    const todayStr = format(today, 'yyyy-MM-dd');
    if (view === 'range') {
      next.delete('date');
      const fromStr = format(rangeStartDate, 'yyyy-MM-dd');
      const toStr = format(rangeEndDate, 'yyyy-MM-dd');
      const defaultTo = format(addDays(today, 13), 'yyyy-MM-dd');
      if (fromStr !== todayStr || toStr !== defaultTo) {
        next.set('from', fromStr);
        next.set('to', toStr);
      } else {
        next.delete('from');
        next.delete('to');
      }
    } else {
      next.delete('from');
      next.delete('to');
      const dateStr = format(refDate, 'yyyy-MM-dd');
      if (dateStr !== todayStr) next.set('date', dateStr);
      else next.delete('date');
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter, etapaFilter, includeCompleted, onlyMicroSteps, view, refDate, rangeStartDate, rangeEndDate]);


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

  const {
    byProject,
    activities,
    isLoading,
    updateDates,
    isUpdating,
    breakIntoSubActivities,
    isBreaking,
    mergeSubActivities,
    isMerging,
  } = useWeekActivities(fetchStartStr, fetchEndStr);

  // Quantidade de micro-etapas (children) já existentes para a atividade-mãe
  // que está sendo editada no BreakActivityDialog. Usado para habilitar a
  // ação "Desfazer quebra" no rodapé do dialog.
  const breakingChildrenCount = useMemo(() => {
    if (!breakingActivity) return 0;
    return activities.filter((a) => a.parent_activity_id === breakingActivity.id).length;
  }, [activities, breakingActivity]);

  // Conjunto de project_ids com etapas anteriores não concluídas (atrasadas)
  // antes do início do recorte visível. Usado para sugerir "Replanejar
  // cronograma" no tooltip do calendário mensal.
  const { data: projectsWithOverduePrev } = useProjectsWithOverduePrevious(fetchStartStr);

  // Solicitações de compra criadas no período visível (data de criação).
  const { purchases, purchasesByDay } = usePurchasesByCreationRange(fetchStartStr, fetchEndStr);

  // Dialog: gerenciamento de dias não úteis (feriados específicos / folgas).
  // Restrito a Admin/Engineer (mesma regra de quebrar atividades).
  const [nonWorkingOpen, setNonWorkingOpen] = useState(false);

  // 1) Aplica o filtro "ocultar obras concluídas" antes de qualquer outra lógica:
  //    obras com project_status === 'completed' só aparecem quando o toggle estiver ativo.
  const visibleByProjectRaw = useMemo(
    () => (includeCompleted ? byProject : byProject.filter((g) => g.project_status !== 'completed')),
    [byProject, includeCompleted],
  );

  // 1.b) Recorte hierárquico das micro-etapas:
  //   - Admin/Engineer enxergam o detalhamento interno: quando uma atividade-mãe
  //     possui pelo menos um child visível neste recorte, ocultamos a mãe e
  //     mostramos apenas os children (que são mais granulares).
  //   - Demais papéis (defesa em profundidade — esta página é restrita a staff)
  //     veem apenas as mães e nunca os children, preservando a visão informativa
  //     compartilhada com o cliente.
  const visibleByProject = useMemo(() => {
    return visibleByProjectRaw.map((g) => {
      if (canBreak) {
        const parentsWithVisibleChildren = new Set<string>();
        for (const a of g.items) {
          if (a.parent_activity_id) parentsWithVisibleChildren.add(a.parent_activity_id);
        }
        return {
          ...g,
          items: g.items.filter(
            (a) => !(a.parent_activity_id === null && parentsWithVisibleChildren.has(a.id)),
          ),
        };
      }
      return { ...g, items: g.items.filter((a) => a.parent_activity_id === null) };
    });
  }, [visibleByProjectRaw, canBreak]);

  // Quantidade de obras concluídas escondidas (para feedback no UI)
  const hiddenCompletedCount = useMemo(
    () => byProject.filter((g) => g.project_status === 'completed').length,
    [byProject],
  );

  // Project options derived from visible dataset (filtro de obra reflete o toggle)
  const projectOptions = useMemo(
    () =>
      visibleByProject
        .map((g) => ({
          id: g.project_id,
          name: g.project_name,
          client_name: g.client_name,
          isCompleted: g.project_status === 'completed',
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [visibleByProject],
  );

  // Etapas disponíveis (derivadas do dataset já visível, sem aplicar filtro de etapa
  // para que o usuário sempre enxergue todas as opções existentes no período).
  // Inclui um sentinela '__none__' quando há atividades sem etapa preenchida.
  const etapaOptions = useMemo(() => {
    const set = new Set<string>();
    let hasEmpty = false;
    for (const g of visibleByProject) {
      for (const a of g.items) {
        const e = (a.etapa ?? '').trim();
        if (e) set.add(e);
        else hasEmpty = true;
      }
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { list, hasEmpty };
  }, [visibleByProject]);

  const filteredByProject = useMemo(() => {
    // 1) Filtro de obra
    const byProj =
      projectFilter === 'all'
        ? visibleByProject
        : visibleByProject.filter((g) => g.project_id === projectFilter);
    // 2) Filtro de etapa: aplicado por atividade; remove grupos vazios.
    const byEtapa =
      etapaFilter === 'all'
        ? byProj
        : byProj
            .map((g) => ({
              ...g,
              items: g.items.filter((a) => {
                const e = (a.etapa ?? '').trim();
                if (etapaFilter === '__none__') return e === '';
                return e === etapaFilter;
              }),
            }))
            .filter((g) => g.items.length > 0);

    // 3) Filtro "apenas micro-etapas" — válido só em week-timeline + staff.
    //    Mantém somente atividades que são children (parent_activity_id !== null),
    //    ou seja, resultados de uma quebra em micro-etapas.
    if (!onlyMicroSteps || view !== 'week-timeline' || !canBreak) return byEtapa;
    return byEtapa
      .map((g) => ({ ...g, items: g.items.filter((a) => a.parent_activity_id !== null) }))
      .filter((g) => g.items.length > 0);
  }, [visibleByProject, projectFilter, etapaFilter, onlyMicroSteps, view, canBreak]);

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
  // Marcação rápida de status direto na timeline (usado em micro-etapas).
  // 'in-progress' inicia, 'completed' conclui, 'pending' reseta as datas reais.
  const handleQuickToggle = async (
    a: WeekActivity,
    next: 'pending' | 'in-progress' | 'completed',
  ) => {
    if (next === 'in-progress') return handleStart(a);
    if (next === 'completed') return handleFinish(a);
    return handleReset(a);
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <CalendarDays className="h-4 w-4" />
              <span>Visão de calendário</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Calendário de Obras</h1>
            <p className="text-muted-foreground mt-1">
              Atividades programadas em todas as obras. Alterne entre visões de mês, semana, dia ou
              período personalizado para acompanhar e atualizar o cronograma.
            </p>
          </div>
          {canBreak && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNonWorkingOpen(true)}
              title="Marcar feriados específicos ou folgas que bloqueiam micro-etapas"
            >
              <CalendarOff className="h-4 w-4 mr-1.5" />
              Dias não úteis
            </Button>
          )}
        </div>
      </header>

      {/* View toggle + navigator */}
      <Card className="mb-4">
        <CardContent className="py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="month">Mês</TabsTrigger>
                {/* "Semana · Lista" foi ocultada — Semana · Timeline é o default */}
                <TabsTrigger value="week-timeline" title="Semana em formato de linha do tempo (Gantt)">
                  Semana · Timeline
                </TabsTrigger>
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
              {purchases.length > 0 && (
                <Badge
                  className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  title="Solicitações de compra criadas no período visível"
                >
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  Compras: {purchases.length}
                </Badge>
              )}
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
                  <PopoverContent className="w-auto p-0" align="start">
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

                {/* Quick jumps — only on month / week views; filter de obra é preservado */}
                {(view === 'month' || view === 'week-list' || view === 'week-timeline') && (
                  <div className="flex items-center gap-1 ml-1 pl-2 border-l">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRefDate(addWeeks(today, 1))}
                      title="Ir para a próxima semana (mantém o filtro de obra)"
                    >
                      Próxima semana
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRefDate(addMonths(today, 1))}
                      title="Ir para o próximo mês (mantém o filtro de obra)"
                    >
                      Próximo mês
                    </Button>
                  </div>
                )}
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
                    <PopoverContent className="w-auto p-0" align="start">
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
                    <PopoverContent className="w-auto p-0" align="start">
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
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Filtrar por obra:
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[320px]">
              <SelectValue placeholder="Todas as obras" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value="all">Todas as obras ({visibleByProject.length})</SelectItem>
              {projectOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-medium">{p.name}</span>
                  {p.client_name && (
                    <span className="text-muted-foreground"> · {p.client_name}</span>
                  )}
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

        {/* Filtro por etapa do cronograma */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Etapa:
          </div>
          <Select value={etapaFilter} onValueChange={setEtapaFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[220px]">
              <SelectValue placeholder="Todas as etapas" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value="all">
                Todas as etapas ({etapaOptions.list.length + (etapaOptions.hasEmpty ? 1 : 0)})
              </SelectItem>
              {etapaOptions.list.map((etapa) => (
                <SelectItem key={etapa} value={etapa}>
                  {etapa}
                </SelectItem>
              ))}
              {etapaOptions.hasEmpty && (
                <SelectItem value="__none__">
                  <span className="text-muted-foreground italic">Sem etapa</span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {etapaFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setEtapaFilter('all')} className="h-9">
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        {/* Toggle: incluir obras concluídas (ocultas por padrão) */}
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="include-completed"
            checked={includeCompleted}
            onCheckedChange={setIncludeCompleted}
          />
          <Label
            htmlFor="include-completed"
            className="text-xs text-muted-foreground cursor-pointer select-none"
            title="Por padrão, obras com status 'Concluída' ficam ocultas. Ative para mostrá-las novamente."
          >
            Incluir obras concluídas
            {hiddenCompletedCount > 0 && !includeCompleted && (
              <span className="ml-1 text-foreground font-medium">({hiddenCompletedCount})</span>
            )}
          </Label>
        </div>

        {/* Toggle: apenas micro-etapas (week-timeline + staff) */}
        {view === 'week-timeline' && canBreak && (
          <div className="flex items-center gap-2">
            <Switch
              id="only-microsteps"
              checked={onlyMicroSteps}
              onCheckedChange={setOnlyMicroSteps}
            />
            <Label
              htmlFor="only-microsteps"
              className="text-xs text-muted-foreground cursor-pointer select-none"
              title="Mostra apenas atividades que já foram quebradas em micro-etapas (sub-atividades). Útil para focar no detalhamento granular de execução."
            >
              Apenas micro-etapas
            </Label>
          </div>
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
          projectsWithOverduePrevious={projectsWithOverduePrev}
          onReplanSchedule={(pid) => navigate(`/obra/${pid}/cronograma`)}
          purchasesByDay={
            projectFilter === 'all'
              ? purchasesByDay
              : new Map(
                  Array.from(purchasesByDay.entries()).map(([k, v]) => [
                    k,
                    v.filter((p) => p.project_id === projectFilter),
                  ]),
                )
          }
        />
      ) : view === 'day' ? (
        <CalendarDayAgenda
          day={refDate}
          activities={filteredActivities}
          onActivityClick={setSelectedActivity}
          dayPurchases={(
            purchasesByDay.get(format(refDate, 'yyyy-MM-dd')) ?? []
          ).filter((p) => projectFilter === 'all' || p.project_id === projectFilter)}
        />
      ) : view === 'range' ? (
        <CalendarRangeTimeline
          rangeStart={viewStart}
          rangeEnd={viewEnd}
          byProject={filteredByProject}
          onActivityClick={setSelectedActivity}
          canBreak={canBreak}
          onBreak={(parent) => setBreakingActivity(parent)}
          onQuickToggle={handleQuickToggle}
        />
      ) : view === 'week-timeline' ? (
        (() => {
          // Na visão "Semana · Timeline" exibimos apenas obras que estão de
          // fato em andamento na semana — i.e., possuem ao menos uma atividade
          // cujo `actual_start` (data real de início) cai dentro do intervalo
          // [viewStart, viewEnd]. Isso filtra obras que apenas têm atividades
          // *planejadas* mas ainda não começaram na prática.
          const weekStartStr = format(viewStart, 'yyyy-MM-dd');
          const weekEndStr = format(viewEnd, 'yyyy-MM-dd');
          const inProgressByProject = filteredByProject
            .filter((g) =>
              g.items.some(
                (a) =>
                  !!a.actual_start &&
                  a.actual_start >= weekStartStr &&
                  a.actual_start <= weekEndStr,
              ),
            )
            // Ordenação por prioridade de leitura da semana:
            //  1) menor `actual_start` que caiu DENTRO da semana (obras que
            //     começaram antes aparecem primeiro — facilita varredura
            //     temporal de cima para baixo);
            //  2) atrasos da semana (qualquer atividade com planned_end
            //     dentro da semana e ainda sem actual_end) sobem como
            //     desempate, para chamar atenção;
            //  3) nome da obra (estável, alfabético pt-BR) como fallback.
            .map((g) => {
              const earliestStart = g.items
                .filter(
                  (a) =>
                    !!a.actual_start &&
                    a.actual_start >= weekStartStr &&
                    a.actual_start <= weekEndStr,
                )
                .map((a) => a.actual_start as string)
                .sort()[0] ?? '9999-12-31';
              const hasOverdueInWeek = g.items.some(
                (a) =>
                  !a.actual_end &&
                  a.planned_end >= weekStartStr &&
                  a.planned_end <= weekEndStr &&
                  a.planned_end < format(today, 'yyyy-MM-dd'),
              );
              return { g, earliestStart, hasOverdueInWeek };
            })
            .sort((a, b) => {
              if (a.earliestStart !== b.earliestStart)
                return a.earliestStart.localeCompare(b.earliestStart);
              if (a.hasOverdueInWeek !== b.hasOverdueInWeek)
                return a.hasOverdueInWeek ? -1 : 1;
              return a.g.project_name.localeCompare(b.g.project_name, 'pt-BR');
            })
            .map((x) => x.g);
          return (
            <CalendarRangeTimeline
              rangeStart={viewStart}
              rangeEnd={viewEnd}
              byProject={inProgressByProject}
              onActivityClick={setSelectedActivity}
              canBreak={canBreak}
              onBreak={(parent) => setBreakingActivity(parent)}
              onQuickToggle={handleQuickToggle}
            />
          );
        })()
      ) : (
        // Week list view (mantida por compatibilidade — aba oculta)
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
        canBreak={canBreak}
        onBreak={(parent) => {
          setSelectedActivity(null);
          setBreakingActivity(parent);
        }}
      />

      {/* Dialog para quebrar atividade em micro-etapas (Admin/Engineer) */}
      {canBreak && (
        <BreakActivityDialog
          parent={breakingActivity}
          open={!!breakingActivity}
          onOpenChange={(o) => !o && setBreakingActivity(null)}
          onConfirm={breakIntoSubActivities}
          isSubmitting={isBreaking}
          existingChildrenCount={breakingChildrenCount}
          onUndoBreak={(p) => mergeSubActivities(p.id)}
          isUndoing={isMerging}
        />)}

      {/* Dialog para gerenciar dias não úteis (Admin/Engineer) */}
      {canBreak && (
        <NonWorkingDaysDialog
          open={nonWorkingOpen}
          onOpenChange={setNonWorkingOpen}
          projects={projectOptions.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
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
  filteredByProject: {
    project_id: string;
    project_name: string;
    client_name?: string | null;
    items: WeekActivity[];
  }[];
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
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={cn('inline-flex items-center justify-center h-7 w-7 rounded-md shrink-0', color.bg)}>
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base font-semibold truncate">
                      {group.project_name}
                    </CardTitle>
                    {group.client_name && (
                      <div className="text-xs text-muted-foreground truncate">
                        Cliente: {group.client_name}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
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
