export interface ParsedDateRange {
  /** ISO yyyy-mm-dd, inclusive. */
  startISO?: string;
  /** ISO yyyy-mm-dd, inclusive. */
  endISO?: string;
  /** A short SQL fragment usable inside WHERE clauses (e.g. `due_date BETWEEN ...`). */
  sqlFragment?: string;
  /** Human label (PT-BR). */
  label: string;
  /** Detected granularity. */
  granularity:
    | "day"
    | "week"
    | "month"
    | "quarter"
    | "year"
    | "custom"
    | "none";
}

const today = (): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const iso = (d: Date): string => d.toISOString().slice(0, 10);

const addDays = (d: Date, n: number): Date => {
  const c = new Date(d.getTime());
  c.setUTCDate(c.getUTCDate() + n);
  return c;
};

const startOfWeek = (d: Date): Date => {
  // Monday as start (consistent with date_trunc('week', ...) in Postgres).
  const c = new Date(d.getTime());
  const day = c.getUTCDay() || 7;
  if (day !== 1) c.setUTCDate(c.getUTCDate() - (day - 1));
  return c;
};

const startOfMonth = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const endOfMonth = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));

/**
 * Parse Brazilian-Portuguese date phrasing inside a free-text question.
 * Returns at most one range — best-effort, never throws.
 */
export function parseDateRange(question: string): ParsedDateRange {
  const q = question.toLowerCase();
  const now = today();

  if (/\bhoje\b/.test(q)) {
    return {
      startISO: iso(now),
      endISO: iso(now),
      sqlFragment: "= CURRENT_DATE",
      label: "hoje",
      granularity: "day",
    };
  }

  if (/\bontem\b/.test(q)) {
    const y = addDays(now, -1);
    return {
      startISO: iso(y),
      endISO: iso(y),
      sqlFragment: "= CURRENT_DATE - INTERVAL '1 day'",
      label: "ontem",
      granularity: "day",
    };
  }

  if (/\bamanh[aã]\b/.test(q)) {
    const t = addDays(now, 1);
    return {
      startISO: iso(t),
      endISO: iso(t),
      sqlFragment: "= CURRENT_DATE + INTERVAL '1 day'",
      label: "amanhã",
      granularity: "day",
    };
  }

  const next = q.match(/pr[oó]ximos?\s+(\d{1,3})\s+dias?/);
  if (next) {
    const n = Math.min(365, Number(next[1]));
    return {
      startISO: iso(now),
      endISO: iso(addDays(now, n)),
      sqlFragment: `BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${n} days'`,
      label: `próximos ${n} dias`,
      granularity: "custom",
    };
  }

  if (/esta\s+semana|nesta\s+semana|semana\s+atual/.test(q)) {
    const start = startOfWeek(now);
    const end = addDays(start, 6);
    return {
      startISO: iso(start),
      endISO: iso(end),
      sqlFragment:
        "BETWEEN date_trunc('week', CURRENT_DATE)::date AND (date_trunc('week', CURRENT_DATE)::date + INTERVAL '6 days')",
      label: "esta semana",
      granularity: "week",
    };
  }

  if (/semana\s+passada|na\s+semana\s+passada/.test(q)) {
    const start = addDays(startOfWeek(now), -7);
    const end = addDays(start, 6);
    return {
      startISO: iso(start),
      endISO: iso(end),
      sqlFragment:
        "BETWEEN (date_trunc('week', CURRENT_DATE)::date - INTERVAL '7 days') AND (date_trunc('week', CURRENT_DATE)::date - INTERVAL '1 day')",
      label: "semana passada",
      granularity: "week",
    };
  }

  if (/este\s+m[eê]s|neste\s+m[eê]s|m[eê]s\s+atual|do\s+m[eê]s/.test(q)) {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return {
      startISO: iso(start),
      endISO: iso(end),
      sqlFragment:
        "BETWEEN date_trunc('month', CURRENT_DATE)::date AND (date_trunc('month', CURRENT_DATE)::date + INTERVAL '1 month - 1 day')::date",
      label: "este mês",
      granularity: "month",
    };
  }

  if (/m[eê]s\s+passado|no\s+m[eê]s\s+passado/.test(q)) {
    const start = startOfMonth(addDays(startOfMonth(now), -1));
    const end = endOfMonth(start);
    return {
      startISO: iso(start),
      endISO: iso(end),
      sqlFragment:
        "BETWEEN (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date AND (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date",
      label: "mês passado",
      granularity: "month",
    };
  }

  if (/este\s+ano|ano\s+atual/.test(q)) {
    return {
      startISO: `${now.getUTCFullYear()}-01-01`,
      endISO: `${now.getUTCFullYear()}-12-31`,
      sqlFragment:
        "BETWEEN date_trunc('year', CURRENT_DATE)::date AND (date_trunc('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')::date",
      label: "este ano",
      granularity: "year",
    };
  }

  return { label: "sem período explícito", granularity: "none" };
}
