/**
 * Tipos e helpers de data compartilhados pela página Cronograma.
 *
 * `ActivityFormData` é o shape em memória usado durante a edição (versão
 * "form" das atividades; difere de `ProjectActivity` em snake_case).
 */
import { isHoliday } from '@/lib/businessDays';

export interface ActivityFormData {
  id: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  weight: string;
  predecessorIds: string[];
  etapa: string;
  detailed_description: string;
}

export const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Sexta-feira da mesma semana; recua se cair em feriado. */
export const getFridayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : -1;
  const friday = new Date(d);
  friday.setDate(friday.getDate() + daysUntilFriday);
  while (isHoliday(friday)) {
    friday.setDate(friday.getDate() - 1);
  }
  if (friday < date) return new Date(date);
  return friday;
};

/** Próxima segunda-feira após `date`. */
export const getNextMonday = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(monday.getDate() + daysUntilMonday);
  return monday;
};

export const createEmptyActivity = (): ActivityFormData => ({
  id: crypto.randomUUID(),
  description: '',
  plannedStart: '',
  plannedEnd: '',
  actualStart: '',
  actualEnd: '',
  weight: '0',
  predecessorIds: [],
  etapa: '',
  detailed_description: '',
});

export interface RowDateError {
  plannedDates?: string;
  actualDates?: string;
}
