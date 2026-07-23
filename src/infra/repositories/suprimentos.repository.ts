/**
 * Suprimentos Repository — Onda E1
 *
 * Requisições de material, itens e mapa de cotações. Staff-only via RLS.
 * Conversão em pedido reutiliza `project_purchases` sem alterar seu fluxo.
 */
import { supabase, executeListQuery, executeQuery } from "./base.repository";
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";

export type MaterialRequisition = Tables<"material_requisitions">;
export type MaterialRequisitionItem = Tables<"material_requisition_items">;
export type RequisitionQuote = Tables<"requisition_quotes">;

export type RequisitionStatus =
  | "rascunho"
  | "aberta"
  | "em_cotacao"
  | "pedido_emitido"
  | "atendida"
  | "cancelada";

export interface RequisitionFilters {
  projectId?: string;
  status?: RequisitionStatus;
  includeDeleted?: boolean;
}

export const suprimentosRepo = {
  // ---------------- Requisições ----------------
  async list(filters: RequisitionFilters = {}) {
    return executeListQuery<MaterialRequisition>(async () => {
      let q = supabase
        .from("material_requisitions")
        .select("*")
        .order("created_at", { ascending: false });
      if (!filters.includeDeleted) q = q.is("deleted_at", null);
      if (filters.projectId) q = q.eq("project_id", filters.projectId);
      if (filters.status) q = q.eq("status", filters.status);
      return await q;
    });
  },

  async get(id: string) {
    return executeQuery<MaterialRequisition>(async () => {
      return await supabase
        .from("material_requisitions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
    });
  },

  async create(payload: {
    project_id: string;
    needed_by?: string | null;
    notes?: string | null;
    status?: RequisitionStatus;
  }) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error("Não autenticado");
    const insert: TablesInsert<"material_requisitions"> = {
      project_id: payload.project_id,
      requested_by: uid,
      needed_by: payload.needed_by ?? null,
      notes: payload.notes ?? null,
      status: payload.status ?? "aberta",
    };
    return executeQuery<MaterialRequisition>(async () => {
      return await supabase
        .from("material_requisitions")
        .insert(insert)
        .select("*")
        .single();
    });
  },

  async update(id: string, patch: TablesUpdate<"material_requisitions">) {
    return executeQuery<MaterialRequisition>(async () => {
      return await supabase
        .from("material_requisitions")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  async softDelete(id: string) {
    return executeQuery<MaterialRequisition>(async () => {
      return await supabase
        .from("material_requisitions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  // ---------------- Itens ----------------
  async listItems(requisitionId: string) {
    return executeListQuery<MaterialRequisitionItem>(async () => {
      return await supabase
        .from("material_requisition_items")
        .select("*")
        .eq("requisition_id", requisitionId)
        .order("created_at", { ascending: true });
    });
  },

  async addItem(payload: {
    requisition_id: string;
    descricao: string;
    quantidade: number;
    unidade: string;
    categoria?: string | null;
    observacao?: string | null;
  }) {
    const insert: TablesInsert<"material_requisition_items"> = {
      requisition_id: payload.requisition_id,
      descricao: payload.descricao.trim(),
      quantidade: payload.quantidade,
      unidade: payload.unidade.trim() || "un",
      categoria: payload.categoria?.trim() || null,
      observacao: payload.observacao?.trim() || null,
    };
    return executeQuery<MaterialRequisitionItem>(async () => {
      return await supabase
        .from("material_requisition_items")
        .insert(insert)
        .select("*")
        .single();
    });
  },

  async updateItem(
    id: string,
    patch: TablesUpdate<"material_requisition_items">,
  ) {
    return executeQuery<MaterialRequisitionItem>(async () => {
      return await supabase
        .from("material_requisition_items")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  async removeItem(id: string) {
    return executeQuery<MaterialRequisitionItem>(async () => {
      return await supabase
        .from("material_requisition_items")
        .delete()
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  // ---------------- Cotações ----------------
  async listQuotes(requisitionId: string) {
    return executeListQuery<RequisitionQuote>(async () => {
      return await supabase
        .from("requisition_quotes")
        .select("*")
        .eq("requisition_id", requisitionId)
        .order("created_at", { ascending: true });
    });
  },

  async addQuote(payload: {
    requisition_id: string;
    supplier_id?: string | null;
    valor_total?: number | null;
    prazo_entrega_dias?: number | null;
    frete?: number | null;
    validade?: string | null;
    observacao?: string | null;
    arquivo_path?: string | null;
  }) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error("Não autenticado");
    const insert: TablesInsert<"requisition_quotes"> = {
      requisition_id: payload.requisition_id,
      supplier_id: payload.supplier_id ?? null,
      valor_total: payload.valor_total ?? null,
      prazo_entrega_dias: payload.prazo_entrega_dias ?? null,
      frete: payload.frete ?? null,
      validade: payload.validade ?? null,
      observacao: payload.observacao?.trim() || null,
      arquivo_path: payload.arquivo_path ?? null,
      created_by: uid,
    };
    return executeQuery<RequisitionQuote>(async () => {
      return await supabase
        .from("requisition_quotes")
        .insert(insert)
        .select("*")
        .single();
    });
  },

  async updateQuote(id: string, patch: TablesUpdate<"requisition_quotes">) {
    return executeQuery<RequisitionQuote>(async () => {
      return await supabase
        .from("requisition_quotes")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  async removeQuote(id: string) {
    return executeQuery<RequisitionQuote>(async () => {
      return await supabase
        .from("requisition_quotes")
        .delete()
        .eq("id", id)
        .select("*")
        .single();
    });
  },

  /**
   * Marca a cotação como vencedora (única por requisição — garantido por índice
   * único parcial). Zera as demais para manter consistência.
   */
  async selectWinner(requisitionId: string, quoteId: string) {
    // Desmarca as outras
    const { error: e1 } = await supabase
      .from("requisition_quotes")
      .update({ is_winner: false })
      .eq("requisition_id", requisitionId)
      .neq("id", quoteId);
    if (e1) throw e1;
    const { error: e2 } = await supabase
      .from("requisition_quotes")
      .update({ is_winner: true })
      .eq("id", quoteId);
    if (e2) throw e2;
    // Move requisição para "em_cotacao" caso ainda esteja aberta
    await supabase
      .from("material_requisitions")
      .update({ status: "em_cotacao" })
      .eq("id", requisitionId)
      .in("status", ["aberta", "rascunho"]);
    return { ok: true } as const;
  },

  /**
   * Conversão em pedido: cria UM registro em `project_purchases` por item da
   * requisição, vinculando `requisition_id`. Reutiliza colunas existentes;
   * não altera fluxo de compras.
   */
  async convertToPurchase(requisitionId: string) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error("Não autenticado");

    const { data: req, error: reqErr } = await supabase
      .from("material_requisitions")
      .select("*")
      .eq("id", requisitionId)
      .single();
    if (reqErr || !req) throw reqErr ?? new Error("Requisição não encontrada");

    const { data: winner, error: wErr } = await supabase
      .from("requisition_quotes")
      .select("*")
      .eq("requisition_id", requisitionId)
      .eq("is_winner", true)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!winner) throw new Error("Selecione uma cotação vencedora antes de gerar o pedido.");

    const { data: items, error: itemsErr } = await supabase
      .from("material_requisition_items")
      .select("*")
      .eq("requisition_id", requisitionId);
    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0)
      throw new Error("Requisição sem itens para converter.");

    const requiredBy =
      req.needed_by ?? new Date().toISOString().slice(0, 10);
    const leadTime = winner.prazo_entrega_dias ?? 0;

    const rows: TablesInsert<"project_purchases">[] = items.map((it) => ({
      project_id: req.project_id,
      requisition_id: requisitionId,
      fornecedor_id: winner.supplier_id ?? null,
      item_name: it.descricao,
      quantity: Number(it.quantidade) || 1,
      unit: it.unidade || "un",
      category: it.categoria ?? null,
      notes: it.observacao ?? null,
      required_by_date: requiredBy,
      lead_time_days: leadTime,
      estimated_cost:
        winner.valor_total != null && items.length > 0
          ? Number(winner.valor_total) / items.length
          : null,
      shipping_cost: winner.frete ?? null,
      status: "ordered",
      purchase_type: "produto",
      created_by: uid,
    }));

    const { data: created, error: createErr } = await supabase
      .from("project_purchases")
      .insert(rows)
      .select("id");
    if (createErr) throw createErr;

    await supabase
      .from("material_requisitions")
      .update({ status: "pedido_emitido" })
      .eq("id", requisitionId);

    return { count: created?.length ?? 0 } as const;
  },
};
