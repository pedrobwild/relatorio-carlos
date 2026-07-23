/**
 * Internal Weekly Reports Repository — Onda F (staff-only).
 *
 * Não confundir com `weekly_reports` (relatórios do cliente). Estes são
 * relatórios executivos internos, com payload consolidando avanço físico,
 * custos, RDOs, NCs, punch list e lookahead.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { Tables } from "@/integrations/supabase/types";

export type InternalWeeklyReport = Tables<"internal_weekly_reports">;

export const internalWeeklyReportsRepo = {
  async list(filters?: { projectId?: string; limit?: number }) {
    return executeListQuery<InternalWeeklyReport>(async () => {
      let q = supabase
        .from("internal_weekly_reports")
        .select("*")
        .is("deleted_at", null)
        .order("week_start", { ascending: false })
        .order("generated_at", { ascending: false });
      if (filters?.projectId) q = q.eq("project_id", filters.projectId);
      if (filters?.limit) q = q.limit(filters.limit);
      return await q;
    });
  },

  async getByProjectAndWeek(projectId: string, weekStart: string) {
    return executeQuery<InternalWeeklyReport | null>(async () => {
      const res = await supabase
        .from("internal_weekly_reports")
        .select("*")
        .eq("project_id", projectId)
        .eq("week_start", weekStart)
        .is("deleted_at", null)
        .maybeSingle();
      return res as { data: InternalWeeklyReport | null; error: typeof res.error };
    });
  },

  async softDelete(id: string) {
    return executeQuery<InternalWeeklyReport>(async () => {
      return await supabase
        .from("internal_weekly_reports")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
    });
  },
};

export default internalWeeklyReportsRepo;
