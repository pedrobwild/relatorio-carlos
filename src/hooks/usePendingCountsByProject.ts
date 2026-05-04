import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Fetches a record of project_id → pending_count for all accessible projects.
 * Uses a plain object instead of Map to survive react-query persistence serialization.
 */
export function usePendingCountsByProject() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-counts-by-project", user?.id],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("pending_items")
        .select("project_id")
        .eq("status", "pending");

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const item of data || []) {
        if (item.project_id) {
          counts[item.project_id] = (counts[item.project_id] || 0) + 1;
        }
      }
      return counts;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}
