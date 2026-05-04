// Weekly Report Data Types - Template Padrão de Relatório Semanal

export interface WeeklyReportKPIs {
  physicalPlanned: number; // % previsto
  physicalActual: number; // % realizado
  scheduleVarianceDays: number; // desvio em dias
  costVariance?: number; // desvio de custo (opcional)
}

export interface Milestone {
  description: string;
  dueDate: string;
  status: "pending" | "completed" | "at-risk";
}

export interface ClientDecision {
  id: string;
  description: string;
  options?: string[];
  impactIfDelayed: string;
  dueDate: string;
  status: "pending" | "approved" | "rejected";
}

export interface WeeklyReportActivitySnapshot {
  activityId: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: "concluído" | "em andamento" | "pendente" | "atrasado";
  varianceDays: number;
  notes?: string;
  percentComplete: number;
  weight?: number; // Peso da atividade no progresso total (0-100). Soma de todos deve = 100.
}

export interface RiskIssue {
  id: string;
  type: "risco" | "impedimento" | "problema";
  title: string;
  description: string;
  impact: {
    time: "baixo" | "médio" | "alto";
    cost: "baixo" | "médio" | "alto";
    quality: "baixo" | "médio" | "alto";
  };
  severity: "baixa" | "média" | "alta" | "crítica";
  actionPlan: string;
  owner: string;
  dueDate: string;
  status: "aberto" | "em acompanhamento" | "ação imediata" | "resolvido";
}

export interface QualityChecklistItem {
  name: string;
  executed: boolean;
  result: "aprovado" | "reprovado" | "pendente";
}

export interface NonConformity {
  id: string;
  description: string;
  photoUrl?: string;
  responsible: string;
  correctionDate: string;
  status: "aberto" | "corrigido";
}

export interface PendingItem {
  id: string;
  description: string;
  severity: "verde" | "amarelo" | "vermelho";
  dueDate: string;
}

export interface WeeklyReportQualityItem {
  checklistName: string;
  items: QualityChecklistItem[];
  nonConformities: NonConformity[];
  pendingItems: PendingItem[];
}

export interface LookaheadTask {
  id: string;
  date: string;
  description: string;
  prerequisites: string;
  responsible: string;
  risk: "baixo" | "médio" | "alto";
  riskReason?: string;
}

export interface DeliverableSubItem {
  id: string;
  description: string;
}

export interface DeliverableItem {
  id: string;
  description: string;
  completed: boolean;
  subItems?: DeliverableSubItem[];
}

export interface GalleryPhoto {
  id: string;
  url: string;
  caption: string;
  area: string;
  date: string;
  category: string;
}

export interface IncidentPhoto {
  id: string;
  url: string;
  caption?: string;
}

export interface Incident {
  id: string;
  occurrence: string;
  occurrenceDate: string;
  cause: string;
  action: string;
  impact: string;
  status: "aberto" | "em andamento" | "resolvido";
  expectedResolutionDate: string;
  photos?: IncidentPhoto[];
}

export interface TimelinePhoto {
  url: string;
  caption: string;
  date: string;
}

export interface RoomProgress {
  id: string;
  name: string;
  status: "concluído" | "em andamento" | "pendente";
  render3D?: TimelinePhoto; // Foto do projeto 3D renderizado
  before?: TimelinePhoto;
  during?: TimelinePhoto;
  after?: TimelinePhoto;
}

export interface WeeklyReportData {
  projectId: string;
  projectName: string;
  unitName: string;
  clientName: string;
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  preparedBy: string;

  // KPIs
  kpis: WeeklyReportKPIs;
  nextMilestones: Milestone[];

  // Executive Summary
  executiveSummary: string;

  // Activity Snapshots
  activities: WeeklyReportActivitySnapshot[];

  // Deliverables completed this week
  deliverablesCompleted: DeliverableItem[];

  // Lookahead (next 7 days)
  lookaheadTasks: LookaheadTask[];

  // Risks, Issues, Action Plans
  risksAndIssues: RiskIssue[];

  // Quality
  qualityItems: WeeklyReportQualityItem[];

  // Client Decisions
  clientDecisions: ClientDecision[];

  // Incidents
  incidents: Incident[];

  // Photo Gallery
  gallery: GalleryPhoto[];

  // Room Progress Timeline
  roomsProgress?: RoomProgress[];
}
