/**
 * Página Calendário de Obras — orquestrador.
 *
 * Compõe os pedaços (`CalendarObrasToolbar`, `CalendarObrasFilters`,
 * `WeekListView`) com os componentes especializados de calendário
 * (`CalendarMonthGrid`, `CalendarDayAgenda`, `CalendarRangeTimeline`) e os
 * dialogs auxiliares (`ActivityDetailDialog`, `BreakActivityDialog`,
 * `NonWorkingDaysDialog`).
 *
 * Estado vive em `useCalendarObrasUrlState` (URL persistência) e o filtro
 * derivado é local — assim qualquer link compartilhado restaura o recorte
 * exatamente.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDays, CalendarOff } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWeekActivities, type WeekActivity } from '@/hooks/useWeekActivities';
import { useProjectsWithOverduePrevious } from '@/hooks/useProjectsWithOverduePrevious';
import { usePurchasesByCreationRange } from '@/hooks/usePurchasesByCreationRange';
import { useUserRole } from '@/hooks/useUserRole';
import { ActivityDetailDialog } from '@/components/calendar/ActivityDetailDialog';
import { BreakActivityDialog } from '@/components/calendar/BreakActivityDialog';
import { CalendarMonthGrid } from '@/components/calendar/CalendarMonthGrid';
import { CalendarDayAgenda } from '@/components/calendar/CalendarDayAgenda';
import { CalendarRangeTimeline } from '@/components/calendar/CalendarRangeTimeline';
import { NonWorkingDaysDialog } from '@/components/calendar/NonWorkingDaysDialog';
import { CalendarObrasToolbar } from './CalendarObrasToolbar';
import { CalendarObrasFilters } from './CalendarObrasFilters';
import { WeekListView } from './WeekListView';
import { useCalendarObrasUrlState } from './useCalendarObrasUrlState';
import { getActivityStatus } from './types';

export default function CalendarioObras() {
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useUserRole();
  const canBreak = isAdmin || hasRole('engineer');
  const today = useMemo(() => new Date(), []);

  const url = useCalendarObrasUrlState({ today });
  const {
    view, refDate, rangeStartDate, rangeEndDate,
    projectFilter, etapaFilter, includeCompleted,
  } = url;

  const [selectedActivity, setSelectedActivity] = useState<WeekActivity | null>(null);
  const [breakingActivity, setBreakingActivity] = useState<WeekActivity | null>(null);
  const [nonWorkingOpen, setNonWorkingOpen] = useState(false);

  const { fetchStart, fetchEnd, viewStart, viewEnd } = useMemo(() => {
    if (view === 'month') {
      const ms = startOfMonth(refDate);
      const me = endOfMonth(refDate);
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
    const ws = startOfWeek(refDate, { weekStartsOn: 1 });
    const we = endOfWeek(refDate, { weekStartsOn: 1 });
    return { fetchStart: ws, fetchEnd: we, viewStart: ws, viewEnd: we };
  }, [view, refDate, rangeStartDate, rangeEndDate]);

  const fetchStartStr = format(fetchStart, 'yyyy-MM-dd');
  const fetchEndStr = format(fetchEnd, 'yyyy-MM-dd');

  const {
    byProject,
    isLoading,
    updateDates,
    isUpdating,
    breakIntoSubActivities,
    isBreaking,
  } = useWeekActivities(fetchStartStr, fetchEndStr);

  const { data: projectsWithOverduePrev } = useProjectsWithOverduePrevious(fetchStartStr);
  const { purchases, purchasesByDay } = usePurchasesByCreationRange(fetchStartStr, fetchEndStr);

  const visibleByProjectRaw = useMemo(
    () => (includeCompleted ? byProject : byProject.filter((g) => g.project_status !== 'completed')),
    [byProject, includeCompleted],
  );

  // Recorte hierárquico (mãe vs micro-etapas).
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

  const hiddenCompletedCount = useMemo(
    () => byProject.filter((g) => g.project_status === 'completed').length,
    [byProject],
  );

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
    return { list: Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR')), hasEmpty };
  }, [visibleByProject]);

  const filteredByProject = useMemo(() => {
    const byProj =
      projectFilter === 'all'
        ? visibleByProject
        : visibleByProject.filter((g) => g.project_id === projectFilter);
    if (etapaFilter === 'all') return byProj;
    return byProj
      .map((g) => ({
        ...g,
        items: g.items.filter((a) => {
          const e = (a.etapa ?? '').trim();
          if (etapaFilter === '__none__') return e === '';
          return e === etapaFilter;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [visibleByProject, projectFilter, etapaFilter]);

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

  // Filtra purchasesByDay para combinar com filtro de obra (apenas mês).
  const purchasesByDayForView = useMemo(() => {
    if (projectFilter === 'all') return purchasesByDay;
    return new Map(
      Array.from(purchasesByDay.entries()).map(([k, v]) => [
        k,
        v.filter((p) => p.project_id === projectFilter),
      ]),
    );
  }, [purchasesByDay, projectFilter]);

  return (
    <PageContainer>
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

      <CalendarObrasToolbar
        view={view}
        onViewChange={url.setView}
        refDate={refDate}
        setRefDate={url.setRefDate}
        today={today}
        rangeStartDate={rangeStartDate}
        rangeEndDate={rangeEndDate}
        draftRangeStart={url.draftRangeStart}
        draftRangeEnd={url.draftRangeEnd}
        setDraftRangeStart={url.setDraftRangeStart}
        setDraftRangeEnd={url.setDraftRangeEnd}
        draftRangeInvalid={url.draftRangeInvalid}
        draftDirty={url.draftDirty}
        applyDraftRange={url.applyDraftRange}
        resetDraftRange={url.resetDraftRange}
        goPrev={url.goPrev}
        goNext={url.goNext}
        goToday={url.goToday}
        viewStart={viewStart}
        viewEnd={viewEnd}
        counts={counts}
        purchaseCount={purchases.length}
      />

      <CalendarObrasFilters
        projectFilter={projectFilter}
        onProjectFilterChange={url.setProjectFilter}
        projectOptions={projectOptions}
        visibleProjectCount={visibleByProject.length}
        etapaFilter={etapaFilter}
        onEtapaFilterChange={url.setEtapaFilter}
        etapaOptions={etapaOptions}
        includeCompleted={includeCompleted}
        onIncludeCompletedChange={url.setIncludeCompleted}
        hiddenCompletedCount={hiddenCompletedCount}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : view === 'month' ? (
        <CalendarMonthGrid
          refDate={refDate}
          activities={filteredActivities}
          onActivityClick={setSelectedActivity}
          projectsWithOverduePrevious={projectsWithOverduePrev}
          onReplanSchedule={(pid) => navigate(`/obra/${pid}/cronograma`)}
          purchasesByDay={purchasesByDayForView}
        />
      ) : view === 'day' ? (
        <CalendarDayAgenda
          day={refDate}
          activities={filteredActivities}
          onActivityClick={setSelectedActivity}
          dayPurchases={(purchasesByDay.get(format(refDate, 'yyyy-MM-dd')) ?? []).filter(
            (p) => projectFilter === 'all' || p.project_id === projectFilter,
          )}
        />
      ) : view === 'range' || view === 'week-timeline' ? (
        <CalendarRangeTimeline
          rangeStart={viewStart}
          rangeEnd={viewEnd}
          byProject={filteredByProject}
          onActivityClick={setSelectedActivity}
        />
      ) : (
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

      {canBreak && (
        <BreakActivityDialog
          parent={breakingActivity}
          open={!!breakingActivity}
          onOpenChange={(o) => !o && setBreakingActivity(null)}
          onConfirm={breakIntoSubActivities}
          isSubmitting={isBreaking}
        />
      )}

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
