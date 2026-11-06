/**
 * Compras da obra (`project_purchases`) — gravação de uma nova solicitação.
 *
 * É o MESMO caminho da tela Compras (`useProjectPurchases().addPurchase`, que
 * chama esta função) e do "Pedir compra" da gaveta da atividade na Semana.
 * Os padrões de uma solicitação nova vêm do banco (situação `pending`,
 * unidade `un`, prazo de 7 dias) e do formulário de Compras
 * (`emptyPurchase` em `src/pages/compras/types.ts`).
 *
 * RLS: só equipe com acesso à obra (20260628073734 / 20261011120000).
 */
import { supabase, executeQuery } from "./base.repository";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";

export type ProjectPurchaseRow = Tables<"project_purchases">;
export type CreatePurchaseInput = Omit<TablesInsert<"project_purchases">, "created_by">;

export const purchasesRepo = {
  /** Cria a solicitação de compra; `created_by` é quem está logado. */
  async create(input: CreatePurchaseInput, createdBy: string) {
    return executeQuery<ProjectPurchaseRow>(async () => {
      return await supabase
        .from("project_purchases")
        .insert({ ...input, created_by: createdBy })
        .select()
        .single();
    });
  },

  /**
   * Cria as compras do cronograma semanal (RPC SECURITY DEFINER; datas
   * calculadas no banco por `schedule_purchase_dates`). Devolve quantas entraram.
   */
  async createFromSchedule(projectId: string, items: SchedulePurchaseInput[]) {
    return executeQuery<number>(async () => {
      return await supabase.rpc("create_schedule_purchases", {
        p_project_id: projectId,
        p_items: items as unknown as Json,
      });
    });
  },

  /** Suprimentos informa o prazo do fornecedor e o banco recalcula as datas. */
  async confirmLeadTime(purchaseId: string, days: number) {
    return executeQuery<null>(async () => {
      const { error } = await supabase.rpc("confirm_purchase_lead_time", {
        p_purchase_id: purchaseId,
        p_days: days,
      });
      return { data: null, error };
    });
  },

  /**
   * Itens do orçamento da obra (orcamentos → seções → itens), para suprimentos
   * vincular a compra. Valor orçado = custo interno do item.
   */
  async listProjectBudgetItems(projectId: string) {
    return executeQuery<ProjectBudgetItem[]>(async () => {
      const { data, error } = await supabase
        .from("orcamento_items")
        .select(
          "id, title, item_category, internal_total, orcamento_sections!inner(title, orcamentos!inner(project_id))",
        )
        .eq("orcamento_sections.orcamentos.project_id", projectId)
        .order("order_index", { ascending: true })
        .order("id", { ascending: true })
        .limit(1000);
      if (error) return { data: null, error };
      const rows = (data ?? []).map((r) => {
        const sec = r.orcamento_sections as unknown as { title: string | null } | null;
        return {
          id: r.id,
          name: r.title,
          category: r.item_category,
          section: sec?.title ?? null,
          total: r.internal_total,
        };
      });
      return { data: rows, error: null };
    });
  },

};

export interface ProjectBudgetItem {
  id: string;
  name: string;
  category: string | null;
  section: string | null;
  total: number | null;
}

export interface SchedulePurchaseInput {
  activity_id: string;
  ref_activity_id: string | null;
  item_name: string;
  category: string | null;
  purchase_type: "produto" | "prestador";
  delivery_location: "obra" | "fornecedor";
  delivery_address: string | null;
  template_item_key: string;
  notes: string | null;
  rule: unknown;
}
