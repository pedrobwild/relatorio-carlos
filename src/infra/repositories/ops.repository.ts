/**
 * Camada de Operação — Fase 2 da reformulação do processo core.
 *
 * O que a equipe faz no dia a dia, separado da camada do cliente:
 *   - atividades (`ops_activities`) penduradas nas etapas (`project_activities`)
 *   - alocações por dia com Feito / Não feito (`ops_assignments`)
 *   - materiais que precisam estar na obra (`ops_materials`)
 *   - revisão aprovado / refazer (`ops_reviews`)
 *
 * RLS: somente staff com acesso à obra. Regras de negócio (etapa obrigatória,
 * carimbo de quem confirmou, retrabalho) ficam em triggers no banco.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];
export type OpsActivityStatus = Enums["ops_activity_status"];
export type OpsBlockReason = Enums["ops_block_reason"];
export type OpsAssignmentOutcome = Enums["ops_assignment_outcome"];
export type OpsMaterialStatus = Enums["ops_material_status"];
export type OpsReviewResult = Enums["ops_review_result"];

export type OpsActivity = Tables<"ops_activities">;
export type OpsActivityView = Database["public"]["Views"]["v_ops_activities"]["Row"];
export type OpsAssignment = Tables<"ops_assignments">;
export type OpsMaterial = Tables<"ops_materials">;
export type OpsReview = Tables<"ops_reviews">;
export type StageRollup = Database["public"]["Views"]["v_stage_rollup"]["Row"];

/** Alocação do dia com o contexto mínimo para a tela Hoje. */
export type OpsDayAssignment = OpsAssignment & {
  activity: Pick<OpsActivity, "id" | "title" | "status" | "stage_id" | "project_id" | "is_critical"> | null;
};

export const opsRepo = {
  // ---------------- atividades ----------------
  async listActivities(projectId: string) {
    return executeListQuery<OpsActivityView>(async () => {
      return await supabase
        .from("v_ops_activities")
        .select("*")
        .eq("project_id", projectId)
        .order("stage_sort_order", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true });
    });
  },

  async createActivity(input: TablesInsert<"ops_activities">) {
    return executeQuery<OpsActivity>(async () => {
      return await supabase.from("ops_activities").insert(input).select("*").single();
    });
  },

  async updateActivity(id: string, patch: TablesUpdate<"ops_activities">) {
    return executeQuery<OpsActivity>(async () => {
      return await supabase.from("ops_activities").update(patch).eq("id", id).select("*").single();
    });
  },

  async deleteActivity(id: string) {
    return executeQuery<null>(async () => {
      const { error } = await supabase.from("ops_activities").delete().eq("id", id);
      return { data: null, error };
    });
  },

  // ---------------- alocações ----------------
  async listAssignments(projectId: string, from: string, to: string) {
    return executeListQuery<OpsAssignment>(async () => {
      return await supabase
        .from("ops_assignments")
        .select("*")
        .eq("project_id", projectId)
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date", { ascending: true });
    });
  },

  /** Tudo que está alocado num dia (opcionalmente só de uma pessoa). */
  async listDay(date: string, userId?: string | null) {
    return executeListQuery<OpsDayAssignment>(async () => {
      let q = supabase
        .from("ops_assignments")
        .select("*, activity:ops_activities(id, title, status, stage_id, project_id, is_critical)")
        .eq("work_date", date);
      if (userId) q = q.eq("user_id", userId);
      return await q.order("created_at", { ascending: true });
    });
  },

  async createAssignment(input: Omit<TablesInsert<"ops_assignments">, "project_id">) {
    return executeQuery<OpsAssignment>(async () => {
      // project_id é preenchido pelo trigger a partir da atividade.
      return await supabase
        .from("ops_assignments")
        .insert(input)
        .select("*")
        .single();
    });
  },

  /**
   * Feito / Não feito / desfazer (null). "Não feito" exige motivo (CHECK no
   * banco). Quem e quando são carimbados pelo trigger.
   */
  async setOutcome(
    id: string,
    outcome: OpsAssignmentOutcome | null,
    opts: { reason?: OpsBlockReason | null; notes?: string | null; photoPaths?: string[] } = {},
  ) {
    const patch: TablesUpdate<"ops_assignments"> = {
      outcome,
      not_done_reason: outcome === "nao_feito" ? (opts.reason ?? null) : null,
    };
    if (opts.notes !== undefined) patch.notes = opts.notes;
    if (opts.photoPaths !== undefined) patch.photo_paths = opts.photoPaths;
    return executeQuery<OpsAssignment>(async () => {
      return await supabase.from("ops_assignments").update(patch).eq("id", id).select("*").single();
    });
  },

  async deleteAssignment(id: string) {
    return executeQuery<null>(async () => {
      const { error } = await supabase.from("ops_assignments").delete().eq("id", id);
      return { data: null, error };
    });
  },

  // ---------------- materiais ----------------
  async listMaterials(activityId: string) {
    return executeListQuery<OpsMaterial>(async () => {
      return await supabase
        .from("ops_materials")
        .select("*")
        .eq("activity_id", activityId)
        .order("needed_by", { ascending: true, nullsFirst: false });
    });
  },

  async createMaterial(input: Omit<TablesInsert<"ops_materials">, "project_id">) {
    return executeQuery<OpsMaterial>(async () => {
      return await supabase
        .from("ops_materials")
        .insert(input)
        .select("*")
        .single();
    });
  },

  async setMaterialStatus(id: string, status: OpsMaterialStatus) {
    return executeQuery<OpsMaterial>(async () => {
      return await supabase.from("ops_materials").update({ status }).eq("id", id).select("*").single();
    });
  },

  // ---------------- revisões ----------------
  async listReviews(activityId: string) {
    return executeListQuery<OpsReview>(async () => {
      return await supabase
        .from("ops_reviews")
        .select("*")
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false });
    });
  },

  /** Aprovado fecha a atividade; refazer (com observação) cria o retrabalho. */
  async createReview(input: { activity_id: string; result: OpsReviewResult; notes?: string | null; photo_paths?: string[] }) {
    return executeQuery<OpsReview>(async () => {
      return await supabase
        .from("ops_reviews")
        .insert(input)
        .select("*")
        .single();
    });
  },

  // ---------------- ponte com o cliente ----------------
  async listStageRollup(projectId: string) {
    return executeListQuery<StageRollup>(async () => {
      return await supabase
        .from("v_stage_rollup")
        .select("*")
        .eq("project_id", projectId)
        .order("stage_sort_order", { ascending: true });
    });
  },
};
