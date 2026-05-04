import { Activity } from "@/types/report";
import type { ActivityStatus } from "@/lib/activityStatus";
import type { GanttTask } from "@/lib/mapCronogramaParaGantt";

export type ZoomLevel = "week" | "month" | "quarter";

export interface GanttChartProps {
  activities: Activity[];
  reportDate?: string;
  onActivityDateChange?: (
    activityId: string,
    newPlannedStart: string,
    newPlannedEnd: string,
  ) => void;
  editable?: boolean;
  showBaseline?: boolean;
  showFullChart?: boolean;
  onShowFullChartChange?: (showFull: boolean) => void;
  selectedActivityId?: string | null;
  onActivitySelect?: (activityId: string | null) => void;
}

export interface DragState {
  activityId: string;
  dragType: "move" | "resize-start" | "resize-end";
  startX: number;
  originalStart: string;
  originalEnd: string;
}

export interface MonthInfo {
  date: Date;
  label: string;
  days: number;
}

export interface GridLine {
  date: Date;
  offset: number;
}

export interface BarStyle {
  left: string;
  width: string;
  isVisible: boolean;
}

export interface DependencyLine {
  fromIndex: number;
  toIndex: number;
  fromActivity: Activity;
  toActivity: Activity;
}

export interface TaskDisplayData {
  status: ActivityStatus;
  progress: number;
  delayDays: number;
  isDelayed: boolean;
  hasActualStart: boolean;
  hasActualEnd: boolean;
}

export type { GanttTask, ActivityStatus };
