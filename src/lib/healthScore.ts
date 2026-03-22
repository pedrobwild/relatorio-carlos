/**
 * Health Score Engine
 * 
 * Calculates a 0-100 health score for a project based on:
 * - Schedule adherence (40% weight)
 * - Pending items (25% weight)
 * - Formalizations (20% weight)
 * - Documents (15% weight)
 */

import type { ProjectSummary } from '@/infra/repositories/projects.repository';

export type HealthLevel = 'excellent' | 'good' | 'attention' | 'critical';

export interface HealthBreakdown {
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface HealthScore {
  score: number;
  level: HealthLevel;
  label: string;
  breakdowns: HealthBreakdown[];
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function getLevel(score: number): HealthLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'attention';
  return 'critical';
}

const levelLabels: Record<HealthLevel, string> = {
  excellent: 'Excelente',
  good: 'Bom',
  attention: 'Atenção',
  critical: 'Crítico',
};

export function computeHealthScore(project: ProjectSummary): HealthScore {
  const breakdowns: HealthBreakdown[] = [];

  // 1. Schedule adherence (40%)
  const progress = project.progress_percentage ?? 0;
  let scheduleScore: number;
  let scheduleDetail: string;

  if (project.actual_end_date) {
    scheduleScore = 100;
    scheduleDetail = 'Obra concluída';
  } else if (!project.actual_start_date) {
    scheduleScore = 70;
    scheduleDetail = 'Ainda não iniciada';
  } else {
    const start = new Date(project.actual_start_date).getTime();
    const end = new Date(project.planned_end_date).getTime();
    const now = Date.now();
    const totalDuration = end - start;
    const elapsed = now - start;
    const expectedProgress = totalDuration > 0 ? clamp((elapsed / totalDuration) * 100) : 0;
    const deviation = progress - expectedProgress;

    if (deviation >= 0) {
      scheduleScore = 100;
      scheduleDetail = 'No prazo ou adiantado';
    } else if (deviation >= -10) {
      scheduleScore = 75;
      scheduleDetail = 'Leve atraso no cronograma';
    } else if (deviation >= -25) {
      scheduleScore = 45;
      scheduleDetail = 'Atraso moderado no cronograma';
    } else {
      scheduleScore = 20;
      scheduleDetail = 'Atraso significativo';
    }
  }

  breakdowns.push({ label: 'Cronograma', score: scheduleScore, weight: 0.4, detail: scheduleDetail });

  // 2. Pending items (25%)
  const pendingCount = project.pending_count ?? 0;
  const overdueCount = project.overdue_count ?? 0;
  let pendingScore: number;
  let pendingDetail: string;

  if (pendingCount === 0) {
    pendingScore = 100;
    pendingDetail = 'Nenhuma pendência';
  } else if (overdueCount === 0) {
    pendingScore = clamp(100 - pendingCount * 10);
    pendingDetail = `${pendingCount} pendência(s) dentro do prazo`;
  } else {
    pendingScore = clamp(100 - overdueCount * 25 - (pendingCount - overdueCount) * 5);
    pendingDetail = `${overdueCount} em atraso de ${pendingCount} total`;
  }

  breakdowns.push({ label: 'Pendências', score: pendingScore, weight: 0.25, detail: pendingDetail });

  // 3. Formalizations (20%)
  const unsigned = project.unsigned_formalizations ?? 0;
  let formalScore: number;
  let formalDetail: string;

  if (unsigned === 0) {
    formalScore = 100;
    formalDetail = 'Todas assinadas';
  } else if (unsigned <= 1) {
    formalScore = 65;
    formalDetail = '1 formalização pendente';
  } else {
    formalScore = clamp(100 - unsigned * 30);
    formalDetail = `${unsigned} formalizações pendentes`;
  }

  breakdowns.push({ label: 'Formalizações', score: formalScore, weight: 0.2, detail: formalDetail });

  // 4. Documents (15%)
  const pendingDocs = project.pending_documents ?? 0;
  let docScore: number;
  let docDetail: string;

  if (pendingDocs === 0) {
    docScore = 100;
    docDetail = 'Documentos em dia';
  } else {
    docScore = clamp(100 - pendingDocs * 20);
    docDetail = `${pendingDocs} documento(s) pendente(s)`;
  }

  breakdowns.push({ label: 'Documentos', score: docScore, weight: 0.15, detail: docDetail });

  const score = Math.round(
    breakdowns.reduce((sum, b) => sum + b.score * b.weight, 0)
  );

  const level = getLevel(score);

  return {
    score,
    level,
    label: levelLabels[level],
    breakdowns,
  };
}
