import { Activity } from "@/types/report";
import { ChartDataPoint, ChartResult } from "./types";
import { plannedProgressAt, actualProgressAt } from "@/lib/linearProgress";

// Parse ISO date string to Date object
export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  const normalized = dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Format date for display (dd/mm or dd/mm/aa if different year)
export const formatDisplayDate = (
  dateStr: string,
  baseYear?: number,
): string => {
  const date = parseDate(dateStr);
  if (!date) return "";
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  if (baseYear && year !== baseYear) {
    return `${day}/${month}/${year.toString().slice(-2)}`;
  }
  return `${day}/${month}`;
};

// Find activity in progress at a given date
const findActivityAtDate = (
  activities: Activity[],
  dateStr: string,
): string | null => {
  const currentDate = parseDate(dateStr);
  if (!currentDate) return null;

  for (const activity of activities) {
    const actualStart = parseDate(activity.actualStart);
    const actualEnd = parseDate(activity.actualEnd);
    if (actualStart && actualEnd) {
      if (currentDate >= actualStart && currentDate <= actualEnd)
        return activity.description;
    } else if (actualStart && !actualEnd) {
      if (currentDate >= actualStart) return activity.description;
    }
  }

  for (const activity of activities) {
    const plannedStart = parseDate(activity.plannedStart);
    const plannedEnd = parseDate(activity.plannedEnd);
    if (plannedStart && plannedEnd) {
      if (currentDate >= plannedStart && currentDate <= plannedEnd)
        return activity.description;
    }
  }

  const sortedActivities = [...activities]
    .filter((a) => a.plannedEnd)
    .sort((a, b) => {
      const dateA = parseDate(a.plannedEnd);
      const dateB = parseDate(b.plannedEnd);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });

  for (const activity of sortedActivities) {
    const plannedEnd = parseDate(activity.plannedEnd);
    if (plannedEnd && currentDate >= plannedEnd) return activity.description;
  }

  return null;
};

const EMPTY_RESULT: ChartResult = {
  data: [
    {
      date: "Início",
      previsto: 0,
      realizado: null,
      timestamp: 0,
      activity: null,
    },
  ],
  milestones: { start: 0, end: 0, today: 0, half: 0 },
};

export function generateChartData(
  activities: Activity[],
  reportDate?: string,
  projectStartDate?: string | null,
  projectEndDate?: string | null,
): ChartResult {
  if (activities.length === 0) return EMPTY_RESULT;

  const toNumericWeight = (weight: Activity["weight"]): number => {
    if (typeof weight === "number") return Number.isFinite(weight) ? weight : 0;
    const parsed = Number(weight ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Anchor base year on project start date when provided, otherwise first activity
  const projectStartParsed = projectStartDate
    ? parseDate(projectStartDate)
    : null;
  const projectEndParsed = projectEndDate ? parseDate(projectEndDate) : null;

  const baseYear = projectStartParsed
    ? projectStartParsed.getFullYear()
    : activities[0].plannedStart
      ? (parseDate(activities[0].plannedStart)?.getFullYear() ??
        new Date().getFullYear())
      : new Date().getFullYear();

  const reportDateParsed = reportDate ? parseDate(reportDate) : new Date();

  const hasWeights = activities.some((a) => a.weight !== undefined);
  const totalWeight = hasWeights
    ? activities.reduce((sum, a) => sum + toNumericWeight(a.weight), 0)
    : activities.length;
  const safeTotalWeight = totalWeight > 0 ? totalWeight : 1;

  // Find project date range from activities, then anchor to project dates when provided
  const dateRange = activities.reduce<{ min: Date | null; max: Date | null }>(
    (acc, a) => {
      const dates = [
        parseDate(a.plannedStart),
        parseDate(a.plannedEnd),
        parseDate(a.actualStart),
        parseDate(a.actualEnd),
      ].filter(Boolean) as Date[];
      for (const d of dates) {
        if (!acc.min || d < acc.min) acc.min = d;
        if (!acc.max || d > acc.max) acc.max = d;
      }
      return acc;
    },
    { min: null, max: null },
  );

  // Project dates anchor the chart axis (with activity dates as fallback)
  let resolvedMin = projectStartParsed ?? dateRange.min;
  let resolvedMax = projectEndParsed ?? dateRange.max;
  if (!resolvedMin || !resolvedMax) return EMPTY_RESULT;

  // Safety: never let max be before min, and extend max to cover all activity data
  if (dateRange.min && dateRange.min < resolvedMin) resolvedMin = dateRange.min;
  if (dateRange.max && dateRange.max > resolvedMax) resolvedMax = dateRange.max;
  if (resolvedMax < resolvedMin) resolvedMax = resolvedMin;

  // Generate dates at regular intervals (every 3 days)
  const INTERVAL_DAYS = 3;
  const allDates: string[] = [];
  const currentDate = new Date(resolvedMin);

  while (currentDate <= resolvedMax) {
    allDates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + INTERVAL_DAYS);
  }

  const maxIsoDate = resolvedMax.toISOString().split("T")[0];
  if (!allDates.includes(maxIsoDate)) allDates.push(maxIsoDate);

  // Include key activity dates for precision
  activities.forEach((a) => {
    [a.plannedStart, a.plannedEnd, a.actualStart, a.actualEnd]
      .filter(Boolean)
      .forEach((d) => {
        if (d && parseDate(d) && !allDates.includes(d)) allDates.push(d);
      });
  });

  allDates.sort((a, b) => {
    const dA = parseDate(a);
    const dB = parseDate(b);
    if (!dA || !dB) return 0;
    return dA.getTime() - dB.getTime();
  });

  const firstDate = resolvedMin;
  const lastPlannedDate = activities.reduce(
    (latest, a) => {
      const plannedEnd = parseDate(a.plannedEnd);
      if (plannedEnd && (!latest || plannedEnd > latest)) return plannedEnd;
      return latest;
    },
    null as Date | null,
  );

  // "Entrega" milestone: prefer project end date when provided, fallback to last activity plannedEnd
  const endMilestoneDate = projectEndParsed ?? lastPlannedDate;
  const endTimestamp = endMilestoneDate
    ? Math.floor(
        (endMilestoneDate.getTime() - firstDate.getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;
  const todayTimestamp = reportDateParsed
    ? Math.floor(
        (reportDateParsed.getTime() - firstDate.getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  // Find 50% milestone
  let halfTimestamp = 0;
  let cumulativeWeight = 0;
  const sortedByPlannedEnd = [...activities]
    .filter((a) => a.plannedEnd)
    .sort((a, b) => {
      const dA = parseDate(a.plannedEnd);
      const dB = parseDate(b.plannedEnd);
      if (!dA || !dB) return 0;
      return dA.getTime() - dB.getTime();
    });

  for (const activity of sortedByPlannedEnd) {
    cumulativeWeight += hasWeights ? toNumericWeight(activity.weight) : 1;
    if (cumulativeWeight / safeTotalWeight >= 0.5) {
      const plannedEnd = parseDate(activity.plannedEnd);
      if (plannedEnd) {
        halfTimestamp = Math.floor(
          (plannedEnd.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
        );
      }
      break;
    }
  }

  const milestones = {
    start: 0,
    end: endTimestamp,
    today: todayTimestamp,
    half: halfTimestamp,
  };

  const hasAnyActualData = activities.some((a) => a.actualEnd);

  const data: ChartDataPoint[] = allDates.map((date) => {
    const cur = parseDate(date);
    if (!cur)
      return {
        date: formatDisplayDate(date, baseYear),
        previsto: 0,
        realizado: null,
        timestamp: 0,
        activity: null,
      };

    const daysSinceStart = Math.floor(
      (cur.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const activityAtDate = findActivityAtDate(activities, date);

    // Linear (per-activity) progress so atrasos de início/fim aparecem dia a dia,
    // não apenas quando uma atividade fecha por completo.
    const previstoPct = plannedProgressAt(activities, cur);
    const isFutureDate = reportDateParsed && cur > reportDateParsed;
    const realizadoPct =
      !isFutureDate && hasAnyActualData
        ? actualProgressAt(activities, cur)
        : null;

    return {
      date: formatDisplayDate(date, baseYear),
      timestamp: daysSinceStart,
      previsto: Math.round(previstoPct),
      realizado: realizadoPct !== null ? Math.round(realizadoPct) : null,
      activity: activityAtDate,
    };
  });

  return { data, milestones };
}
