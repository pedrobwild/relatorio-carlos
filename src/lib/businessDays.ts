/**
 * Business-day utilities (Mon–Fri only).
 * Includes São Paulo (SP) municipal + national holidays.
 */

/** São Paulo fixed holidays (month, day) — national + municipal */
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1], // Confraternização Universal
  [1, 25], // Aniversário de São Paulo (municipal)
  [4, 21], // Tiradentes
  [5, 1], // Dia do Trabalho
  [7, 9], // Revolução Constitucionalista (SP)
  [9, 7], // Independência do Brasil
  [10, 12], // Nossa Senhora Aparecida
  [11, 2], // Finados
  [11, 15], // Proclamação da República
  [11, 20], // Consciência Negra
  [12, 25], // Natal
];

/**
 * Computes Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Returns all moveable holidays for a given year (Easter-based).
 * Carnival (Mon+Tue before Ash Wed), Good Friday, Corpus Christi.
 */
function moveableHolidays(year: number): Date[] {
  const easter = easterSunday(year);
  const ms = easter.getTime();
  const day = 86400000;
  return [
    new Date(ms - 48 * day), // Carnival Monday (easter - 48)
    new Date(ms - 47 * day), // Carnival Tuesday (easter - 47)
    new Date(ms - 2 * day), // Good Friday (Sexta-feira Santa)
    new Date(ms + 60 * day), // Corpus Christi (easter + 60)
  ];
}

/** Cache of holiday sets per year for performance */
const holidayCache = new Map<number, Set<string>>();

function toKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getHolidaySet(year: number): Set<string> {
  if (holidayCache.has(year)) return holidayCache.get(year)!;
  const set = new Set<string>();
  for (const [m, d] of FIXED_HOLIDAYS) {
    set.add(`${year}-${m - 1}-${d}`);
  }
  for (const h of moveableHolidays(year)) {
    set.add(toKey(h));
  }
  holidayCache.set(year, set);
  return set;
}

/** Returns true if date falls on Saturday or Sunday */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Returns true if the date is a holiday (SP + national) */
export function isHoliday(date: Date): boolean {
  const set = getHolidaySet(date.getFullYear());
  return set.has(toKey(date));
}

/** Returns true if the date is NOT a business day (weekend or holiday) */
export function isNonBusinessDay(date: Date): boolean {
  return isWeekend(date) || isHoliday(date);
}

/** Add N business days to a date (skips weekends and holidays).
 *  If the starting date is a non-business day, it is first advanced
 *  to the next business day before counting begins. */
export function addBusinessDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  // First, ensure we start on a business day
  while (isNonBusinessDay(result)) {
    result.setDate(result.getDate() + 1);
  }
  // Then advance N business days
  let added = 0;
  while (added < n) {
    result.setDate(result.getDate() + 1);
    if (!isNonBusinessDay(result)) added++;
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
    if (!isNonBusinessDay(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Minimum start date = today + 2 business days */
export function getMinStartDate(): Date {
  return addBusinessDays(new Date(), 2);
}
