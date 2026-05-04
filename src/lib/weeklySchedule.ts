import { isHoliday, isNonBusinessDay } from "./businessDays";

/** Format Date → YYYY-MM-DD (local). */
export function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD → Date at local midnight. */
export function parseISODateLocal(s: string): Date {
  return new Date(s + "T00:00:00");
}

/**
 * Friday of the same week as `date` (or next valid business day if Friday is holiday).
 * If `date` falls on Sat/Sun, advances to Friday of the following week.
 */
export function getFridayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  if (dow === 0)
    d.setDate(d.getDate() + 5); // Sun → Fri next
  else if (dow === 6)
    d.setDate(d.getDate() + 6); // Sat → Fri next
  else d.setDate(d.getDate() + (5 - dow)); // Mon-Fri → Fri this week
  while (isHoliday(d)) d.setDate(d.getDate() - 1);
  if (d < date) return new Date(date);
  return d;
}

/** Next Monday after `date` (skips holidays). */
export function getNextMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const delta = dow === 0 ? 1 : 8 - dow;
  d.setDate(d.getDate() + delta);
  while (isNonBusinessDay(d)) d.setDate(d.getDate() + 1);
  return d;
}

export interface WeeklyActivityInput {
  id: string;
  planned_start: string | null;
  planned_end: string | null;
}

export interface WeeklyActivityResult {
  id: string;
  planned_start: string;
  planned_end: string;
}

/**
 * Recalculate activity dates week-by-week (Mon→Fri) starting at `startDate`.
 * Each activity occupies one full work week. Order is preserved (input order).
 */
export function recalculateWeeklyActivities<T extends WeeklyActivityInput>(
  activities: T[],
  startDate: string,
): WeeklyActivityResult[] {
  if (!startDate || activities.length === 0) return [];
  let cursor = parseISODateLocal(startDate);
  // Ensure we start on Monday-Friday business day
  while (isNonBusinessDay(cursor)) cursor.setDate(cursor.getDate() + 1);

  return activities.map((a) => {
    const friday = getFridayOfWeek(cursor);
    const result = {
      id: a.id,
      planned_start: toISODateLocal(cursor),
      planned_end: toISODateLocal(friday),
    };
    cursor = getNextMonday(friday);
    return result;
  });
}
