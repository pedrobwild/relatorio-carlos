/**
 * Ficha da obra — `project_studio_info` (uma linha por obra).
 *
 * Endereço, chaves, fechadura, regras do condomínio e contatos do prédio.
 * RLS: somente staff com acesso à obra; o cliente não vê esta tabela.
 */
import { supabase, executeQuery } from "./base.repository";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type StudioInfo = Tables<"project_studio_info">;

/** Campos que a ficha pode gravar (a obra e os carimbos não entram). */
export type StudioInfoPatch = Omit<TablesUpdate<"project_studio_info">, "project_id" | "created_at" | "updated_at">;

export const studioInfoRepo = {
  /** `data: null` sem erro = a obra ainda não tem ficha preenchida. */
  async getStudioInfo(projectId: string) {
    return executeQuery<StudioInfo>(async () => {
      return await supabase.from("project_studio_info").select("*").eq("project_id", projectId).maybeSingle();
    });
  },

  /**
   * Cria a linha da obra ou atualiza SÓ os campos enviados: o que não está no
   * `patch` fica como está no banco (não apaga o que outra pessoa preencheu).
   */
  async upsertStudioInfo(projectId: string, patch: StudioInfoPatch) {
    return executeQuery<StudioInfo>(async () => {
      return await supabase
        .from("project_studio_info")
        .upsert({ ...patch, project_id: projectId }, { onConflict: "project_id" })
        .select("*")
        .single();
    });
  },
};
