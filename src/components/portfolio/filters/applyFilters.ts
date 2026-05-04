import type { AdvancedFilters } from "./types";
import type { ProjectWithCustomer } from "@/infra/repositories";
import type { ProjectSummary } from "@/infra/repositories/projects.repository";

/**
 * Apply all advanced filters to a project list.
 * Pure function — no side effects.
 */
export function applyAdvancedFilters(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
  filters: AdvancedFilters,
): ProjectWithCustomer[] {
  const summaryMap = new Map<string, ProjectSummary>();
  for (const s of summaries) summaryMap.set(s.id, s);

  const now = Date.now();
  const MS_STALE = 7 * 24 * 60 * 60 * 1000;

  return projects.filter((p) => {
    const s = summaryMap.get(p.id);

    if (filters.status.length > 0 && !filters.status.includes(p.status))
      return false;

    if (filters.phase.length > 0) {
      const pPhase = p.is_project_phase ? "project" : "execution";
      if (!filters.phase.includes(pPhase)) return false;
    }

    if (filters.engineers.length > 0) {
      if (!p.engineer_name || !filters.engineers.includes(p.engineer_name))
        return false;
    }

    if (filters.customers.length > 0) {
      if (!p.customer_name || !filters.customers.includes(p.customer_name))
        return false;
    }

    if (filters.cities.length > 0) {
      if (!p.cidade || !filters.cities.includes(p.cidade)) return false;
    }

    if (filters.units.length > 0) {
      if (!p.unit_name || !filters.units.includes(p.unit_name)) return false;
    }

    if (filters.hasPendingDocs === true && s && s.pending_documents === 0)
      return false;
    if (filters.hasPendingSign === true && s && s.unsigned_formalizations === 0)
      return false;

    if (filters.criticality.length > 0) {
      const matches = filters.criticality.some((c) => {
        if (c === "overdue") return s && s.overdue_count > 0;
        if (c === "blocked") return p.status === "paused";
        if (c === "stale") {
          if (p.status !== "active") return false;
          const ref = s?.last_activity_at ?? p.created_at;
          const refTime = ref ? new Date(ref).getTime() : 0;
          return refTime > 0 && now - refTime > MS_STALE;
        }
        return false;
      });
      if (!matches) return false;
    }

    if (
      filters.dateRange.from &&
      p.planned_end_date &&
      p.planned_end_date < filters.dateRange.from
    )
      return false;
    if (
      filters.dateRange.to &&
      p.planned_end_date &&
      p.planned_end_date > filters.dateRange.to
    )
      return false;

    const cv = p.contract_value ?? 0;
    if (filters.contractMin !== null && cv < filters.contractMin) return false;
    if (filters.contractMax !== null && cv > filters.contractMax) return false;

    return true;
  });
}
