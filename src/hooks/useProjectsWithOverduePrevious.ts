/**
 * useProjectsWithOverduePrevious — para cada obra com pelo menos UMA atividade
 * anterior à semana visível ainda NÃO concluída, retorna o `project_id` e a
 * data (planned_end) MAIS RECENTE entre essas pendências.
 *
 * Regra de negócio:
 *  - "anterior à semana" = `planned_end < weekStart`
 *  - "não concluída"     = `actual_end IS NULL`
 *
 * A query base busca todas as atividades em atraso até hoje (independe da
 * semana visualizada) — o filtro por `weekStart` é derivado no cliente para
 * reaproveitar o cache entre navegações de semana.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

async function fetchAllOpenPastActivities(): Promise<
  Array<{ project_id: string; planned_end: string }>
> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("project_activities")
    .select("project_id, planned_end")
    .lt("planned_end", today)
    .is("actual_end", null);

  if (error) throw error;
  return (data ?? []) as Array<{ project_id: string; planned_end: string }>;
}

export interface OverduePreviousInfo {
  /** Conjunto de project_ids com etapas anteriores pendentes. */
  ids: Set<string>;
  /**
   * Mapa project_id → data (YYYY-MM-DD) da etapa pendente MAIS RECENTE
   * anterior à semana visível. Útil para mostrar contexto no CTA.
   */
  latestByProject: Map<string, string>;
}

export function useProjectsWithOverduePrevious(weekStart: string) {
  const { user } = useAuth();

  const today = new Date().toISOString().slice(0, 10);

  const query = useQuery({
    queryKey: ["projects-overdue-previous", today],
    queryFn: fetchAllOpenPastActivities,
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const data: OverduePreviousInfo = useMemo(() => {
    const ids = new Set<string>();
    const latestByProject = new Map<string, string>();
    if (!query.data || !weekStart) return { ids, latestByProject };

    for (const r of query.data) {
      if (r.planned_end >= weekStart) continue;
      ids.add(r.project_id);
      const prev = latestByProject.get(r.project_id);
      if (!prev || r.planned_end > prev) {
        latestByProject.set(r.project_id, r.planned_end);
      }
    }
    return { ids, latestByProject };
  }, [query.data, weekStart]);

  return { ...query, data };
}
