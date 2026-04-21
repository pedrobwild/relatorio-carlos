import { Activity } from "@/types/report";

export interface SCurveChartProps {
  activities: Activity[];
  reportDate?: string;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  showFullChart?: boolean;
  onShowFullChartChange?: (showFull: boolean) => void;
}

export interface ChartDataPoint {
  date: string;
  timestamp: number;
  previsto: number;
  realizado: number | null;
  activity: string | null;
}

export interface ChartMilestones {
  start: number;
  end: number;
  today: number;
  half: number;
}

export interface ChartResult {
  data: ChartDataPoint[];
  milestones: ChartMilestones;
}
