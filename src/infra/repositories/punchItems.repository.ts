/**
 * Punch Items Repository — Onda D2 (Qualidade)
 *
 * Lista de pendências de entrega por ambiente. Staff-only (RLS via is_staff()).
 * Aditivo — não altera vistorias, NCs ou qualquer fluxo existente.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";

export type PunchItem = Tables<"punch_items">;
export type PunchStatus = "aberto" | "resolvido" | "verificado";

export interface PunchItemFilters {
  projectId?: string;
  responsibleUserId?: string;
  status?: PunchStatus;
  includeDeleted?: boolean;
}

export const punchItemsRepo = {
  async list(filters: PunchItemFilters = {}) {
    return executeListQuery<PunchItem>(async () => {
      let q = supabase
        .from("punch_items")
        .select("*")
        .order("ambiente", { ascending: true })
        .order("created_at", { ascending: false });
      if (!filters.includeDeleted) q = q.is("deleted_at", null);
      if (filters.projectId) q = q.eq("project_id", filters.projectId);
      if (filters.responsibleUserId)
        q = q.eq("responsible_user_id", filters.responsibleUserId);
      if (filters.status) q = q.eq("status", filters.status);
      return await q;
    });
  },

  async create(payload: {
    project_id: string;
    ambiente: string;
    descricao: string;
    responsible_user_id?: string | null;
    due_date?: string | null;
    photo_path?: string | null;
  }) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error("Não autenticado");
    const insert: TablesInsert<"punch_items"> = {
      project_id: payload.project_id,
      ambiente: payload.ambiente.trim(),
      descricao: payload.descricao.trim(),
      responsible_user_id: payload.responsible_user_id ?? null,
      due_date: payload.due_date ?? null,
      photo_path: payload.photo_path ?? null,
      status: "aberto",
      created_by: uid,
    };
    return executeQuery<PunchItem>(async () => {
      return await supabase
        .from("punch_items")
        .insert(insert)
        .select()
        .single();
    });
  },

  async update(
    id: string,
    payload: Partial<
      Pick<
        PunchItem,
        | "ambiente"
        | "descricao"
        | "responsible_user_id"
        | "due_date"
        | "photo_path"
      >
    >,
  ) {
    const update: TablesUpdate<"punch_items"> = {};
    if (payload.ambiente !== undefined)
      update.ambiente = payload.ambiente.trim();
    if (payload.descricao !== undefined)
      update.descricao = payload.descricao.trim();
    if (payload.responsible_user_id !== undefined)
      update.responsible_user_id = payload.responsible_user_id;
    if (payload.due_date !== undefined) update.due_date = payload.due_date;
    if (payload.photo_path !== undefined)
      update.photo_path = payload.photo_path;
    return executeQuery<PunchItem>(async () => {
      return await supabase
        .from("punch_items")
        .update(update)
        .eq("id", id)
        .select()
        .single();
    });
  },

  async markResolved(id: string) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const update: TablesUpdate<"punch_items"> = {
      status: "resolvido",
      resolved_at: new Date().toISOString(),
      resolved_by: uid,
    };
    return executeQuery<PunchItem>(async () => {
      return await supabase
        .from("punch_items")
        .update(update)
        .eq("id", id)
        .select()
        .single();
    });
  },

  async markVerified(id: string) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const update: TablesUpdate<"punch_items"> = {
      status: "verificado",
      verified_at: new Date().toISOString(),
      verified_by: uid,
    };
    return executeQuery<PunchItem>(async () => {
      return await supabase
        .from("punch_items")
        .update(update)
        .eq("id", id)
        .select()
        .single();
    });
  },

  async reopen(id: string) {
    const update: TablesUpdate<"punch_items"> = {
      status: "aberto",
      resolved_at: null,
      resolved_by: null,
      verified_at: null,
      verified_by: null,
    };
    return executeQuery<PunchItem>(async () => {
      return await supabase
        .from("punch_items")
        .update(update)
        .eq("id", id)
        .select()
        .single();
    });
  },

  async softDelete(id: string) {
    const update: TablesUpdate<"punch_items"> = {
      deleted_at: new Date().toISOString(),
    };
    return executeQuery<PunchItem>(async () => {
      return await supabase
        .from("punch_items")
        .update(update)
        .eq("id", id)
        .select()
        .single();
    });
  },
};
