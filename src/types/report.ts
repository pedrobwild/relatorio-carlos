export interface Activity {
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  weight?: number; // Peso da atividade no progresso total (0-100). Se não definido, usa cálculo proporcional por duração.
}

export interface SCurveDataPoint {
  date: string;
  previsto: number;
  realizado: number;
}

export interface WeeklyReport {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  completionPercentage: number;
}

export interface ReportIncidentPhoto {
  id: string;
  url: string;
  caption?: string;
}

export interface ReportIncident {
  id: string;
  occurrence: string;
  occurrenceDate: string;
  cause: string;
  action: string;
  impact: string;
  status: 'aberto' | 'em andamento' | 'resolvido';
  expectedResolutionDate: string;
  photos?: ReportIncidentPhoto[];
}

export interface ReportData {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  reportDate: string; // Data de geração do relatório
  activities: Activity[];
  incidents?: ReportIncident[];
}
