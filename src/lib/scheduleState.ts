/**
 * Schedule state — derive activity state from dates so users don't have to
 * read planned_start/planned_end and infer the situation manually.
 *
 * Returns a state + label + semantic tone (compatible with `<StatusBadge>`).
 *
 * States:
 *  - not_started: today < planned_start, no actual_start.
 *  - in_progress: actual_start set, no actual_end, today <= planned_end.
 *  - completed:   actual_end set.
 *  - delayed:
 *      • actual_start set, no actual_end, today > planned_end, OR
 *      • no actual_start, today > planned_start.
 *
 * This is a pure function — no Date.now() side-effects. Pass a reference date
 * for tests.
 */
import type { StatusTone } from '@/components/ui-premium';
import { parseLocalDate, getTodayLocal } from './activityStatus';

export type ActivityState = 'not_started' | 'in_progress' | 'completed' | 'delayed';

export interface ActivityLike {
  planned_start: string;
  planned_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
}

export interface ActivityStateInfo {
  state: ActivityState;
  label: string;
  tone: StatusTone;
}

const LABEL: Record<ActivityState, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  delayed: 'Atrasada',
};

const TONE: Record<ActivityState, StatusTone> = {
  not_started: 'neutral',
  in_progress: 'info',
  completed: 'success',
  delayed: 'danger',
};

export function getActivityState(
  activity: ActivityLike,
  now: Date = getTodayLocal(),
): ActivityStateInfo {
  if (activity.actual_end) {
    return { state: 'completed', label: LABEL.completed, tone: TONE.completed };
  }

  const plannedStart = parseLocalDate(activity.planned_start);
  const plannedEnd = parseLocalDate(activity.planned_end);

  if (activity.actual_start) {
    if (now > plannedEnd) {
      return { state: 'delayed', label: LABEL.delayed, tone: TONE.delayed };
    }
    return { state: 'in_progress', label: LABEL.in_progress, tone: TONE.in_progress };
  }

  if (now > plannedStart) {
    return { state: 'delayed', label: LABEL.delayed, tone: TONE.delayed };
  }

  return { state: 'not_started', label: LABEL.not_started, tone: TONE.not_started };
}

/**
 * Sum of activity weights with a tolerance band — used by `<WeightProgress>`
 * to validate the cronograma adds up to 100%.
 *
 *  - ok     : exactly 100 (within ±0.5 to absorb float rounding).
 *  - close  : within ±5 of 100.
 *  - off    : everything else.
 */
export type WeightTotalState = 'ok' | 'close' | 'off';

export interface WeightTotalInfo {
  total: number;
  state: WeightTotalState;
  tone: StatusTone;
  message: string;
}

export function getWeightTotalInfo(weights: number[]): WeightTotalInfo {
  const total = weights.reduce((acc, w) => acc + (Number.isFinite(w) ? w : 0), 0);
  const rounded = Math.round(total * 100) / 100;
  const diff = Math.abs(rounded - 100);

  if (diff <= 0.5) {
    return {
      total: rounded,
      state: 'ok',
      tone: 'success',
      message: 'Soma dos pesos = 100%',
    };
  }

  if (diff <= 5) {
    return {
      total: rounded,
      state: 'close',
      tone: 'warning',
      message: `Soma dos pesos = ${rounded}% — ajuste para fechar 100%`,
    };
  }

  return {
    total: rounded,
    state: 'off',
    tone: 'danger',
    message:
      rounded < 100
        ? `Soma dos pesos = ${rounded}% — falta ${(100 - rounded).toFixed(1)}%`
        : `Soma dos pesos = ${rounded}% — excede em ${(rounded - 100).toFixed(1)}%`,
  };
}
