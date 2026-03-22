import { Activity } from "@/types/report";
import { ChartDataPoint, ChartResult } from "./types";

// Parse ISO date string to Date object
export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00");
};

// Format date for display (dd/mm or dd/mm/aa if different year)
export const formatDisplayDate = (dateStr: string, baseYear?: number): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  if (baseYear && year !== baseYear) {
    return `${day}/${month}/${year.toString().slice(-2)}`;
  }
  return `${day}/${month}`;
};

// Find activity in progress at a given date
const findActivityAtDate = (activities: Activity[], dateStr: string): string | null => {
  const currentDate = parseDate(dateStr);
  if (!currentDate) return null;

  for (const activity of activities) {
    const actualStart = parseDate(activity.actualStart);
    const actualEnd = parseDate(activity.actualEnd);
    if (actualStart && actualEnd) {
      if (currentDate >= actualStart && currentDate <= actualEnd) return activity.description;
    } else if (actualStart && !actualEnd) {
      if (currentDate >= actualStart) return activity.description;
    }
  }

  for (const activity of activities) {
    const plannedStart = parseDate(activity.plannedStart);
    const plannedEnd = parseDate(activity.plannedEnd);
    if (plannedStart && plannedEnd) {
      if (currentDate >= plannedStart && currentDate <= plannedEnd) return activity.description;
    }
  }

  const sortedActivities = [...activities]
    .filter(a => a.plannedEnd)
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
  data: [{ date: "Início", previsto: 0, realizado: null, timestamp: 0, activity: null }],
  milestones: { start: 0, end: 0, today: 0, half: 0 },
};

export function generateChartData(activities: Activity[], reportDate?: string): ChartResult {
  if (activities.length === 0) return EMPTY_RESULT;

  const baseYear = activities[0].plannedStart
    ? new Date(activities[0].plannedStart + "T00:00:00").getFullYear()
    : new Date().getFullYear();

  const reportDateParsed = reportDate ? parseDate(reportDate) : new Date();

  const hasWeights = activities.some(a => a.weight !== undefined);
  const totalWeight = hasWeights
    ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
    : activities.length;

  // Find project date range
  const dateRange = activities.reduce<{ min: Date | null; max: Date | null }>((acc, a) => {
    const dates = [parseDate(a.plannedStart), parseDate(a.plannedEnd), parseDate(a.actualStart), parseDate(a.actualEnd)].filter(Boolean) as Date[];
    for (const d of dates) {
      if (!acc.min || d < acc.min) acc.min = d;
      if (!acc.max || d > acc.max) acc.max = d;
    }
    return acc;
  }, { min: null, max: null });

  const resolvedMin = dateRange.min;
  const resolvedMax = dateRange.max;
  if (!resolvedMin || !resolvedMax) return EMPTY_RESULT;

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
  activities.forEach(a => {
    [a.plannedStart, a.plannedEnd, a.actualStart, a.actualEnd]
      .filter(Boolean)
      .forEach(d => { if (!allDates.includes(d!)) allDates.push(d!); });
  });

  allDates.sort((a, b) => {
    const dA = parseDate(a);
    const dB = parseDate(b);
    if (!dA || !dB) return 0;
    return dA.getTime() - dB.getTime();
  });

  const firstDate = resolvedMin;
  const lastPlannedDate = activities.reduce((latest, a) => {
    const plannedEnd = parseDate(a.plannedEnd);
    if (plannedEnd && (!latest || plannedEnd > latest)) return plannedEnd;
    return latest;
  }, null as Date | null);

  const endTimestamp = lastPlannedDate
    ? Math.floor((lastPlannedDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const todayTimestamp = reportDateParsed
    ? Math.floor((reportDateParsed.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Find 50% milestone
  let halfTimestamp = 0;
  let cumulativeWeight = 0;
  const sortedByPlannedEnd = [...activities]
    .filter(a => a.plannedEnd)
    .sort((a, b) => {
      const dA = parseDate(a.plannedEnd);
      const dB = parseDate(b.plannedEnd);
      if (!dA || !dB) return 0;
      return dA.getTime() - dB.getTime();
    });

  for (const activity of sortedByPlannedEnd) {
    cumulativeWeight += hasWeights ? (activity.weight || 0) : 1;
    if (cumulativeWeight / totalWeight >= 0.5) {
      const plannedEnd = parseDate(activity.plannedEnd);
      if (plannedEnd) {
        halfTimestamp = Math.floor((plannedEnd.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      break;
    }
  }

  const milestones = { start: 0, end: endTimestamp, today: todayTimestamp, half: halfTimestamp };

  const hasAnyActualData = activities.some(a => a.actualEnd);

  const data: ChartDataPoint[] = allDates.map(date => {
    const cur = parseDate(date);
    if (!cur) return { date: formatDisplayDate(date, baseYear), previsto: 0, realizado: null, timestamp: 0, activity: null };

    const daysSinceStart = Math.floor((cur.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const activityAtDate = findActivityAtDate(activities, date);

    const plannedProgress = activities.reduce((sum, a) => {
      const plannedEnd = parseDate(a.plannedEnd);
      if (plannedEnd && plannedEnd <= cur) return sum + (hasWeights ? (a.weight || 0) : 1);
      return sum;
    }, 0);

    const isFutureDate = reportDateParsed && cur > reportDateParsed;
    let actualProgress: number | null = null;
    if (!isFutureDate && hasAnyActualData) {
      actualProgress = activities.reduce((sum, a) => {
        const actualEnd = parseDate(a.actualEnd);
        if (actualEnd && actualEnd <= cur) return sum + (hasWeights ? (a.weight || 0) : 1);
        return sum;
      }, 0);
    }

    return {
      date: formatDisplayDate(date, baseYear),
      timestamp: daysSinceStart,
      previsto: Math.round((plannedProgress / totalWeight) * 100),
      realizado: actualProgress !== null ? Math.round((actualProgress / totalWeight) * 100) : null,
      activity: activityAtDate,
    };
  });

  return { data, milestones };
}
