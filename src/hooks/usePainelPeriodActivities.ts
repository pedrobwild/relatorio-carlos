/**
 * usePainelPeriodActivities — para o filtro de período do Painel de Obras.
 *
 * Dado um intervalo [from, to] (YYYY-MM-DD), retorna por projeto:
 *   - `scheduled`: atividades cujo planejado intersecta o período
 *   - `overduePrior`: atividades planejadas para ANTES do período que ainda
 *     não foram concluídas (`actual_end IS NULL`) — usadas para sinalizar
 *     "etapa anterior não foi finalizada".
 *
 * Lê o CRONOGRAMA INTERNO (`internal_schedule_items`, staff-only) — o Painel
 * olha para o que a equipe vai executar, não para o cronograma do cliente.
 * Duas queries simples (RLS garante o recorte por obras acessíveis). Cache
 * curto, casa com o restante do painel (30s).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { queryKeys } from "@/lib/queryKeys";
import {
  internalScheduleRepo,
  type InternalScheduleItemWithProject,
} from "@/infra/repositories/internalSchedule.repository";

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

function mapRow(row: InternalScheduleItemWithProject): PeriodActivity {
  return {
    id: row.id,
    project_id: row.project_id,
    description: row.description,
    etapa: row.etapa ?? null,
    planned_start: row.planned_start,
    planned_end: row.planned_end,
    actual_start: row.actual_start ?? null,
    actual_end: row.actual_end ?? null,
    parent_activity_id: row.parent_id ?? null,
    responsible_name: row.responsible?.nome ?? null,
  };
}

export function usePainelPeriodActivities(
  from: string | null,
  to: string | null,
) {
  const { user } = useAuth();
  const enabled = !!user && !!from && !!to;

  const queryKey = queryKeys.internalSchedule.period(from, to);

  const query = useQuery({
    queryKey,
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<PeriodActivity[]> => {
      if (!from || !to) return [];
      // Atividades com janela planejada sobrepondo [from, to]
      // OU planejadas antes de `from` mas ainda em aberto (overdue prior).
      const scheduledRes = await internalScheduleRepo.listOverlapping(from, to);
      if (scheduledRes.error) throw scheduledRes.error;
      const overdueRes = await internalScheduleRepo.listOpenEndingBefore(from);
      if (overdueRes.error) throw overdueRes.error;
      const scheduled = scheduledRes.data;
      const overdue = overdueRes.data;

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
