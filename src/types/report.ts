export interface Activity {
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
}

export interface SCurveDataPoint {
  date: string;
  previsto: number;
  realizado: number;
}

export interface ReportData {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  activities: Activity[];
}
