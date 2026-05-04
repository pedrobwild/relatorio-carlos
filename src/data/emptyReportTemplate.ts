import { WeeklyReportData } from "@/types/weeklyReport";

/**
 * Creates an empty report template for a specific week
 * This is the default state before the engineer fills in the data
 */
export const createEmptyReportTemplate = (
  projectId: string,
  projectName: string,
  unitName: string,
  clientName: string,
  weekNumber: number,
  periodStart: string,
  periodEnd: string,
): WeeklyReportData => ({
  projectId,
  projectName,
  unitName,
  clientName,
  weekNumber,
  periodStart,
  periodEnd,
  issuedAt: "",
  preparedBy: "",

  // Empty KPIs - to be calculated
  kpis: {
    physicalPlanned: 0,
    physicalActual: 0,
    scheduleVarianceDays: 0,
  },
  nextMilestones: [],

  // Empty summary
  executiveSummary: "",

  // Empty activities
  activities: [],

  // Empty deliverables
  deliverablesCompleted: [],

  // Empty lookahead
  lookaheadTasks: [],

  // Empty risks
  risksAndIssues: [],

  // Empty quality items
  qualityItems: [],

  // Empty client decisions
  clientDecisions: [],

  // Empty incidents
  incidents: [],

  // Empty gallery
  gallery: [],

  // Empty rooms progress
  roomsProgress: [],
});
