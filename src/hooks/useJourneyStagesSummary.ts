/**
 * Hook to fetch current journey stage summary for all projects.
 * Returns the active/latest stage per project with time-in-stage calculation.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { differenceInDays } from "date-fns";

export interface JourneyStageSummary {
  projectId: string;
  currentStageName: string;
  currentStageStatus: string;
  stageIndex: number;
  totalStages: number;
  daysInStage: number;
  waitingSince: string | null;
}

export function useJourneyStagesSummary(projectIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["journey-stages-summary", projectIds.sort().join(",")],
    queryFn: async (): Promise<Map<string, JourneyStageSummary>> => {
      if (projectIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from("journey_stages")
        .select(
          "project_id, name, status, sort_order, waiting_since, confirmed_start, updated_at",
        )
        .in("project_id", projectIds)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const map = new Map<string, JourneyStageSummary>();
      const byProject = new Map<string, typeof data>();

      for (const row of data ?? []) {
        if (!byProject.has(row.project_id)) byProject.set(row.project_id, []);
        byProject.get(row.project_id)!.push(row);
      }

      const today = new Date();

      for (const [projectId, stages] of byProject) {
        const totalStages = stages.length;
        // Find current stage: first non-done stage, or last stage
        const current =
          stages.find((s) => s.status !== "completed") ??
          stages[stages.length - 1];
        if (!current) continue;

        const referenceDate =
          current.waiting_since ||
          current.confirmed_start ||
          current.updated_at;
        const daysInStage = referenceDate
          ? Math.max(0, differenceInDays(today, new Date(referenceDate)))
          : 0;

        map.set(projectId, {
          projectId,
          currentStageName: current.name,
          currentStageStatus: current.status,
          stageIndex: current.sort_order,
          totalStages,
          daysInStage,
          waitingSince: current.waiting_since,
        });
      }

      return map;
    },
    enabled: !!user && projectIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}
