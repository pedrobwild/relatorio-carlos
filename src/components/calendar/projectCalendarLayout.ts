/**
 * Helpers puros (sem React) para layout do `ProjectCalendar`.
 *
 * Mantidos isolados pra teste unitário rápido — toda a lógica de "qual barra
 * vai em qual lane" e "como recortar um intervalo numa semana" vive aqui.
 */
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

/** Evento normalizado pelo consumidor antes de chegar ao layout. */
export interface ProjectCalendarEvent<T> {
  id: string;
  /** YYYY-MM-DD inclusivo */
  start: string;
  /** YYYY-MM-DD inclusivo */
  end: string;
  entity: T;
}

export function parseLocal(dateISO: string): Date {
  return new Date(dateISO + 'T00:00:00');
}

/** Constrói as semanas (linhas) do mês visível, partindo de segunda-feira. */
export function buildMonthWeeks(refDate: Date): Date[][] {
  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** Segmento de uma barra recortado para uma semana específica. */
export interface BarSegment<T> {
  event: ProjectCalendarEvent<T>;
  /** Coluna inicial (0-6, segunda-feira=0) */
  startCol: number;
  /** Comprimento em colunas (1-7) */
  span: number;
  startsBefore: boolean;
  endsAfter: boolean;
}

/**
 * Calcula os segmentos visíveis de cada evento numa dada semana e atribui
 * "lanes" estáveis (eventos longos ficam na mesma lane ao longo das semanas
 * que atravessam).
 */
export function buildWeekLanes<T>(
  week: Date[],
  events: ProjectCalendarEvent<T>[],
): Map<number, BarSegment<T>> {
  const weekStart = week[0];
  const weekEnd = week[6];

  // Segmentos candidatos para esta semana
  const segments: BarSegment<T>[] = [];
  events.forEach((event) => {
    const start = parseLocal(event.start);
    const end = parseLocal(event.end);
    if (end < weekStart || start > weekEnd) return;

    const segStart = start < weekStart ? weekStart : start;
    const segEnd = end > weekEnd ? weekEnd : end;
    const startCol = differenceInCalendarDays(segStart, weekStart);
    const span = differenceInCalendarDays(segEnd, segStart) + 1;

    segments.push({
      event,
      startCol: Math.max(0, Math.min(6, startCol)),
      span: Math.max(1, Math.min(7 - startCol, span)),
      startsBefore: start < weekStart,
      endsAfter: end > weekEnd,
    });
  });

  // Atribui lanes: ordena por (start asc, span desc) e usa o primeiro slot livre.
  segments.sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    return b.span - a.span;
  });

  const lanes: BarSegment<T>[][] = [];
  const result = new Map<number, BarSegment<T>>();

  segments.forEach((seg) => {
    let placed = false;
    for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
      const lane = lanes[laneIdx];
      const conflicts = lane.some(
        (existing) =>
          !(seg.startCol + seg.span <= existing.startCol ||
            seg.startCol >= existing.startCol + existing.span),
      );
      if (!conflicts) {
        lane.push(seg);
        result.set(lanes.flat().indexOf(seg), seg);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([seg]);
    }
  });

  // Reconstrói o mapa de forma estável: laneIndex → lista de segmentos
  // (mais útil pra o consumidor renderizar por lane).
  result.clear();
  let runningId = 0;
  lanes.forEach((lane, laneIdx) => {
    lane.forEach((seg) => {
      result.set(runningId++, { ...seg });
      // armazenamos a lane decidida em um dicionário paralelo
      (seg as BarSegment<T> & { lane: number }).lane = laneIdx;
    });
  });

  return result;
}

/** Eventos que tocam um dia específico. Útil para o agenda view. */
export function eventsOnDay<T>(events: ProjectCalendarEvent<T>[], day: Date): ProjectCalendarEvent<T>[] {
  const t = day.getTime();
  return events.filter((event) => {
    const s = parseLocal(event.start).getTime();
    const e = parseLocal(event.end).getTime();
    return s <= t && t <= e;
  });
}
