/**
 * Project Internal Notes Repository — observações internas da obra (staff-only).
 *
 * Canal da equipe (obras + CS) para registrar contexto que o cliente NÃO vê,
 * p.ex. por que a obra está sem atualização. O sigilo é garantido no banco:
 * todas as policies de `project_internal_notes` exigem `is_staff()`.
 *
 * Autoria (`author_id`, `author_name`) é preenchida por trigger a partir de
 * `auth.uid()`; o front não envia. Cada obra tem no máximo uma nota fixada —
 * fixar uma desafixa a anterior (trigger), via RPC para qualquer colaborador.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type ProjectInternalNote = Tables<"project_internal_notes">;

export const INTERNAL_NOTE_CATEGORIES = [
  "sem_atualizacao",
  "aguardando_cliente",
  "aguardando_material",
  "obra_pausada",
  "outro",
] as const;

export type InternalNoteCategory = (typeof INTERNAL_NOTE_CATEGORIES)[number];

/** Limite espelhado do CHECK no banco. */
export const INTERNAL_NOTE_MAX_LENGTH = 4000;

export interface CreateInternalNoteInput {
  projectId: string;
  body: string;
  category: InternalNoteCategory;
  /** Fixa como "status atual" da obra (desafixa a anterior). */
  pin?: boolean;
}

export interface UpdateInternalNoteInput {
  body?: string;
  category?: InternalNoteCategory;
}

export const projectInternalNotesRepo = {
  /** Feed da obra: fixada primeiro, depois as mais recentes. */
  async listByProject(projectId: string) {
    return executeListQuery<ProjectInternalNote>(async () => {
      return await supabase
        .from("project_internal_notes")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
    });
  },

  /**
   * Notas fixadas de todas as obras (uma por obra, garantido por índice
   * único). Alimenta os indicadores do Painel de Obras e do CS numa única
   * query — sem `in(project_id, ...)`, que estoura a URL com muitas obras.
   */
  async listPinned() {
    return executeListQuery<ProjectInternalNote>(async () => {
      return await supabase
        .from("project_internal_notes")
        .select("*")
        .eq("is_pinned", true)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
    });
  },

  async create(input: CreateInternalNoteInput) {
    return executeQuery<ProjectInternalNote>(async () => {
      return await supabase
        .from("project_internal_notes")
        .insert({
          project_id: input.projectId,
          body: input.body.trim(),
          category: input.category,
          is_pinned: input.pin ?? false,
        })
        .select()
        .single();
    });
  },

  async update(id: string, input: UpdateInternalNoteInput) {
    const update: TablesUpdate<"project_internal_notes"> = {};
    if (input.body !== undefined) update.body = input.body.trim();
    if (input.category !== undefined) update.category = input.category;
    return executeQuery<ProjectInternalNote>(async () => {
      return await supabase
        .from("project_internal_notes")
        .update(update)
        .eq("id", id)
        .select()
        .single();
    });
  },

  /** Qualquer colaborador pode fixar/desafixar (RPC SECURITY DEFINER). */
  async setPinned(id: string, pinned: boolean) {
    return executeQuery<null>(async () => {
      const { error } = await supabase.rpc("set_project_internal_note_pinned", {
        p_note_id: id,
        p_pinned: pinned,
      });
      return { data: null, error };
    });
  },

  async softDelete(id: string) {
    return executeQuery<ProjectInternalNote>(async () => {
      return await supabase
        .from("project_internal_notes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    });
  },
};
