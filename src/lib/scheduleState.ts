/**
 * Estado visual de uma atividade do cronograma derivado das datas planejadas
 * vs. realizadas.
 *
 * Wrapper sobre `computeEffectiveStatus` (activityStatus.ts) que devolve um
 * objeto pronto para `<StatusBadge tone={...}>{label}</StatusBadge>`, mantendo
 * a regra de negócio em um único lugar.
 *
 * Estados (visíveis ao usuário):
 *  - `not_started` ("Não iniciada")  — sem `actualStart`, prazo ainda não passou
 *  - `in_progress` ("Em andamento")  — `actualStart` set, sem `actualEnd`, dentro do prazo
 *  - `completed`   ("Concluída")     — `actualEnd` set
 *  - `delayed`     ("Atrasada")      — derivado: passou de `plannedStart` sem iniciar,
 *                                      ou passou de `plannedEnd` sem concluir
 */
import {
  type ActivityDates,
  type ActivityStatus,
  computeEffectiveStatus,
} from './activityStatus';
import type { StatusTone } from '@/components/ui-premium';

export type ScheduleState =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'delayed';

export interface ScheduleStateInfo {
  state: ScheduleState;
  label: string;
  tone: StatusTone;
  isAutoDelayed: boolean;
  delayDays: number;
}

const STATE_BY_STATUS: Record<ActivityStatus, ScheduleState> = {
  pending: 'not_started',
  'in-progress': 'in_progress',
  completed: 'completed',
  delayed: 'delayed',
};

export const SCHEDULE_STATE_LABEL: Record<ScheduleState, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  delayed: 'Atrasada',
};

export const SCHEDULE_STATE_TONE: Record<ScheduleState, StatusTone> = {
  not_started: 'neutral',
  in_progress: 'info',
  completed: 'success',
  delayed: 'danger',
};

/**
 * Computa o estado visível da atividade a partir das datas.
 *
 * @param activity - Datas planejadas e (opcional) reais da atividade
 * @param now - Data de referência (default: hoje, meia-noite local)
 */
export function getActivityState(
  activity: ActivityDates,
  now?: Date,
): ScheduleStateInfo {
  const computed = computeEffectiveStatus(activity, now);
  const state = STATE_BY_STATUS[computed.status];
  return {
    state,
    label: SCHEDULE_STATE_LABEL[state],
    tone: SCHEDULE_STATE_TONE[state],
    isAutoDelayed: computed.isDelayedAuto,
    delayDays: computed.delayDays,
  };
}
