import { parseLocalDate } from '@/lib/activityStatus';
import type { BarStyle, TaskDisplayData, GanttTask } from './types';

export function safeParseLocalDate(dateString: string | null | undefined): Date | null {
  const raw = (dateString ?? '').toString().trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = parseLocalDate(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const d = parseLocalDate(raw.slice(0, 10));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/');
    const d = parseLocalDate(`${yyyy}-${mm}-${dd}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return null;
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

export function createGetBarStyle(startDate: Date, totalDays: number) {
  return (startStr: string, endStr: string): BarStyle => {
    const startD = safeParseLocalDate(startStr);
    const endD = safeParseLocalDate(endStr);

    if (!startD || !endD || !Number.isFinite(totalDays) || totalDays <= 0) {
      return { left: '0%', width: '0%', isVisible: false };
    }

    const { differenceInDays } = require('date-fns');
    const leftDays = differenceInDays(startD, startDate);
    const widthDays = Math.max(0, differenceInDays(endD, startD) + 1);

    const left = (leftDays / totalDays) * 100;
    const width = (widthDays / totalDays) * 100;

    return {
      left: `${left}%`,
      width: `${Math.max(width, 0.5)}%`,
      isVisible: (left + width) > 0 && left < 100,
    };
  };
}

export function getTaskDisplayData(task: GanttTask): TaskDisplayData {
  return {
    status: task.status,
    progress: task.progress,
    delayDays: task.delayDays,
    isDelayed: task.status === 'delayed',
    hasActualStart: task.statusTabela !== 'PENDENTE',
    hasActualEnd: task.statusTabela === 'CONCLUIDO',
  };
}
