/**
 * scheduleState — estado da atividade derivado das datas, pronto para
 * `<StatusBadge tone>`.
 *
 * Pequeno wrapper sobre `computeEffectiveStatus` (`activityStatus.ts`) que
 * expõe o vocabulário de cockpit usado no Cronograma do Bloco 4:
 *
 *   - "not_started" → "Não iniciada"
 *   - "in_progress" → "Em andamento"
 *   - "completed"   → "Concluída"
 *   - "delayed"     → "Atrasada"
 *
 * Use em telas que só precisam da label/tone — para regras de progresso,
 * adiantamento, etc., continue usando `computeEffectiveStatus`.
 */

import { computeEffectiveStatus, type ActivityDates } from './activityStatus';
import type { StatusTone } from '@/components/ui-premium';

export type ActivityState = 'not_started' | 'in_progress' | 'completed' | 'delayed';

export interface ActivityStateResult {
  state: ActivityState;
  label: string;
  tone: StatusTone;
  delayDays: number;
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

/**
 * Estado da atividade a partir das datas planejadas/realizadas.
 *
 * @param activity datas da atividade
 * @param now data de referência (default: agora)
 */
export function getActivityState(
  activity: ActivityDates,
  now?: Date,
): ActivityStateResult {
  const computed = computeEffectiveStatus(activity, now);

  let state: ActivityState;
  switch (computed.status) {
    case 'completed':
      state = 'completed';
      break;
    case 'in-progress':
      state = 'in_progress';
      break;
    case 'delayed':
      state = 'delayed';
      break;
    case 'pending':
    default:
      state = 'not_started';
      break;
  }

  return {
    state,
    label: LABEL[state],
    tone: TONE[state],
    delayDays: computed.delayDays,
  };
}

export const ACTIVITY_STATE_LABEL = LABEL;
export const ACTIVITY_STATE_TONE = TONE;
