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
  activity:
    | (Pick<OpsActivity, "id" | "title" | "status" | "stage_id" | "project_id" | "is_critical"> & {
        stage: { description: string } | null;
      })
    | null;
  project: { id: string; name: string } | null;
  fornecedor: { nome: string } | null;
};

/** Etapa do cronograma do cliente (o necessário para pendurar e planejar). */
export type OpsStageOption = {
  id: string;
  description: string;
  sort_order: number;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
};

/** Campos de uma alocação que a tela Semana pode mudar (dia e quem). */
export type OpsAssignmentPlanPatch = Pick<
  TablesUpdate<"ops_assignments">,
  "work_date" | "user_id" | "worker_name" | "fornecedor_id" | "notes"
>;

/** Prontidão da atividade (vem da view): usado nos avisos de material. */
export type OpsActivityReadiness = Pick<
  OpsActivityView,
  "id" | "materials_missing" | "materials_total" | "is_ready"
>;

export const OPS_PHOTOS_BUCKET = "ops-photos";

const DAY_SELECT =
  "*, activity:ops_activities(id, title, status, stage_id, project_id, is_critical, stage:project_activities(description)), project:projects(id, name), fornecedor:fornecedores(nome)";

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
        .select(DAY_SELECT)
        .eq("work_date", date);
      if (userId) q = q.eq("user_id", userId);
      return await q.order("created_at", { ascending: true });
    });
  },

  /** Contadores de material das atividades do dia (uma consulta para todas). */
  async listReadiness(activityIds: string[]) {
    if (activityIds.length === 0) return { data: [] as OpsActivityReadiness[], error: null };
    return executeListQuery<OpsActivityReadiness>(async () => {
      return await supabase
        .from("v_ops_activities")
        .select("id, materials_missing, materials_total, is_ready")
        .in("id", activityIds);
    });
  },

  /** Etapas do cronograma da obra, na ordem do cronograma. */
  async listStages(projectId: string) {
    return executeListQuery<OpsStageOption>(async () => {
      return await supabase
        .from("project_activities")
        .select("id, description, sort_order, planned_start, planned_end, actual_start, actual_end")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
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

  /** Todas as alocações de uma atividade (histórico na gaveta). */
  async listAssignmentsByActivity(activityId: string) {
    return executeListQuery<OpsAssignment>(async () => {
      return await supabase
        .from("ops_assignments")
        .select("*")
        .eq("activity_id", activityId)
        .order("work_date", { ascending: true });
    });
  },

  /** Planejamento em lote (Planejar semana). project_id vem do trigger. */
  async createAssignments(rows: Omit<TablesInsert<"ops_assignments">, "project_id">[]) {
    if (rows.length === 0) return { data: [] as OpsAssignment[], error: null };
    return executeListQuery<OpsAssignment>(async () => {
      return await supabase
        .from("ops_assignments")
        .insert(rows as TablesInsert<"ops_assignments">[])
        .select("*");
    });
  },

  /** Mover de dia / trocar quem faz. Não mexe em Feito / Não feito. */
  async updateAssignmentPlan(id: string, patch: OpsAssignmentPlanPatch) {
    return executeQuery<OpsAssignment>(async () => {
      return await supabase.from("ops_assignments").update(patch).eq("id", id).select("*").single();
    });
  },

  /** Acrescenta fotos sem mexer no Feito / Não feito. */
  async setPhotos(id: string, photoPaths: string[]) {
    return executeQuery<OpsAssignment>(async () => {
      return await supabase
        .from("ops_assignments")
        .update({ photo_paths: photoPaths })
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  /**
   * Envia uma foto de campo. O caminho começa pelo project_id porque é isso
   * que a policy do bucket usa para checar o acesso à obra.
   */
  async uploadPhoto(projectId: string, assignmentId: string, file: File) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${projectId}/${assignmentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(OPS_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (error) return { data: null, error };
    return { data: path, error: null };
  },

  /** URLs temporárias (1 h) para mostrar as fotos. */
  async getPhotoUrls(paths: string[]) {
    if (paths.length === 0) return { data: [] as { path: string; url: string }[], error: null };
    const { data, error } = await supabase.storage.from(OPS_PHOTOS_BUCKET).createSignedUrls(paths, 3600);
    if (error) return { data: null, error };
    return {
      data: (data ?? []).flatMap((d) => (d.signedUrl ? [{ path: d.path ?? "", url: d.signedUrl }] : [])),
      error: null,
    };
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

  /** Materiais de toda a obra (faixa de material da Semana). */
  async listMaterialsByProject(projectId: string) {
    return executeListQuery<OpsMaterial>(async () => {
      return await supabase
        .from("ops_materials")
        .select("*")
        .eq("project_id", projectId)
        .order("needed_by", { ascending: true, nullsFirst: false });
    });
  },

  async deleteMaterial(id: string) {
    return executeQuery<null>(async () => {
      const { error } = await supabase.from("ops_materials").delete().eq("id", id);
      return { data: null, error };
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
