/**
 * Prazo contratual — Fase 1 da reformulação do processo core.
 *
 * Lê `v_project_deadlines` (cálculo de dias úteis feito no banco, com feriados
 * e dias não úteis da obra) e grava os termos do contrato em `projects`.
 * Staff-only: a view filtra por `is_staff` e o cliente nunca chama isto.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { Database, Tables } from "@/integrations/supabase/types";

export type ProjectDeadline = Database["public"]["Views"]["v_project_deadlines"]["Row"];
export type ContractAmendment = Tables<"contract_term_amendments">;
export type ContractStartTrigger = Database["public"]["Enums"]["contract_start_trigger"];

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

  async listActive() {
    return executeListQuery<ProjectDeadline>(async () => {
      return await supabase
        .from("v_project_deadlines")
        .select("*")
        .eq("status", "active")
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
};
