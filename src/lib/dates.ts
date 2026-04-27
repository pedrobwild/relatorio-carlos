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

/**
 * Apply a `dd/MM/yyyy` mask to free-form input. Strips non-digits, then
 * inserts slashes after the day and month positions. Designed for
 * `onChange` handlers, so the cursor advances as the user types digits.
 *
 * Examples: `"23042025"` → `"23/04/2025"`, `"2304"` → `"23/04"`.
 */
export function maskBRDate(input: string): string {
  const digits = (input ?? '').replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Parse a flexible Brazilian / ISO date string into a canonical
 * `yyyy-MM-dd` (Postgres `date` shape) without timezone drift. Accepts:
 *   - `dd/MM/yyyy` and `dd-MM-yyyy` (Brazilian human input)
 *   - `dd/MM/yy`   (assumes 20yy)
 *   - `yyyy-MM-dd` (already canonical — validated and returned as-is)
 *
 * Returns `null` for empty input or values that don't represent a real
 * calendar date (e.g. 31/02/2025). Use this when the source is a free
 * text input — pickers should pass Date objects to `toIsoDateSP`.
 */
export function parseFlexibleBRDate(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  // Already canonical yyyy-MM-dd
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return isValidYMD(+y, +m, +d) ? `${y}-${m}-${d}` : null;
  }

  // dd/MM/yyyy or dd-MM-yyyy (with optional 2-digit year)
  const brMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (brMatch) {
    const [, ds, ms, ys] = brMatch;
    const d = +ds;
    const m = +ms;
    const y = ys.length === 2 ? 2000 + +ys : +ys;
    if (!isValidYMD(y, m, d)) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return null;
}

function isValidYMD(y: number, m: number, d: number): boolean {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  // Use UTC to avoid TZ rollovers; we only validate calendar arithmetic.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Re-export for convenience so callers don't need a second import. */
export { parseFlexibleBRDate as parseDateBR };
export { parseISO, formatFn as format, parseFn as parse };

