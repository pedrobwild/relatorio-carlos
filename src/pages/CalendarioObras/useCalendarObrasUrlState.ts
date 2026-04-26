/**
 * Estado de visualização + filtros + datas persistido na query string.
 *
 * Mantemos `view`, `date` (refDate), `from`/`to` (range), `obra`, `etapa`,
 * `concluidas` na URL para que recarregar ou compartilhar o link caia
 * exatamente no mesmo recorte. O hook é a única fonte de verdade dessas
 * variáveis — `index.tsx` consome via destructure.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, addMonths, addWeeks, format, parseISO } from 'date-fns';
import { isViewMode, type ViewMode } from './types';

interface UseCalendarObrasUrlStateArgs {
  today: Date;
}

function parseDateParam(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  try {
    const d = parseISO(raw);
    if (Number.isNaN(d.getTime())) return fallback;
    return d;
  } catch {
    return fallback;
  }
}

export function useCalendarObrasUrlState({ today }: UseCalendarObrasUrlStateArgs) {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialView: ViewMode = isViewMode(searchParams.get('view'))
    ? (searchParams.get('view') as ViewMode)
    : 'week-list';
  const initialRefDate = parseDateParam(searchParams.get('date'), today);
  const initialRangeStart = parseDateParam(searchParams.get('from'), today);
  const initialRangeEnd = parseDateParam(searchParams.get('to'), addDays(today, 13));

  const [view, setView] = useState<ViewMode>(initialView);
  const [refDate, setRefDate] = useState<Date>(initialRefDate);
  const [rangeStartDate, setRangeStartDate] = useState<Date>(initialRangeStart);
  const [rangeEndDate, setRangeEndDate] = useState<Date>(initialRangeEnd);
  const [draftRangeStart, setDraftRangeStart] = useState<Date>(initialRangeStart);
  const [draftRangeEnd, setDraftRangeEnd] = useState<Date>(initialRangeEnd);

  const [projectFilter, setProjectFilter] = useState<string>(
    () => searchParams.get('obra') || 'all',
  );
  const [etapaFilter, setEtapaFilter] = useState<string>(
    () => searchParams.get('etapa') || 'all',
  );
  const [includeCompleted, setIncludeCompleted] = useState<boolean>(
    () => searchParams.get('concluidas') === '1',
  );

  // Sincroniza para a query string. `replace` para não poluir histórico.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (projectFilter && projectFilter !== 'all') next.set('obra', projectFilter);
    else next.delete('obra');
    if (etapaFilter && etapaFilter !== 'all') next.set('etapa', etapaFilter);
    else next.delete('etapa');
    if (includeCompleted) next.set('concluidas', '1');
    else next.delete('concluidas');

    if (view && view !== 'week-list') next.set('view', view);
    else next.delete('view');

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
  }, [projectFilter, etapaFilter, includeCompleted, view, refDate, rangeStartDate, rangeEndDate]);

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

  const goPrev = () => {
    if (view === 'month') setRefDate(addMonths(refDate, -1));
    else if (view === 'day') setRefDate(addDays(refDate, -1));
    else if (view === 'range') {
      const span = Math.max(
        1,
        Math.round((rangeEndDate.getTime() - rangeStartDate.getTime()) / 86_400_000) + 1,
      );
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
      const span = Math.max(
        1,
        Math.round((rangeEndDate.getTime() - rangeStartDate.getTime()) / 86_400_000) + 1,
      );
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

  return useMemo(
    () => ({
      view,
      setView,
      refDate,
      setRefDate,
      rangeStartDate,
      setRangeStartDate,
      rangeEndDate,
      setRangeEndDate,
      draftRangeStart,
      setDraftRangeStart,
      draftRangeEnd,
      setDraftRangeEnd,
      draftRangeInvalid,
      draftDirty,
      applyDraftRange,
      resetDraftRange,
      goPrev,
      goNext,
      goToday,
      projectFilter,
      setProjectFilter,
      etapaFilter,
      setEtapaFilter,
      includeCompleted,
      setIncludeCompleted,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      view, refDate, rangeStartDate, rangeEndDate,
      draftRangeStart, draftRangeEnd, draftRangeInvalid, draftDirty,
      projectFilter, etapaFilter, includeCompleted,
    ],
  );
}

export type CalendarObrasUrlState = ReturnType<typeof useCalendarObrasUrlState>;
