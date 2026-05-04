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

import { format as formatFn, parse as parseFn, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

export const SP_TIMEZONE = "America/Sao_Paulo";

/**
 * Parse a `YYYY-MM-DD` string as a local-calendar date (no timezone shift).
 * Returns a Date whose components match the intended calendar day.
 */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Format a date (or ISO string) in São Paulo timezone using `pt-BR`.
 * Default pattern is `dd/MM/yyyy`.
 */
export function formatBR(
  value: Date | string | null | undefined,
  pattern = "dd/MM/yyyy",
): string {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, SP_TIMEZONE, pattern, { locale: ptBR });
}

/**
 * Format a date as `YYYY-MM-DD` in São Paulo timezone — the canonical
 * shape for dates persisted in `date` columns in Postgres.
 */
export function toIsoDateSP(value: Date | string): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatInTimeZone(date, SP_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Convert a UTC instant to São Paulo wall-clock time. Useful when you
 * need to read calendar fields (year/month/day) of a server timestamp.
 */
export function toSPDate(value: Date | string): Date {
  const date = typeof value === "string" ? parseISO(value) : value;
  return toZonedTime(date, SP_TIMEZONE);
}

/**
 * Combine a calendar date and a `HH:mm` time into an ISO instant.
 * Replaces the legacy `new Date(date)` + `setHours()` pattern, which
 * silently used the browser timezone instead of São Paulo.
 */
export function combineDateAndTimeISO(date: Date, time: string): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out.toISOString();
}

/**
 * Apply a `dd/MM/yyyy` mask while the user types. Strips non-digits, caps
 * at 8 digits and inserts the slashes at positions 2 and 4. Safe to call
 * on every keystroke — does not throw on partial input.
 */
export function maskBRDate(input: string | null | undefined): string {
  if (!input) return "";
  const digits = String(input).replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Parse a date string in flexible Brazilian formats and return the
 * canonical ISO `yyyy-MM-dd` representation. Returns `null` for empty,
 * malformed, or calendar-invalid inputs (e.g. `31/02/2025`).
 *
 * Accepted shapes:
 *   - `dd/MM/yyyy` and `dd/MM/yy`
 *   - `dd-MM-yyyy` and `dd-MM-yy`
 *   - `dd.MM.yyyy` and `dd.MM.yy`
 *   - `yyyy-MM-dd` (ISO calendar date)
 *
 * Two-digit years are expanded as `20yy`.
 */
export function parseFlexibleBRDate(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const value = String(input).trim();
  if (!value) return null;

  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    const brMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value);
    if (!brMatch) return null;
    day = Number(brMatch[1]);
    month = Number(brMatch[2]);
    year = Number(brMatch[3]);
    if (brMatch[3].length === 2) year = 2000 + year;
  }

  if (!day || !month || !year) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2999) return null;

  // Validate against the actual calendar (rejects 31/02, 31/04, 29/02 in non-leap).
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Re-export for convenience so callers don't need a second import. */
export { parseISO, formatFn as format, parseFn as parse };
