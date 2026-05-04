/**
 * Centralized activity status computation and date utilities
 *
 * This module provides consistent status calculation across the application,
 * ensuring proper timezone handling and business rules enforcement.
 */

import { differenceInDays } from "date-fns";

export type ActivityStatus =
  | "completed"
  | "in-progress"
  | "delayed"
  | "pending";

export interface ActivityDates {
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string | null;
  actualEnd?: string | null;
}

export interface ComputedStatus {
  status: ActivityStatus;
  isDelayedAuto: boolean;
  delayDays: number;
  progress: number;
}

/**
 * Parse a date string (YYYY-MM-DD) to a Date object at midnight local time.
 * This avoids timezone shifts that occur with new Date('YYYY-MM-DD').
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Date object at midnight local time
 */
export function parseLocalDate(dateString: string): Date {
  // Append T00:00:00 to force parsing at midnight local time
  // This prevents the UTC interpretation that causes day shifts
  return new Date(dateString + "T00:00:00");
}

/**
 * Get today's date at midnight local time (no time component)
 */
export function getTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Compute the effective status of an activity based on its dates and today's date.
 *
 * Business Rules:
 * - COMPLETED (completed): actualEnd is set (100% done, never delayed)
 * - IN_PROGRESS (in-progress): actualStart set but no actualEnd
 *   - Becomes DELAYED if plannedEnd < today
 * - PENDING (pending): no actualStart
 *   - Becomes DELAYED if plannedStart < today (should have started)
 *
 * @param activity - Activity with date fields
 * @param referenceDate - Reference date for calculations (defaults to today)
 * @returns Computed status with delay info and progress
 */
export function computeEffectiveStatus(
  activity: ActivityDates,
  referenceDate?: Date,
): ComputedStatus {
  const today = referenceDate || getTodayLocal();
  const plannedStart = parseLocalDate(activity.plannedStart);
  const plannedEnd = parseLocalDate(activity.plannedEnd);

  // Calculate progress
  let progress = 0;
  let status: ActivityStatus = "pending";
  let isDelayedAuto = false;
  let delayDays = 0;

  // Case 1: Activity is completed
  if (activity.actualEnd) {
    const actualEnd = parseLocalDate(activity.actualEnd);
    status = "completed";
    progress = 100;

    // Calculate if it was completed late
    delayDays = differenceInDays(actualEnd, plannedEnd);
    if (delayDays < 0) delayDays = 0; // Completed early

    return { status, isDelayedAuto: false, delayDays, progress };
  }

  // Case 2: Activity is in progress (started but not finished)
  if (activity.actualStart) {
    const actualStart = parseLocalDate(activity.actualStart);
    status = "in-progress";

    // Calculate progress based on elapsed time vs planned duration
    const totalPlannedDays = differenceInDays(plannedEnd, plannedStart) + 1;
    const elapsedDays = differenceInDays(today, actualStart) + 1;

    progress = Math.min(
      99,
      Math.max(1, Math.round((elapsedDays / totalPlannedDays) * 100)),
    );

    // Check if delayed (past planned end date)
    if (today > plannedEnd) {
      status = "delayed";
      isDelayedAuto = true;
      delayDays = differenceInDays(today, plannedEnd);
    }

    return { status, isDelayedAuto, delayDays, progress };
  }

  // Case 3: Activity not started (pending)
  status = "pending";
  progress = 0;

  // Check if should have started (delayed start)
  if (today > plannedStart) {
    status = "delayed";
    isDelayedAuto = true;
    delayDays = differenceInDays(today, plannedStart);
  }

  return { status, isDelayedAuto, delayDays, progress };
}

/**
 * Get the status color class for an activity status
 */
export function getStatusColorClass(status: ActivityStatus): string {
  const colors: Record<ActivityStatus, string> = {
    completed: "bg-green-500",
    "in-progress": "bg-primary",
    delayed: "bg-destructive",
    pending: "bg-primary/30",
  };
  return colors[status];
}

/**
 * Get the status label in Portuguese
 */
export function getStatusLabel(status: ActivityStatus): string {
  const labels: Record<ActivityStatus, string> = {
    completed: "Concluído",
    "in-progress": "Em andamento",
    delayed: "Atrasado",
    pending: "Previsto",
  };
  return labels[status];
}

/**
 * Validate that end date is >= start date
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return true;
  return endDate >= startDate;
}

/**
 * Validate progress is between 0 and 100
 */
export function validateProgress(progress: number): boolean {
  return progress >= 0 && progress <= 100;
}
