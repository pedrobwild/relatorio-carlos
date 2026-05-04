import { Activity } from "@/types/report";
import { Status } from "./types";
import { parseLocalDate } from "@/lib/dates";

export const formatDate = (dateStr: string, baseYear?: number): string => {
  if (!dateStr) return "—";
  // Calendar date — parse as local to avoid UTC midnight shifting back one day in pt-BR.
  const date = parseLocalDate(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  if (baseYear && year !== baseYear) {
    return `${day}/${month}/${year.toString().slice(-2)}`;
  }
  return `${day}/${month}`;
};

export const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  return parseLocalDate(dateStr);
};

export const getActivityStatus = (activity: Activity): Status => {
  if (!activity.actualStart) return "pending";
  if (activity.actualEnd) return "completed";
  return "in-progress";
};

export const getDelayDays = (activity: Activity): number | null => {
  if (!activity.actualEnd) return null;
  const plannedEnd = parseDate(activity.plannedEnd);
  const actualEnd = parseDate(activity.actualEnd);
  if (plannedEnd && actualEnd) {
    return Math.ceil(
      (actualEnd.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24),
    );
  }
  return null;
};

export const formatDeviation = (
  days: number | null,
): { text: string; className: string } => {
  if (days === null) return { text: "—", className: "text-muted-foreground" };
  if (days === 0) return { text: "No prazo", className: "text-success" };
  if (days > 0)
    return { text: `+${days}d`, className: "text-destructive font-semibold" };
  return { text: `${days}d`, className: "text-success font-semibold" };
};

export const statusOrder: Record<Status, number> = {
  delayed: 0,
  "in-progress": 1,
  pending: 2,
  "on-time": 3,
  completed: 4,
};
