/**
 * Client Dashboard Hook
 *
 * Aggregates data from multiple sources to power the client dashboard:
 * - Project summaries (from RPC)
 * - Upcoming payments across all projects
 * - Journey stage info for project-phase projects
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useProjectSummaryQuery } from "./useProjectsQuery";
import { queryKeys } from "@/lib/queryKeys";
import type { ProjectSummary } from "@/infra/repositories/projects.repository";

export interface UpcomingPayment {
  id: string;
  project_id: string;
  project_name: string;
  description: string;
  amount: number;
  due_date: string;
  installment_number: number;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalPending: number;
  totalOverdue: number;
  unsignedFormalizations: number;
  totalContractValue: number;
  avgProgress: number;
}

function computeStats(projects: ProjectSummary[]): DashboardStats {
  const active = projects.filter((p) => p.status === "active");
  return {
    totalProjects: projects.length,
    activeProjects: active.length,
    totalPending: active.reduce((s, p) => s + (p.pending_count || 0), 0),
    totalOverdue: active.reduce((s, p) => s + (p.overdue_count || 0), 0),
    unsignedFormalizations: active.reduce(
      (s, p) => s + (p.unsigned_formalizations || 0),
      0,
    ),
    totalContractValue: active.reduce((s, p) => s + (p.contract_value || 0), 0),
    avgProgress:
      active.length > 0
        ? Math.round(
            active.reduce((s, p) => s + (p.progress_percentage || 0), 0) /
              active.length,
          )
        : 0,
  };
}

export function useClientDashboard() {
  const { user } = useAuth();
  const {
    data: projects = [],
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjectSummaryQuery();

  // Fetch upcoming unpaid payments across all user's projects
  const { data: upcomingPayments = [] } = useQuery({
    queryKey: ["client-dashboard-payments", user?.id],
    queryFn: async (): Promise<UpcomingPayment[]> => {
      if (!projects.length) return [];

      const projectIds = projects
        .filter((p) => p.status === "active")
        .map((p) => p.id);
      if (!projectIds.length) return [];

      const { data, error } = await supabase
        .from("project_payments")
        .select(
          "id, project_id, description, amount, due_date, installment_number",
        )
        .in("project_id", projectIds)
        .is("paid_at", null)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(5);

      if (error) throw error;

      // Enrich with project names
      const projectMap = new Map(projects.map((p) => [p.id, p.name]));
      return (data || []).map((p) => ({
        ...p,
        project_name: projectMap.get(p.project_id) || "Projeto",
        amount: p.amount || 0,
        due_date: p.due_date || "",
        installment_number: p.installment_number || 0,
      }));
    },
    enabled: !!user && projects.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const stats = computeStats(projects as ProjectSummary[]);

  return {
    projects: projects as ProjectSummary[],
    stats,
    upcomingPayments,
    isLoading: projectsLoading,
    error: projectsError,
  };
}
