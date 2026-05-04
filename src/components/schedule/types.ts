import { Activity } from "@/types/report";

export type Status =
  | "completed"
  | "delayed"
  | "on-time"
  | "in-progress"
  | "pending";
export type SortField =
  | "description"
  | "plannedStart"
  | "plannedEnd"
  | "actualStart"
  | "actualEnd"
  | "status";
export type SortDirection = "asc" | "desc";

export interface ScheduleTableProps {
  activities: Activity[];
  reportDate?: string;
  selectedActivityId?: string | null;
  onActivitySelect?: (activityId: string | null) => void;
  canEditDates?: boolean;
  onUpdateActivityDates?: (
    activityId: string,
    updates: { actual_start?: string | null; actual_end?: string | null },
  ) => Promise<boolean>;
}
