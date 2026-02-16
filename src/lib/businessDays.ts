/**
 * Business-day utilities (Mon–Fri only).
 */

/** Returns true if date falls on Saturday or Sunday */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Add N business days to a date (skips weekends). */
export function addBusinessDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < n) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) added++;
  }
  return result;
}

/** Count business days between two dates (inclusive of both start and end). */
export function countBusinessDaysInclusive(start: Date, end: Date): number {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  if (e < s) return 0;
  let count = 0;
  const cursor = new Date(s);
  while (cursor <= e) {
    if (!isWeekend(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Minimum start date = today + 2 business days */
export function getMinStartDate(): Date {
  return addBusinessDays(new Date(), 2);
}
