import { useMemo, useCallback } from "react";
import {
  format,
  differenceInDays,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, getTodayLocal } from "@/lib/activityStatus";
import {
  mapCronogramaParaGantt,
  type CronogramaTabelaRow,
} from "@/lib/mapCronogramaParaGantt";
import { ganttLogger } from "@/lib/devLogger";
import { Activity } from "@/types/report";
import { safeParseLocalDate } from "./utils";
import type {
  GanttTask,
  MonthInfo,
  GridLine,
  DependencyLine,
  BarStyle,
} from "./types";

const GRID_INTERVAL_DAYS = 3;

export function useGanttData(
  activities: Activity[],
  reportDate: string | undefined,
  showFullChart: boolean,
) {
  const referenceDate = useMemo(() => {
    return reportDate ? parseLocalDate(reportDate) : getTodayLocal();
  }, [reportDate]);

  const ganttTasks: GanttTask[] = useMemo(() => {
    const rows: CronogramaTabelaRow[] = activities.map((a) => ({
      id: a.id,
      description: a.description,
      plannedStart: a.plannedStart,
      plannedEnd: a.plannedEnd,
      actualStart: a.actualStart,
      actualEnd: a.actualEnd,
      weight: a.weight,
      predecessorIds: a.predecessorIds,
      baselineStart: a.baselineStart,
      baselineEnd: a.baselineEnd,
    }));

    const mapped = mapCronogramaParaGantt(rows, referenceDate);

    if (import.meta.env.DEV) {
      ganttLogger.log(`Mapped ${mapped.length} activities`, {
        sample: mapped.slice(0, 3).map((t) => ({
          id: t.id,
          status: t.status,
          progress: t.progress,
        })),
      });
    }

    return mapped;
  }, [activities, referenceDate]);

  const { startDate, endDate, totalDays, months, gridLines } = useMemo(() => {
    const today = referenceDate;

    if (activities.length === 0) {
      return {
        startDate: today,
        endDate: today,
        totalDays: 30,
        months: [
          {
            date: today,
            label: format(today, "MMM yyyy", { locale: ptBR }),
            days: 30,
          },
        ] as MonthInfo[],
        gridLines: [] as GridLine[],
      };
    }

    const allDates: Date[] = [];
    const pushDate = (value?: string | null) => {
      const d = safeParseLocalDate(value);
      if (d) allDates.push(d);
    };

    activities.forEach((a) => {
      pushDate(a.plannedStart);
      pushDate(a.plannedEnd);
      if (a.actualStart) pushDate(a.actualStart);
      if (a.actualEnd) pushDate(a.actualEnd);
    });
    allDates.push(today);

    if (allDates.length === 0) {
      return {
        startDate: today,
        endDate: today,
        totalDays: 30,
        months: [
          {
            date: today,
            label: format(today, "MMM yyyy", { locale: ptBR }),
            days: 30,
          },
        ] as MonthInfo[],
        gridLines: [] as GridLine[],
      };
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    let start: Date;
    let end: Date;

    if (showFullChart) {
      start = startOfMonth(minDate);
      end = endOfMonth(maxDate);
    } else {
      const windowStart = addDays(today, -30);
      const windowEnd = addDays(today, 15);
      start = windowStart < minDate ? minDate : windowStart;
      end = windowEnd > maxDate ? maxDate : windowEnd;
      start = startOfMonth(start);
      end = endOfMonth(end);
    }

    const monthsList: MonthInfo[] = eachMonthOfInterval({ start, end }).map(
      (date) => ({
        date,
        label: format(date, "MMM yyyy", { locale: ptBR }),
        days: differenceInDays(endOfMonth(date), startOfMonth(date)) + 1,
      }),
    );

    const totalDaysValue = Math.max(1, differenceInDays(end, start) + 1);

    const gridLinesArray: GridLine[] = [];
    let currentDate = start;
    while (currentDate <= end) {
      const offset = differenceInDays(currentDate, start);
      gridLinesArray.push({ date: currentDate, offset });
      currentDate = addDays(currentDate, GRID_INTERVAL_DAYS);
    }

    return {
      startDate: start,
      endDate: end,
      totalDays: totalDaysValue,
      months: monthsList,
      gridLines: gridLinesArray,
    };
  }, [activities, referenceDate, showFullChart]);

  const todayOffset = differenceInDays(referenceDate, startDate);
  const todayPercent = (todayOffset / totalDays) * 100;

  const getBarStyle = useCallback(
    (startStr: string, endStr: string): BarStyle => {
      const startD = safeParseLocalDate(startStr);
      const endD = safeParseLocalDate(endStr);

      if (!startD || !endD || !Number.isFinite(totalDays) || totalDays <= 0) {
        return { left: "0%", width: "0%", isVisible: false };
      }

      const leftDays = differenceInDays(startD, startDate);
      const widthDays = Math.max(0, differenceInDays(endD, startD) + 1);

      const left = (leftDays / totalDays) * 100;
      const width = (widthDays / totalDays) * 100;

      return {
        left: `${left}%`,
        width: `${Math.max(width, 0.5)}%`,
        isVisible: left + width > 0 && left < 100,
      };
    },
    [startDate, totalDays],
  );

  const dependencyLines: DependencyLine[] = useMemo(() => {
    const idToIndex = new Map(activities.map((a, i) => [a.id, i]));
    const lines: DependencyLine[] = [];
    activities.forEach((activity, toIndex) => {
      if (activity.predecessorIds && activity.predecessorIds.length > 0) {
        activity.predecessorIds.forEach((predId) => {
          const fromIndex = idToIndex.get(predId);
          if (fromIndex !== undefined) {
            lines.push({
              fromIndex,
              toIndex,
              fromActivity: activities[fromIndex],
              toActivity: activity,
            });
          }
        });
      }
    });
    return lines;
  }, [activities]);

  return {
    referenceDate,
    ganttTasks,
    startDate,
    endDate,
    totalDays,
    months,
    gridLines,
    todayPercent,
    getBarStyle,
    dependencyLines,
  };
}
