/**
 * Project health helpers — single source of truth for the "stale" / "overdue"
 * computations consumed across the Portfolio surface.
 *
 * Why this exists:
 *   The same arithmetic ("project is stale if last activity > 7 days") was
 *   duplicated across `PortfolioKpiStrip`, `PortfolioActionInbox`,
 *   `StaleProjectsDialog`, `filters/applyFilters` and `ProjectsListView`.
 *   Each copy used a slightly different floor/ceil/round, which made the
 *   "Sem update" KPI count and the "Parada há N dias" copy disagree. This
 *   file centralizes the rule.
 *
 * Inputs are intentionally narrow (`HealthProject`, `HealthSummary`) so the
 * helpers don't depend on the heavy repository types — easier to test and
 * easier to reuse from server-side / edge code if needed later.
 */

import { differenceInCalendarDays } from 'date-fns';
import { parseLocalDate } from './dates';

/** Project is considered "without recent update" after this many days. */
export const STALE_PROJECT_DAYS = 7;

/** Deliveries this close to today (in days) count as "approaching". */
export const APPROACHING_DEADLINE_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface HealthProject {
  status: string;
  created_at?: string | null;
  planned_end_date?: string | null;
  actual_end_date?: string | null;
}

export interface HealthSummary {
  last_activity_at?: string | null;
}

export interface StaleInfo {
  /** True if the project's last activity is older than `STALE_PROJECT_DAYS`. */
  isStale: boolean;
  /** Floor of days since last activity. `null` when there is no reference. */
  days: number | null;
  /** ISO of the timestamp used as reference (last activity ?? created_at). */
  refDate: string | null;
}

/**
 * Compute "no recent update" status for an active project.
 *
 * Only `status === 'active'` projects can be stale — paused / completed /
 * cancelled / draft projects never qualify (matches `applyFilters` and
 * `PortfolioKpiStrip`).
 */
export function getProjectStaleInfo(
  project: HealthProject,
  summary?: HealthSummary | null,
  now: Date = new Date(),
): StaleInfo {
  if (project.status !== 'active') {
    return { isStale: false, days: null, refDate: summary?.last_activity_at ?? project.created_at ?? null };
  }

  const ref = summary?.last_activity_at ?? project.created_at ?? null;
  const refTime = ref ? new Date(ref).getTime() : 0;
  if (!refTime) return { isStale: false, days: null, refDate: ref };

  const days = Math.floor((now.getTime() - refTime) / MS_PER_DAY);
  return {
    isStale: days >= STALE_PROJECT_DAYS,
    days,
    refDate: ref,
  };
}

export interface DelayInfo {
  /** Parsed planned end as a local-calendar Date (no TZ shift). */
  plannedEnd: Date;
  /**
   * Days remaining until planned end. Positive = future, 0 = today,
   * negative = past (overdue). Calendar days, calculated in local TZ.
   */
  daysRemaining: number;
  /** Convenience: `daysRemaining < 0`. */
  isOverdue: boolean;
  /** Convenience: deadline within `APPROACHING_DEADLINE_DAYS` and not overdue. */
  isApproaching: boolean;
  /** Positive count of days past the deadline. `0` when not overdue. */
  daysOverdue: number;
}

/**
 * Compute delay info for an active project. Returns `null` when the rule
 * doesn't apply: no planned end, project already finished, or the project
 * is not in `active` state. The shape mirrors what the cards/inbox need
 * so callers don't have to recompute `isOverdue` and `isApproaching`.
 */
export function getProjectDelayInfo(
  project: HealthProject,
  today: Date = new Date(),
): DelayInfo | null {
  if (project.status !== 'active') return null;
  if (!project.planned_end_date) return null;
  if (project.actual_end_date) return null;

  const plannedEnd = parseLocalDate(project.planned_end_date);
  if (Number.isNaN(plannedEnd.getTime())) return null;

  const daysRemaining = differenceInCalendarDays(plannedEnd, today);
  return {
    plannedEnd,
    daysRemaining,
    isOverdue: daysRemaining < 0,
    isApproaching: daysRemaining >= 0 && daysRemaining <= APPROACHING_DEADLINE_DAYS,
    daysOverdue: daysRemaining < 0 ? -daysRemaining : 0,
  };
}
