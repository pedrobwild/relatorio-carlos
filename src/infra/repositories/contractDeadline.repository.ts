/**
 * Prazo contratual — Fase 1 da reformulação do processo core.
 *
 * Lê `v_project_deadlines` (cálculo de dias úteis feito no banco, com feriados
 * e dias não úteis da obra) e grava os termos do contrato em `projects`.
 * Staff-only: a view filtra por `is_staff` e o cliente nunca chama isto.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";
import { OPS_PHOTOS_BUCKET } from "./ops.repository";

export type ProjectDeadline = Database["public"]["Views"]["v_project_deadlines"]["Row"];
export type ContractAmendment = Tables<"contract_term_amendments">;
export type ContractStartTrigger = Database["public"]["Enums"]["contract_start_trigger"];
export type ContractAmendmentStatus = Database["public"]["Enums"]["contract_amendment_status"];
export type ContractAmendmentInput = Pick<
  TablesInsert<"contract_term_amendments">,
  "project_id" | "reason" | "business_days_added" | "description" | "event_date" | "evidence_urls"
>;

export interface ContractTermsInput {
  contract_business_days: number | null;
  contract_start_trigger: ContractStartTrigger | null;
  contract_start_date: string | null;
  penalty_pct_per_day: number | null;
  penalty_cap_pct: number | null;
  /** Marca os termos como conferidos com o contrato assinado. */
  confirm: boolean;
}

export const contractDeadlineRepo = {
  async getByProject(projectId: string) {
    return executeQuery<ProjectDeadline>(async () => {
      return await supabase
        .from("v_project_deadlines")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
    });
  },

  /** Prazos de todas as obras em execução (ativas e concluídas). */
  async listObras() {
    return executeListQuery<ProjectDeadline>(async () => {
      return await supabase
        .from("v_project_deadlines")
        .select("*")
        .eq("is_project_phase", false);
    });
  },

  async updateTerms(projectId: string, input: ContractTermsInput) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const patch = {
      contract_business_days: input.contract_business_days,
      contract_start_trigger: input.contract_start_trigger,
      contract_start_date: input.contract_start_date,
      penalty_pct_per_day: input.penalty_pct_per_day,
      penalty_cap_pct: input.penalty_cap_pct,
      ...(input.confirm
        ? { contract_terms_confirmed_at: new Date().toISOString(), contract_terms_confirmed_by: uid }
        : {}),
    };
    return executeQuery<{ id: string }>(async () => {
      return await supabase
        .from("projects")
        .update(patch)
        .eq("id", projectId)
        .select("id")
        .single();
    });
  },

  async listAmendments(projectId: string) {
    return executeListQuery<ContractAmendment>(async () => {
      return await supabase
        .from("contract_term_amendments")
        .select("*")
        .eq("project_id", projectId)
        .order("event_date", { ascending: false });
    });
  },

  /**
   * Cria o aditivo SEMPRE como rascunho: quem envia ao cliente e marca como
   * aceito é o escritório (só o aceito conta no prazo e aparece ao cliente).
   */
  async createAmendment(input: ContractAmendmentInput) {
    return executeQuery<ContractAmendment>(async () => {
      return await supabase
        .from("contract_term_amendments")
        .insert({ ...input, status: "rascunho" })
        .select("*")
        .single();
    });
  },

  async updateAmendmentStatus(id: string, status: ContractAmendmentStatus) {
    return executeQuery<ContractAmendment>(async () => {
      return await supabase
        .from("contract_term_amendments")
        .update({ status })
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  /** Só rascunho pode ser apagado (o que já foi ao cliente fica registrado). */
  async deleteDraftAmendment(id: string) {
    return executeQuery<null>(async () => {
      const { error } = await supabase
        .from("contract_term_amendments")
        .delete()
        .eq("id", id)
        .eq("status", "rascunho");
      return { data: null, error };
    });
  },

  /**
   * Foto de evidência do aditivo, no mesmo bucket privado das fotos de campo
   * (`ops-photos`, só equipe). O caminho começa pelo project_id porque é isso
   * que a policy do bucket usa para checar o acesso à obra. Devolve o caminho,
   * que é o que vai em `evidence_urls`.
   */
  async uploadEvidence(projectId: string, file: File) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${projectId}/aditivos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(OPS_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (error) return { data: null, error };
    return { data: path, error: null };
  },
};
