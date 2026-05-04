/**
 * Hook to fetch activities for multiple projects at once (for dashboard sparklines).
 * Returns a Map<projectId, Activity[]>.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Activity } from "@/types/report";

function mapDbActivity(row: {
  id: string;
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  weight: number;
  predecessor_ids: string[] | null;
  baseline_start: string | null;
  baseline_end: string | null;
}): Activity {
  return {
    id: row.id,
    description: row.description,
    plannedStart: row.planned_start,
    plannedEnd: row.planned_end,
    actualStart: row.actual_start ?? "",
    actualEnd: row.actual_end ?? "",
    weight: row.weight,
    predecessorIds: row.predecessor_ids ?? undefined,
    baselineStart: row.baseline_start,
    baselineEnd: row.baseline_end,
  };
}

export function useDashboardActivities(projectIds: string[]) {
  return useQuery({
    queryKey: ["dashboard-activities", projectIds.sort().join(",")],
    queryFn: async (): Promise<Map<string, Activity[]>> => {
      if (!projectIds.length) return new Map();

      const { data, error } = await supabase
        .from("project_activities")
        .select(
          "id, project_id, description, planned_start, planned_end, actual_start, actual_end, weight, predecessor_ids, baseline_start, baseline_end, sort_order",
        )
        .in("project_id", projectIds)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const map = new Map<string, Activity[]>();
      for (const row of data ?? []) {
        const pid = row.project_id;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(mapDbActivity(row));
      }
      return map;
    },
    enabled: projectIds.length > 0,
    staleTime: 5 * 60_000,
  });
}
