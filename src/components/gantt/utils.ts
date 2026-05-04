import { differenceInDays } from "date-fns";
import { parseLocalDate } from "@/lib/activityStatus";
import type { BarStyle, TaskDisplayData, GanttTask } from "./types";

export function safeParseLocalDate(
  dateString: string | null | undefined,
): Date | null {
  const raw = (dateString ?? "").toString().trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = parseLocalDate(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const d = parseLocalDate(raw.slice(0, 10));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split("/");
    const d = parseLocalDate(`${yyyy}-${mm}-${dd}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return null;
  return new Date(
    fallback.getFullYear(),
    fallback.getMonth(),
    fallback.getDate(),
  );
}

export function getTaskDisplayData(task: GanttTask): TaskDisplayData {
  return {
    status: task.status,
    progress: task.progress,
    delayDays: task.delayDays,
    isDelayed: task.status === "delayed",
    hasActualStart: task.statusTabela !== "PENDENTE",
    hasActualEnd: task.statusTabela === "CONCLUIDO",
  };
}
