/**
 * Purchase Receipts Repository — Onda E2
 *
 * Recebimentos parciais/totais vinculados a uma compra (`project_purchases`).
 * Staff-only via RLS. Não altera nenhum comportamento do fluxo de compras.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type PurchaseReceipt = Tables<"purchase_receipts">;

export const purchaseReceiptsRepo = {
  async listByPurchase(purchaseId: string) {
    return executeListQuery<PurchaseReceipt>(async () => {
      return await supabase
        .from("purchase_receipts")
        .select("*")
        .eq("purchase_id", purchaseId)
        .is("deleted_at", null)
        .order("received_on", { ascending: false });
    });
  },

  async create(payload: {
    purchase_id: string;
    received_on: string;
    quantidade?: number | null;
    valor?: number | null;
    notes?: string | null;
    photo_path?: string | null;
    received_by?: string | null;
  }) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error("Não autenticado");
    const insert: TablesInsert<"purchase_receipts"> = {
      purchase_id: payload.purchase_id,
      received_on: payload.received_on,
      quantidade: payload.quantidade ?? null,
      valor: payload.valor ?? null,
      notes: payload.notes ?? null,
      photo_path: payload.photo_path ?? null,
      received_by: payload.received_by ?? uid,
      created_by: uid,
    };
    return executeQuery<PurchaseReceipt>(async () => {
      return await supabase
        .from("purchase_receipts")
        .insert(insert)
        .select("*")
        .single();
    });
  },

  async update(id: string, patch: TablesUpdate<"purchase_receipts">) {
    return executeQuery<PurchaseReceipt>(async () => {
      return await supabase
        .from("purchase_receipts")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  async softDelete(id: string) {
    return executeQuery<PurchaseReceipt>(async () => {
      return await supabase
        .from("purchase_receipts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  /**
   * Recebimentos agrupados por compra — usado em telas de listagem
   * (Calendário de Compras, Suprimentos) para derivar "entrega pendente".
   */
  async listByPurchaseIds(purchaseIds: string[]) {
    if (purchaseIds.length === 0)
      return { data: [] as PurchaseReceipt[], error: null };
    return executeListQuery<PurchaseReceipt>(async () => {
      return await supabase
        .from("purchase_receipts")
        .select("*")
        .in("purchase_id", purchaseIds)
        .is("deleted_at", null);
    });
  },
};

export default purchaseReceiptsRepo;
