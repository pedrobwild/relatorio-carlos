import { differenceInCalendarDays, addDays, parseISO, format } from 'date-fns';

export interface ShiftableActivity {
  id: string;
  planned_start: string | null;
  planned_end: string | null;
}

export interface ShiftResult<T extends ShiftableActivity> {
  activities: T[];
  changedIds: string[];
}

/**
 * Recalcula as datas das atividades quando o início/fim do projeto muda.
 *
 * Estratégia:
 * - Se apenas o início mudou: desloca todas as atividades pelo mesmo número de dias.
 * - Se apenas o fim mudou: redimensiona proporcionalmente em torno do início atual.
 * - Se ambos mudaram: aplica o shift no início e depois escala proporcionalmente
 *   para encaixar no novo intervalo total.
 *
 * Atividades sem datas válidas são ignoradas.
 */
export function shiftActivityDates<T extends ShiftableActivity>(
  activities: T[],
  oldProjectStart: string | null,
  oldProjectEnd: string | null,
  newProjectStart: string | null,
  newProjectEnd: string | null,
): ShiftResult<T> {
  const startChanged = !!newProjectStart && newProjectStart !== oldProjectStart;
  const endChanged = !!newProjectEnd && newProjectEnd !== oldProjectEnd;

  if (!startChanged && !endChanged) {
    return { activities, changedIds: [] };
  }

  // Compute current activity bounds
  const validActivities = activities.filter(a => a.planned_start && a.planned_end);
  if (validActivities.length === 0) {
    return { activities, changedIds: [] };
  }

  const activityStarts = validActivities.map(a => parseISO(a.planned_start as string).getTime());
  const activityEnds = validActivities.map(a => parseISO(a.planned_end as string).getTime());
  const oldActivityStart = new Date(Math.min(...activityStarts));
  const oldActivityEnd = new Date(Math.max(...activityEnds));

  // Anchor reference
  const referenceOldStart = oldProjectStart ? parseISO(oldProjectStart) : oldActivityStart;
  const referenceOldEnd = oldProjectEnd ? parseISO(oldProjectEnd) : oldActivityEnd;

  // Step 1: shift (translate) so that the earliest activity matches the new project start.
  // If start didn't change, shiftDays = 0.
  const shiftDays = startChanged && newProjectStart
    ? differenceInCalendarDays(parseISO(newProjectStart), referenceOldStart)
    : 0;

  // Step 2: compute scale factor if end changed.
  const newProjectStartDate = newProjectStart ? parseISO(newProjectStart) : referenceOldStart;
  const newProjectEndDate = newProjectEnd ? parseISO(newProjectEnd) : referenceOldEnd;
  const oldSpan = differenceInCalendarDays(referenceOldEnd, referenceOldStart);
  const newSpan = differenceInCalendarDays(newProjectEndDate, newProjectStartDate);

  // Avoid divide-by-zero or absurd scales
  const scale = endChanged && oldSpan > 0 && newSpan > 0
    ? newSpan / oldSpan
    : 1;

  const changedIds: string[] = [];
  const updated = activities.map(a => {
    if (!a.planned_start || !a.planned_end) return a;

    const startD = parseISO(a.planned_start);
    const endD = parseISO(a.planned_end);

    // Translate first
    const translatedStart = addDays(startD, shiftDays);
    const translatedEnd = addDays(endD, shiftDays);

    let finalStart = translatedStart;
    let finalEnd = translatedEnd;

    if (scale !== 1) {
      // Scale around the new project start
      const offsetFromStart = differenceInCalendarDays(translatedStart, newProjectStartDate);
      const duration = differenceInCalendarDays(translatedEnd, translatedStart);
      finalStart = addDays(newProjectStartDate, Math.round(offsetFromStart * scale));
      finalEnd = addDays(finalStart, Math.max(0, Math.round(duration * scale)));
    }

    const newStartStr = format(finalStart, 'yyyy-MM-dd');
    const newEndStr = format(finalEnd, 'yyyy-MM-dd');

    if (newStartStr !== a.planned_start || newEndStr !== a.planned_end) {
      changedIds.push(a.id);
      return { ...a, planned_start: newStartStr, planned_end: newEndStr };
    }
    return a;
  });

  return { activities: updated, changedIds };
}
