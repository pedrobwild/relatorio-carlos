/**
 * useObrasPainel — dados do Painel de Obras. Junta, para todas as obras ativas:
 * prazo contratual (v_project_deadlines), dados do painel (nome, cliente,
 * responsável, avanço, cadastro digitado), cronograma e camada de Operação.
 * Devolve as linhas em execução já calculadas e ordenadas por risco, mais as
 * listas de projetos (fase de projeto) e de obras concluídas.
 */
import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { obrasPanelRepo } from "@/infra/repositories/obrasPanel.repository";
import { useObraDeadlines } from "@/hooks/useContractDeadline";
import { usePainelObras, type PainelObra } from "@/hooks/usePainelObras";
import {
  buildConcluidaRow,
  buildProjetoRow,
  cadastroOf,
  isObraConcluida,
  sortConcluidas,
  sortProjetos,
  type ConcluidaRow,
  type ProjetoRow,
} from "@/lib/painelNovo";
import { buildObraRow, groupBy, isObraEmExecucao, sortByRisk, type ObraRow } from "@/lib/obrasPainel";
import { mapError } from "@/lib/errorMapping";
import { shiftISODate, todayISO } from "@/lib/hojeDia";

const unwrap = <T,>(res: { data: T[] | null; error: unknown }): T[] => {
  if (res.error) throw res.error;
  return res.data ?? [];
};

/**
 * Mantém os dados anteriores só quando o intervalo de datas é o mesmo (a
 * lista de obras mudou). Ao trocar de semana não serve: os dias da semana
 * antiga apareceriam como se fossem da nova.
 */
const keepSameRange =
  (from: string, to: string) =>
  <T,>(previous: T | undefined, previousQuery: { queryKey: readonly unknown[] } | undefined): T | undefined =>
    previousQuery?.queryKey.at(-2) === from && previousQuery.queryKey.at(-1) === to ? previous : undefined;

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
  // As quatro consultas abaixo têm a lista de obras na chave. Quando uma obra
  // entra ou sai (ex.: entrega real registrada na gaveta), a chave muda;
  // `keepPreviousData` mantém a tela com os dados anteriores até os novos
  // chegarem, em vez de voltar ao esqueleto e fechar a gaveta.

  const stagesQ = useQuery({
    queryKey: queryKeys.obrasPanel.stages(ids),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => unwrap(await obrasPanelRepo.listStages(ids)),
  });
  const activitiesQ = useQuery({
    queryKey: queryKeys.obrasPanel.activities(ids),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => unwrap(await obrasPanelRepo.listActivities(ids)),
  });
  const materialsQ = useQuery({
    queryKey: queryKeys.obrasPanel.materials(ids),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => unwrap(await obrasPanelRepo.listOpenMaterials(ids)),
  });
  // A semana anterior vem junto: o Painel mostra o PPC dela e quem não fechou.
  const prevFrom = shiftISODate(week.from, -7);
  const assignmentsQ = useQuery({
    queryKey: queryKeys.obrasPanel.assignments(ids, prevFrom, week.to),
    enabled,
    staleTime: 60_000,
    placeholderData: keepSameRange(prevFrom, week.to),
    queryFn: async () => unwrap(await obrasPanelRepo.listAssignments(ids, prevFrom, week.to)),
  });
  // Complemento da tela: não entra em `isLoading` nem em `error`. Se a consulta
  // falhar (ex.: tabela ainda não criada no banco), o Painel segue sem o PPC.
  const closingsQ = useQuery({
    queryKey: queryKeys.obrasPanel.closings(ids, prevFrom, week.from),
    enabled,
    staleTime: 60_000,
    placeholderData: keepSameRange(prevFrom, week.from),
    queryFn: async () => unwrap(await obrasPanelRepo.listClosings(ids, prevFrom, week.from)),
  });

  const rows = useMemo<ObraRow[]>(() => {
    const today = todayISO();
    const info = new Map(painel.obras.map((o) => [o.id, o]));
    const stages = groupBy(stagesQ.data ?? []);
    const acts = groupBy(activitiesQ.data ?? []);
    const mats = groupBy(materialsQ.data ?? []);
    const allAsg = assignmentsQ.data ?? [];
    const asg = groupBy(allAsg.filter((a) => a.work_date >= week.from));
    const prevAsg = groupBy(allAsg.filter((a) => a.work_date < week.from));
    const closings = groupBy(closingsQ.data ?? []);
    const closingsKnown = closingsQ.isSuccess;
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
          cadastro: { ...cadastroOf(o), paused: cadastroOf(o).paused || d.status === "paused" },
          stages: stages.get(id) ?? [],
          activities: acts.get(id) ?? [],
          materials: mats.get(id) ?? [],
          weekAssignments: asg.get(id) ?? [],
          closing: closings.get(id)?.find((c) => c.week_start === week.from) ?? null,
          previousClosing: closings.get(id)?.find((c) => c.week_start === prevFrom) ?? null,
          previousPlanned: prevAsg.get(id)?.length ?? 0,
          closingsKnown,
          week,
          today,
        });
      }),
    );
  }, [active, painel.obras, stagesQ.data, activitiesQ.data, materialsQ.data, assignmentsQ.data, closingsQ.data, closingsQ.isSuccess, week, prevFrom]);

  /** Cadastro de cada obra (para a gaveta e para as outras listas). */
  const obraById = useMemo(() => new Map<string, PainelObra>(painel.obras.map((o) => [o.id, o])), [painel.obras]);
  const deadlineById = useMemo(
    () => new Map((deadlinesQ.data ?? []).filter((d) => d.project_id).map((d) => [d.project_id as string, d])),
    [deadlinesQ.data],
  );

  /** Obras em fase de projeto: a mais parada primeiro. */
  const projetos = useMemo<ProjetoRow[]>(() => {
    const today = todayISO();
    return sortProjetos(painel.obras.filter((o) => o.is_project_phase).map((o) => buildProjetoRow(o, today)));
  }, [painel.obras]);

  /** Obras entregues: a mais recente primeiro. */
  const concluidas = useMemo<ConcluidaRow[]>(
    () => sortConcluidas((deadlinesQ.data ?? []).filter(isObraConcluida).map((d) => buildConcluidaRow(d, obraById.get(d.project_id as string)))),
    [deadlinesQ.data, obraById],
  );

  const isLoading =
    deadlinesQ.isLoading ||
    painel.isLoading ||
    (enabled && (stagesQ.isLoading || activitiesQ.isLoading || materialsQ.isLoading || assignmentsQ.isLoading));
  const error =
    deadlinesQ.error ?? stagesQ.error ?? activitiesQ.error ?? materialsQ.error ?? assignmentsQ.error ?? null;

  return {
    rows,
    projetos,
    concluidas,
    obraById,
    deadlineById,
    updateObra: painel.updateObra,
    isUpdating: painel.isUpdating,
    isLoading,
    error: error ? friendlyError(error) : painel.error,
    refetch: () => {
      void painel.refetch();
      void deadlinesQ.refetch();
      void stagesQ.refetch();
      void activitiesQ.refetch();
      void materialsQ.refetch();
      void assignmentsQ.refetch();
      void closingsQ.refetch();
    },
  };
}
