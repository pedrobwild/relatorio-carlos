import type { AdvancedFilters } from './types';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

/**
 * Simple health estimation matching the one in insights/drawer.
 */
function estimateHealth(s: ProjectSummary): number {
  let score = 100;
  if (s.overdue_count > 0) score -= Math.min(40, s.overdue_count * 15);
  if (s.unsigned_formalizations > 0) score -= Math.min(20, s.unsigned_formalizations * 10);
  if (s.pending_documents > 0) score -= Math.min(15, s.pending_documents * 5);
  if (s.progress_percentage < 20 && s.status === 'active') score -= 10;
  return Math.max(0, Math.min(100, score));
}

function healthTier(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'attention';
  return 'critical';
}

/**
 * Apply all advanced filters to a project list.
 */
export function applyAdvancedFilters(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
  filters: AdvancedFilters,
): ProjectWithCustomer[] {
  const summaryMap = new Map<string, ProjectSummary>();
  for (const s of summaries) summaryMap.set(s.id, s);

  const now = Date.now();
  const MS_48H = 48 * 60 * 60 * 1000;

  return projects.filter(p => {
    const s = summaryMap.get(p.id);

    // Status
    if (filters.status.length > 0 && !filters.status.includes(p.status)) return false;

    // Phase
    if (filters.phase.length > 0) {
      const pPhase = p.is_project_phase ? 'project' : 'execution';
      if (!filters.phase.includes(pPhase)) return false;
    }

    // Engineer (match by name since we store names in chips)
    if (filters.engineers.length > 0) {
      if (!p.engineer_name || !filters.engineers.includes(p.engineer_name)) return false;
    }

    // Customer
    if (filters.customers.length > 0) {
      if (!p.customer_name || !filters.customers.includes(p.customer_name)) return false;
    }

    // City
    if (filters.cities.length > 0) {
      if (!p.cidade || !filters.cities.includes(p.cidade)) return false;
    }

    // Unit
    if (filters.units.length > 0) {
      if (!p.unit_name || !filters.units.includes(p.unit_name)) return false;
    }

    // Health
    if (filters.health.length > 0 && s) {
      const tier = healthTier(estimateHealth(s));
      if (!filters.health.includes(tier)) return false;
    }

    // Pending docs
    if (filters.hasPendingDocs === true && s && s.pending_documents === 0) return false;

    // Pending sign
    if (filters.hasPendingSign === true && s && s.unsigned_formalizations === 0) return false;

    // Criticality
    if (filters.criticality.length > 0) {
      const matches = filters.criticality.some(c => {
        if (c === 'overdue') return s && s.overdue_count > 0;
        if (c === 'blocked') return p.status === 'paused';
        if (c === 'stale') {
          if (p.status !== 'active') return false;
          if (!s?.last_activity_at) return true;
          return now - new Date(s.last_activity_at).getTime() > MS_48H;
        }
        return false;
      });
      if (!matches) return false;
    }

    // Date range (planned_end_date)
    if (filters.dateRange.from && p.planned_end_date && p.planned_end_date < filters.dateRange.from) return false;
    if (filters.dateRange.to && p.planned_end_date && p.planned_end_date > filters.dateRange.to) return false;

    // Contract value range
    const cv = p.contract_value ?? 0;
    if (filters.contractMin !== null && cv < filters.contractMin) return false;
    if (filters.contractMax !== null && cv > filters.contractMax) return false;

    return true;
  });
}
