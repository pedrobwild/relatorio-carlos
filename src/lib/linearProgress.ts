/**
 * Linear progress helpers for S-curve / evolution charts.
 *
 * A "tudo-ou-nada" model (somar peso só quando actualEnd <= cur) esconde
 * atrasos de INÍCIO de atividade (ex.: planejado começar 16/01, real começou 19/01,
 * ambos terminam 23/01 → curvas idênticas). Para refletir desvio dia a dia,
 * tratamos o progresso de cada atividade como linear entre start e end.
 */

export type DateLike = string | null | undefined;

const parse = (s: DateLike): Date | null => {
  if (!s) return null;
  const normalized = s.includes("T") ? s : `${s}T00:00:00`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Fraction (0..1) of an activity completed at a given date, assuming linear progress
 * between start and end (inclusive). Returns 0 if not started, 1 if finished.
 */
export function activityFractionAt(
  start: DateLike,
  end: DateLike,
  at: Date,
): number {
  const s = parse(start);
  const e = parse(end);
  if (!s || !e) return 0;
  if (at < s) return 0;
  if (at >= e) return 1;
  const total = e.getTime() - s.getTime();
  if (total <= 0) return 1;
  return (at.getTime() - s.getTime()) / total;
}

interface ActivityProgressInput {
  weight?: number | string | null;
  plannedStart?: DateLike;
  plannedEnd?: DateLike;
  actualStart?: DateLike;
  actualEnd?: DateLike;
}

const toNumericWeight = (w: ActivityProgressInput["weight"]): number => {
  if (typeof w === "number") return Number.isFinite(w) ? w : 0;
  const n = Number(w ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Weighted % planned progress at `date`, with linear interpolation inside each activity.
 */
export function plannedProgressAt(
  activities: ActivityProgressInput[],
  date: Date,
): number {
  if (!activities.length) return 0;
  const hasWeights = activities.some(
    (a) => a.weight !== undefined && a.weight !== null,
  );
  const total = hasWeights
    ? activities.reduce((s, a) => s + toNumericWeight(a.weight), 0)
    : activities.length;
  const safeTotal = total > 0 ? total : 1;

  const accumulated = activities.reduce((sum, a) => {
    const w = hasWeights ? toNumericWeight(a.weight) : 1;
    return sum + w * activityFractionAt(a.plannedStart, a.plannedEnd, date);
  }, 0);

  return (accumulated / safeTotal) * 100;
}

/**
 * Weighted % actual progress at `date`, with linear interpolation between actualStart
 * and actualEnd. Activities without an actualStart contribute 0. Activities started
 * but not finished contribute proportionally up to `date`.
 */
export function actualProgressAt(
  activities: ActivityProgressInput[],
  date: Date,
): number {
  if (!activities.length) return 0;
  const hasWeights = activities.some(
    (a) => a.weight !== undefined && a.weight !== null,
  );
  const total = hasWeights
    ? activities.reduce((s, a) => s + toNumericWeight(a.weight), 0)
    : activities.length;
  const safeTotal = total > 0 ? total : 1;

  const accumulated = activities.reduce((sum, a) => {
    const w = hasWeights ? toNumericWeight(a.weight) : 1;
    const start = parse(a.actualStart);
    if (!start || date < start) return sum; // not started yet
    const end = parse(a.actualEnd);
    if (end && date >= end) return sum + w; // fully done
    // started, not finished by `date`: interpolate using planned duration as the
    // expected pace (falls back to actualEnd if available, else planned dates).
    const refEnd = end ?? parse(a.plannedEnd);
    const refStart = start;
    if (!refEnd || refEnd <= refStart) return sum + w;
    const frac = Math.min(
      1,
      Math.max(
        0,
        (date.getTime() - refStart.getTime()) /
          (refEnd.getTime() - refStart.getTime()),
      ),
    );
    return sum + w * frac;
  }, 0);

  return (accumulated / safeTotal) * 100;
}
