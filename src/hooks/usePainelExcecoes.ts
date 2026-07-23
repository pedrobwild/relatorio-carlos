/**
 * usePainelExcecoes — contadores cross-domain para a faixa de exceções do
 * Painel de Obras. Cada categoria retorna também o Set de `project_id` que
 * satisfazem a condição, para permitir filtrar a tabela sem duplicar queries.
 *
 * Categorias:
 *   - `nc`   → NCs críticas abertas
 *   - `form` → Formalizações aguardando assinatura há > 5 dias úteis
 *   - `pag`  → Faturas vencidas (project_payments)
 *   - `atv`  → Atividades dos próximos 14 dias sem responsável
 *
 * Sem duplicação de KPIs do MetricRail existente (que trata status/etapa/
 * paralisadas/pendências totais). staleTime alto (60s) para não pesar.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { addBusinessDays } from "@/lib/businessDays";

export type ExcecaoKind = "nc" | "form" | "pag" | "atv";

export interface ExcecaoBuckets {
  counts: Record<ExcecaoKind, number>;
  sets: Record<ExcecaoKind, Set<string>>;
  isLoading: boolean;
}

const STALE = 60_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Data-limite (ISO) para "aguardando há mais de N dias úteis". */
function businessDaysAgoIso(nBusinessDays: number): string {
  // 5 dias úteis atrás a partir de hoje = subtrai N dias úteis.
  const back = addBusinessDays(new Date(), -nBusinessDays);
  return back.toISOString().slice(0, 10);
}

export function usePainelExcecoes(): ExcecaoBuckets {
  const ncsQ = useQuery({
    queryKey: queryKeys.painelExcecoes.ncsCriticas(),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("non_conformities")
        .select("project_id")
        .eq("severity", "critical")
        .in("status", [
          "open",
          "in_treatment",
          "reopened",
          "pending_verification",
          "pending_approval",
        ]);
      if (error) throw error;
      return (data ?? []).map((r) => r.project_id).filter(Boolean) as string[];
    },
  });

  const formQ = useQuery({
    queryKey: queryKeys.painelExcecoes.formalizacoesParadas(),
    staleTime: STALE,
    queryFn: async () => {
      const limit = businessDaysAgoIso(5);
      const { data, error } = await supabase
        .from("formalizations_public_customer")
        .select(
          "project_id, status, last_activity_at, parties_signed, parties_total",
        )
        .eq("status", "pending_signatures")
        .lte("last_activity_at", `${limit}T23:59:59Z`);
      if (error) throw error;
      return (data ?? [])
        .filter((r) => (r.parties_signed ?? 0) < (r.parties_total ?? 0))
        .map((r) => r.project_id)
        .filter((id): id is string => !!id);
    },
  });

  const pagQ = useQuery({
    queryKey: queryKeys.painelExcecoes.faturasVencidas(),
    staleTime: STALE,
    queryFn: async () => {
      const today = todayIso();
      const { data, error } = await supabase
        .from("project_payments")
        .select("project_id, due_date, paid_at")
        .is("paid_at", null)
        .lt("due_date", today);
      if (error) throw error;
      return (data ?? []).map((r) => r.project_id).filter(Boolean) as string[];
    },
  });

  const atvQ = useQuery({
    queryKey: queryKeys.painelExcecoes.atividadesSemResponsavel(),
    staleTime: STALE,
    queryFn: async () => {
      const today = todayIso();
      const to = daysFromNowIso(14);
      const { data, error } = await supabase
        .from("project_activities")
        .select("project_id, planned_start, responsible_user_id")
        .is("responsible_user_id", null)
        .gte("planned_start", today)
        .lte("planned_start", to);
      if (error) throw error;
      return (data ?? []).map((r) => r.project_id).filter(Boolean) as string[];
    },
  });

  return useMemo<ExcecaoBuckets>(() => {
    const toSet = (arr: string[] | undefined) => new Set(arr ?? []);
    const sets: Record<ExcecaoKind, Set<string>> = {
      nc: toSet(ncsQ.data),
      form: toSet(formQ.data),
      pag: toSet(pagQ.data),
      atv: toSet(atvQ.data),
    };
    return {
      sets,
      counts: {
        nc: sets.nc.size,
        form: sets.form.size,
        pag: sets.pag.size,
        atv: sets.atv.size,
      },
      isLoading:
        ncsQ.isLoading || formQ.isLoading || pagQ.isLoading || atvQ.isLoading,
    };
  }, [
    ncsQ.data,
    formQ.data,
    pagQ.data,
    atvQ.data,
    ncsQ.isLoading,
    formQ.isLoading,
    pagQ.isLoading,
    atvQ.isLoading,
  ]);
}
