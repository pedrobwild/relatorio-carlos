/**
 * Menções em observações internas — pendências entre a equipe (staff-only).
 * Ver a migration `20261124130100_project_internal_note_mentions.sql`.
 *
 * O sigilo é garantido no banco: a única policy da tabela é de leitura e
 * exige `is_staff()`. Marcar e resolver passam por RPCs SECURITY DEFINER —
 * só equipe é marcável e só quem foi marcado resolve.
 *
 * A tabela ainda não está nos tipos gerados (`integrations/supabase/types`);
 * por isso o acesso sem tipo abaixo, com a linha declarada aqui.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { PostgrestError } from "@supabase/supabase-js";

export interface InternalNoteMention {
  id: string;
  note_id: string;
  project_id: string;
  mentioned_user_id: string;
  mentioned_name: string;
  requested_by: string;
  requested_by_name: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolution_note: string | null;
  archived_at: string | null;
}

/** Menção aberta com o contexto para as listas pessoais. */
export interface OpenInternalNoteMention extends InternalNoteMention {
  project: { id: string; name: string; painel_responsavel_id: string | null } | null;
  note: { body: string; category: string } | null;
  /** = project.painel_responsavel_id (para as regras de `lib/mencoes`). */
  responsavel_obra_id: string | null;
}

export const RESOLUTION_NOTE_MAX_LENGTH = 1000;
export const MAX_MENTIONS_PER_NOTE = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnsafeBuilder = any;
const unsafeFrom = (table: string): UnsafeBuilder =>
  (supabase.from as unknown as (t: string) => UnsafeBuilder)(table);
const unsafeRpc = (fn: string, args: Record<string, unknown>) =>
  (
    supabase.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: PostgrestError | null }>
  )(fn, args);

const TABLE = "project_internal_note_mentions";

export const internalNoteMentionsRepo = {
  /** Histórico da obra: abertas e resolvidas (arquivadas ficam de fora). */
  async listByProject(projectId: string) {
    return executeListQuery<InternalNoteMention>(async () => {
      return await unsafeFrom(TABLE)
        .select("*")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .order("created_at", { ascending: true });
    });
  },

  /**
   * Todas as menções abertas, com obra e texto. A equipe inteira pode ler
   * (como as observações internas); quem está logado filtra as suas em
   * `agruparMencoes`. Aberta é exceção, não regra: a lista é curta.
   */
  async listOpen() {
    return executeListQuery<OpenInternalNoteMention>(async () => {
      const { data, error } = await unsafeFrom(TABLE)
        .select(
          "*, project:projects(id, name, painel_responsavel_id), note:project_internal_notes(body, category)",
        )
        .is("resolved_at", null)
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .limit(500);
      const rows = ((data ?? []) as Array<Omit<OpenInternalNoteMention, "responsavel_obra_id">>).map((r) => ({
        ...r,
        responsavel_obra_id: r.project?.painel_responsavel_id ?? null,
      }));
      return { data: rows, error };
    });
  },

  /** Define quem está marcado na observação. Devolve quantos foram avisados. */
  async setMentions(noteId: string, userIds: string[]) {
    return executeQuery<number>(async () => {
      const { data, error } = await unsafeRpc("set_project_internal_note_mentions", {
        p_note_id: noteId,
        p_user_ids: userIds,
      });
      return { data: (data as number | null) ?? 0, error };
    });
  },

  /** Só quem foi marcado resolve. A resposta é opcional. */
  async resolve(mentionId: string, resposta: string | null) {
    return executeQuery<InternalNoteMention>(async () => {
      const { data, error } = await unsafeRpc("resolve_project_internal_note_mention", {
        p_mention_id: mentionId,
        p_resposta: resposta,
      });
      return { data: (data as InternalNoteMention | null) ?? null, error };
    });
  },
};
