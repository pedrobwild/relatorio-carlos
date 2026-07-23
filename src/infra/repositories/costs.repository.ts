/**
 * costs.repository — consolidação de custos por obra (Onda B1, staff-only).
 *
 * Todas as RPCs são SECURITY DEFINER com guard `is_staff() + has_project_access()`.
 * Nunca chamar a partir de superfícies do cliente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CostSummaryRow {
  category: string;
  orcado: number;
  comprometido: number;
  realizado: number;
  saldo: number;
  consumido_pct: number | null;
  purchases_count: number;
}

export interface CostTotals {
  orcado: number;
  comprometido: number;
  realizado: number;
  saldo: number;
  eac: number;
  variacao: number;
  variacao_pct: number | null;
  categories_count: number;
  categories_over_budget: number;
}

const toNumber = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toNullableNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const costsRepo = {
  async getSummary(projectId: string): Promise<CostSummaryRow[]> {
    const { data, error } = await supabase.rpc("get_project_cost_summary", {
      p_project_id: projectId,
    });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      category: String(row.category ?? "Sem categoria"),
      orcado: toNumber(row.orcado),
      comprometido: toNumber(row.comprometido),
      realizado: toNumber(row.realizado),
      saldo: toNumber(row.saldo),
      consumido_pct: toNullableNumber(row.consumido_pct),
      purchases_count: Number(row.purchases_count ?? 0),
    }));
  },

  async getTotals(projectId: string): Promise<CostTotals | null> {
    const { data, error } = await supabase.rpc("get_project_cost_totals", {
      p_project_id: projectId,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      orcado: toNumber(row.orcado),
      comprometido: toNumber(row.comprometido),
      realizado: toNumber(row.realizado),
      saldo: toNumber(row.saldo),
      eac: toNumber(row.eac),
      variacao: toNumber(row.variacao),
      variacao_pct: toNullableNumber(row.variacao_pct),
      categories_count: Number(row.categories_count ?? 0),
      categories_over_budget: Number(row.categories_over_budget ?? 0),
    };
  },
};
