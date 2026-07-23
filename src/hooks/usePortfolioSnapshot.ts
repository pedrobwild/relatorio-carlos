/**
 * usePortfolioSnapshot — snapshot gerencial batch do Painel de Obras (staff-only).
 *
 * Consolida avanço físico, custos/EAC, NCs, punch list e lookahead numa
 * única RPC (`get_portfolio_management_snapshot`). Evita N queries por linha.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface PortfolioSnapshotRow {
  project_id: string;
  weighted_progress_pct: number;
  orcado: number | null;
  comprometido: number | null;
  realizado: number | null;
  eac: number | null;
  variacao_pct: number | null;
  ncs_abertas: number;
  ncs_criticas: number;
  punch_abertos: number;
  atividades_proximos_14d_sem_responsavel: number;
  proxima_atividade_titulo: string | null;
  proxima_atividade_data: string | null;
  /** Onda P2 — compras com entrega ≤14d (ou vencida) ainda não recebidas. */
  compras_criticas: number;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function usePortfolioSnapshot() {
  const q = useQuery({
    queryKey: queryKeys.painelSnapshot.list(),
    queryFn: async () => {
      // RPC não tipada nos types gerados; cast controlado no boundary.
      const client = supabase as unknown as {
        rpc: (fn: string) => Promise<{ data: unknown; error: unknown }>;
      };
      const { data, error } = await client.rpc(
        "get_portfolio_management_snapshot",
      );
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      return rows.map<PortfolioSnapshotRow>((r) => ({
        project_id: String(r.project_id ?? ""),
        weighted_progress_pct: toNum(r.weighted_progress_pct) ?? 0,
        orcado: toNum(r.orcado),
        comprometido: toNum(r.comprometido),
        realizado: toNum(r.realizado),
        eac: toNum(r.eac),
        variacao_pct: toNum(r.variacao_pct),
        ncs_abertas: toNum(r.ncs_abertas) ?? 0,
        ncs_criticas: toNum(r.ncs_criticas) ?? 0,
        punch_abertos: toNum(r.punch_abertos) ?? 0,
        atividades_proximos_14d_sem_responsavel:
          toNum(r.atividades_proximos_14d_sem_responsavel) ?? 0,
        proxima_atividade_titulo:
          typeof r.proxima_atividade_titulo === "string"
            ? r.proxima_atividade_titulo
            : null,
        proxima_atividade_data:
          typeof r.proxima_atividade_data === "string"
            ? r.proxima_atividade_data
            : null,
      }));
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const byId = useMemo(() => {
    const m = new Map<string, PortfolioSnapshotRow>();
    for (const r of q.data ?? []) m.set(r.project_id, r);
    return m;
  }, [q.data]);

  return { rows: q.data ?? [], byId, isLoading: q.isLoading, error: q.error };
}
