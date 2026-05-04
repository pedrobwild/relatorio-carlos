import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_TIMING } from "@/lib/queryClient";

export interface CurrentStageInfo {
  description: string;
  isAwaitingStart: boolean;
}

/**
 * Fetches the current schedule stage for all projects in a single query.
 * Returns a map of projectId -> CurrentStageInfo
 */
export function useCurrentStages(projectIds: string[]) {
  return useQuery({
    queryKey: ["current-stages", [...projectIds].sort().join(",")],
    queryFn: async (): Promise<Map<string, CurrentStageInfo>> => {
      if (projectIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from("project_activities")
        .select(
          "project_id, description, planned_start, actual_end, sort_order",
        )
        .in("project_id", projectIds)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const map = new Map<string, CurrentStageInfo>();
      const today = new Date().toISOString().slice(0, 10);

      // Group by project
      const byProject = new Map<string, typeof data>();
      for (const row of data || []) {
        if (!byProject.has(row.project_id)) byProject.set(row.project_id, []);
        byProject.get(row.project_id)!.push(row);
      }

      for (const [projectId, activities] of byProject) {
        // Sort by sort_order (already ordered but grouped may lose order)
        activities.sort((a, b) => a.sort_order - b.sort_order);

        const firstStart = activities[0]?.planned_start;
        if (firstStart && firstStart > today) {
          map.set(projectId, {
            description: "Aguardando liberação",
            isAwaitingStart: true,
          });
          continue;
        }

        // Find first activity without actual_end
        const current = activities.find((a) => !a.actual_end);
        if (current) {
          map.set(projectId, {
            description: current.description,
            isAwaitingStart: false,
          });
        } else if (activities.length > 0) {
          // All completed
          map.set(projectId, {
            description: "Concluído",
            isAwaitingStart: false,
          });
        }
      }

      return map;
    },
    enabled: projectIds.length > 0,
    staleTime: QUERY_TIMING.default.staleTime,
  });
}
