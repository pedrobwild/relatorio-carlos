/**
 * usePainelPeriodActivities — para o filtro de período do Painel de Obras.
 *
 * Dado um intervalo [from, to] (YYYY-MM-DD), retorna por projeto:
 *   - `scheduled`: atividades cujo planejado intersecta o período
 *   - `overduePrior`: atividades planejadas para ANTES do período que ainda
 *     não foram concluídas (`actual_end IS NULL`) — usadas para sinalizar
 *     "etapa anterior não foi finalizada".
 *
 * Usa duas queries simples na tabela `project_activities` (RLS já garante o
 * recorte por projetos acessíveis). Cache curto, casa com o restante do
 * painel (30s).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PeriodActivity {
  id: string;
  project_id: string;
  description: string;
  etapa: string | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  parent_activity_id: string | null;
  responsible_name: string | null;
}

export interface PeriodProjectBucket {
  scheduled: PeriodActivity[];
  overduePrior: PeriodActivity[];
}

const SELECT = `
  id,
  project_id,
  description,
  etapa,
  planned_start,
  planned_end,
  actual_start,
  actual_end,
  parent_activity_id,
  responsible:responsible_user_id ( nome )
` as const;

function mapRow(row: any): PeriodActivity {
  return {
    id: row.id,
    project_id: row.project_id,
    description: row.description,
    etapa: row.etapa ?? null,
    planned_start: row.planned_start,
    planned_end: row.planned_end,
    actual_start: row.actual_start ?? null,
    actual_end: row.actual_end ?? null,
    parent_activity_id: row.parent_activity_id ?? null,
    responsible_name: row.responsible?.nome ?? null,
  };
}

export function usePainelPeriodActivities(
  from: string | null,
  to: string | null,
) {
  const { user } = useAuth();
  const enabled = !!user && !!from && !!to;

  const queryKey = ["painel-period-activities", from, to] as const;

  const query = useQuery({
    queryKey,
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<PeriodActivity[]> => {
      if (!from || !to) return [];
      // Atividades com janela planejada sobrepondo [from, to]
      // OU planejadas antes de `from` mas ainda em aberto (overdue prior).
      const { data: scheduled, error: e1 } = await supabase
        .from("project_activities")
        .select(SELECT)
        .lte("planned_start", to)
        .gte("planned_end", from)
        .order("planned_start", { ascending: true });
      if (e1) throw e1;

      const { data: overdue, error: e2 } = await supabase
        .from("project_activities")
        .select(SELECT)
        .lt("planned_end", from)
        .is("actual_end", null)
        .order("planned_end", { ascending: true });
      if (e2) throw e2;

      const seen = new Set<string>();
      const out: PeriodActivity[] = [];
      for (const r of [...(scheduled ?? []), ...(overdue ?? [])]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(mapRow(r));
      }
      return out;
    },
  });

  const byProject = useMemo(() => {
    const map = new Map<string, PeriodProjectBucket>();
    if (!from || !to) return map;
    for (const a of query.data ?? []) {
      let bucket = map.get(a.project_id);
      if (!bucket) {
        bucket = { scheduled: [], overduePrior: [] };
        map.set(a.project_id, bucket);
      }
      const overlaps = a.planned_start <= to && a.planned_end >= from;
      if (overlaps) {
        bucket.scheduled.push(a);
      } else if (a.planned_end < from && !a.actual_end) {
        bucket.overduePrior.push(a);
      }
    }
    // Apenas projetos com atividades programadas no período entram na lista
    // visível — overdues isolados (sem nada na semana) não aparecem.
    for (const [pid, bucket] of map) {
      if (bucket.scheduled.length === 0) map.delete(pid);
    }
    return map;
  }, [query.data, from, to]);

  return {
    byProject,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
