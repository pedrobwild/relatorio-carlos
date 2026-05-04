import { Activity } from "@/types/report";

export interface MilestoneDates {
  dateBriefingArch?: string | null;
  dateApproval3d?: string | null;
  dateApprovalExec?: string | null;
  dateApprovalObra?: string | null;
  dateOfficialStart?: string | null;
  dateOfficialDelivery?: string | null;
  dateMobilizationStart?: string | null;
  contractSigningDate?: string | null;
}

export type MilestoneKey =
  | "dateBriefingArch"
  | "dateApproval3d"
  | "dateApprovalExec"
  | "dateApprovalObra"
  | "dateMobilizationStart"
  | "contractSigningDate";

export interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string | null;
  endDate: string | null;
  reportDate: string;
  activities: Activity[];
  isProjectPhase?: boolean;
  milestoneDates?: MilestoneDates;
  canEditMilestones?: boolean;
  onMilestoneDateChange?: (
    key: MilestoneKey,
    date: string | null,
  ) => Promise<void>;
}

export interface LegacyTeamContact {
  role: string;
  name: string;
  phone: string;
  email: string;
  crea?: string;
  photo_url?: string;
}

export interface MilestoneItem {
  label: string;
  value: string | null | undefined;
  key: MilestoneKey;
}

export interface ProjectMetrics {
  totalWorkingDays: number;
  elapsedWorkingDays: number;
  remainingWorkingDays: number;
  actualProgress: number;
  plannedProgress: number;
  isOnTrack: boolean;
  variancePercentage: string;
  progressDiff: number;
  currentActivity: string;
  completedActivities: number;
  totalActivities: number;
}

// Calculate working days between two dates (excluding weekends)
export const calculateWorkingDays = (start: Date, end: Date): number => {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
};

export const formatDateFull = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
