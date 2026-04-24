/**
 * Date helpers with explicit timezone handling.
 *
 * Why this exists:
 *   `new Date('2025-04-23')` parses as UTC midnight. When formatted with
 *   `toLocaleDateString('pt-BR')` in a browser west of UTC (São Paulo is
 *   UTC-3), the displayed day shifts to "22/04/2025". In a construction
 *   workflow that drives schedules and milestones, a one-day drift is a
 *   real bug.
 *
 * Use these helpers (or `parseLocal` from `businessDays.ts`) instead of
 * `new Date(string)` whenever the input is a calendar date or an ISO
 * string from the database. For datetime values that already carry a
 * timezone offset, `parseISO` from `date-fns` is safe.
 */

import { format as formatFn, parse as parseFn, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

export const SP_TIMEZONE = 'America/Sao_Paulo';

/**
 * Parse a `YYYY-MM-DD` string as a local-calendar date (no timezone shift).
 * Returns a Date whose components match the intended calendar day.
 */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Format a date (or ISO string) in São Paulo timezone using `pt-BR`.
 * Default pattern is `dd/MM/yyyy`.
 */
export function formatBR(value: Date | string | null | undefined, pattern = 'dd/MM/yyyy'): string {
  if (!value) return '';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return formatInTimeZone(date, SP_TIMEZONE, pattern, { locale: ptBR });
}

/**
 * Format a date as `YYYY-MM-DD` in São Paulo timezone — the canonical
 * shape for dates persisted in `date` columns in Postgres.
 */
export function toIsoDateSP(value: Date | string): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return formatInTimeZone(date, SP_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Convert a UTC instant to São Paulo wall-clock time. Useful when you
 * need to read calendar fields (year/month/day) of a server timestamp.
 */
export function toSPDate(value: Date | string): Date {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return toZonedTime(date, SP_TIMEZONE);
}

/**
 * Combine a calendar date and a `HH:mm` time into an ISO instant.
 * Replaces the legacy `new Date(date)` + `setHours()` pattern, which
 * silently used the browser timezone instead of São Paulo.
 */
export function combineDateAndTimeISO(date: Date, time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out.toISOString();
}

/** Re-export for convenience so callers don't need a second import. */
export { parseISO, formatFn as format, parseFn as parse };
