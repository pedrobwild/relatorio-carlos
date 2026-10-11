/**
 * useObrasPainel — Fase 5. Junta, para todas as obras ativas:
 * prazo contratual (v_project_deadlines), dados do painel (nome, cliente,
 * responsável, avanço), cronograma e camada de Operação. Devolve as linhas
 * já calculadas e ordenadas por risco.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { obrasPanelRepo } from "@/infra/repositories/obrasPanel.repository";
import { useObraDeadlines } from "@/hooks/useContractDeadline";
import { usePainelObras } from "@/hooks/usePainelObras";
import { buildObraRow, groupBy, isObraEmExecucao, sortByRisk, type ObraRow } from "@/lib/obrasPainel";
import { mapError } from "@/lib/errorMapping";
import { todayISO } from "@/lib/hojeDia";

const unwrap = <T,>(res: { data: T[] | null; error: unknown }): T[] => {
  if (res.error) throw res.error;
  return res.data ?? [];
};

/** Mensagem em português para a tela; nunca o erro cru do Postgres. */
function friendlyError(error: unknown): string {
  const userMessage = (error as { userError?: { userMessage?: string } } | null)?.userError?.userMessage;
  return userMessage ?? mapError(error).userMessage;
}

export function useObrasPainel(week: { from: string; to: string }) {
  const deadlinesQ = useObraDeadlines();
  const painel = usePainelObras();

  const active = useMemo(
    () => (deadlinesQ.data ?? []).filter(isObraEmExecucao),
    [deadlinesQ.data],
  );
  const ids = useMemo(() => active.map((d) => d.project_id as string).sort(), [active]);
  const enabled = ids.length > 0;

  const stagesQ = useQuery({
    queryKey: queryKeys.obrasPanel.stages(ids),
    enabled,
    staleTime: 60_000,
    queryFn: async () => unwrap(await obrasPanelRepo.listStages(ids)),
  });
  const activitiesQ = useQuery({
    queryKey: queryKeys.obrasPanel.activities(ids),
    enabled,
    staleTime: 60_000,
    queryFn: async () => unwrap(await obrasPanelRepo.listActivities(ids)),
  });
  const materialsQ = useQuery({
    queryKey: queryKeys.obrasPanel.materials(ids),
    enabled,
    staleTime: 60_000,
    queryFn: async () => unwrap(await obrasPanelRepo.listOpenMaterials(ids)),
  });
  const assignmentsQ = useQuery({
    queryKey: queryKeys.obrasPanel.assignments(ids, week.from, week.to),
    enabled,
    staleTime: 60_000,
    queryFn: async () => unwrap(await obrasPanelRepo.listAssignments(ids, week.from, week.to)),
  });

  const rows = useMemo<ObraRow[]>(() => {
    const today = todayISO();
    const info = new Map(painel.obras.map((o) => [o.id, o]));
    const stages = groupBy(stagesQ.data ?? []);
    const acts = groupBy(activitiesQ.data ?? []);
    const mats = groupBy(materialsQ.data ?? []);
    const asg = groupBy(assignmentsQ.data ?? []);
    return sortByRisk(
      active.map((d) => {
        const id = d.project_id as string;
        const o = info.get(id);
        return buildObraRow({
          deadline: d,
          name: o?.nome ?? d.project_name,
          customer: o?.customer_name ?? null,
          responsibleId: o?.responsavel_id ?? null,
          responsible: o?.responsavel_nome ?? o?.engineer_name ?? null,
          progress: o?.progress_percentage ?? null,
          stages: stages.get(id) ?? [],
          activities: acts.get(id) ?? [],
          materials: mats.get(id) ?? [],
          weekAssignments: asg.get(id) ?? [],
          week,
          today,
        });
      }),
    );
  }, [active, painel.obras, stagesQ.data, activitiesQ.data, materialsQ.data, assignmentsQ.data, week]);

  const isLoading =
    deadlinesQ.isLoading ||
    painel.isLoading ||
    (enabled && (stagesQ.isLoading || activitiesQ.isLoading || materialsQ.isLoading || assignmentsQ.isLoading));
  const error =
    deadlinesQ.error ?? stagesQ.error ?? activitiesQ.error ?? materialsQ.error ?? assignmentsQ.error ?? null;

  return {
    rows,
    isLoading,
    error: error ? friendlyError(error) : painel.error,
    refetch: () => {
      void painel.refetch();
      void deadlinesQ.refetch();
      void stagesQ.refetch();
      void activitiesQ.refetch();
      void materialsQ.refetch();
      void assignmentsQ.refetch();
    },
  };
}
