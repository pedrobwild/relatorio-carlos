/**
 * useObrasPainel — dados do Painel de Obras. Junta, para todas as obras ativas:
 * prazo contratual (v_project_deadlines), dados do painel (nome, cliente,
 * responsável, avanço, cadastro digitado), cronograma e camada de Operação.
 * Devolve as linhas em execução já calculadas e ordenadas por risco, mais as
 * listas de projetos (fase de projeto) e de obras concluídas.
 *
 * As etapas da fase de projeto (`project_phase_steps`) são um complemento:
 * não entram em `isLoading` nem em `error`. Enquanto não chegam — ou se a
 * leitura falhar — a lista de Projetos sai com o que tem e cada linha fica
 * com `phase: null` ("não se sabe"), nunca "sem etapa registrada".
 */
import { useCallback, useMemo, useRef } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { obrasPanelRepo } from "@/infra/repositories/obrasPanel.repository";
import { useObraDeadlines } from "@/hooks/useContractDeadline";
import { usePainelObras, type PainelObra } from "@/hooks/usePainelObras";
import {
  useMoveProjectToPhaseStep,
  useProjectPhasePortfolio,
  type ProjectPhasePortfolio,
} from "@/hooks/useProjectPhase";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import type { ProjectPhaseStep, ProjectPhaseStepKey } from "@/infra/repositories/projectPhase.repository";
import {
  buildConcluidaRow,
  buildProjetoRow,
  cadastroOf,
  isObraConcluida,
  moveStepsLocally,
  sortConcluidas,
  sortProjetos,
  type ConcluidaRow,
  type ProjetoRow,
} from "@/lib/painelNovo";
import { buildObraRow, groupBy, isObraEmExecucao, sortByRisk, type ObraRow } from "@/lib/obrasPainel";
import { mapError } from "@/lib/errorMapping";
import { shiftISODate, todayISO } from "@/lib/hojeDia";
import { mondayOf } from "@/lib/semanaPlan";
import { buildAndamento } from "@/lib/obraAndamento";

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

/** Etapas da fase de projeto: chegaram, ainda carregando, ou a leitura falhou. */
export type PhaseStepsStatus = "ok" | "loading" | "error";

/** Linha provisória de uma etapa ainda sem registro (só para a tela mudar na hora). */
const blankStep =
  (projectId: string) =>
  (step: ProjectPhaseStepKey): ProjectPhaseStep => ({
    id: `local-${projectId}-${step}`,
    project_id: projectId,
    step,
    done_at: null,
    due_date: null,
    responsible_user_id: null,
    notes: null,
    updated_by: null,
    created_at: "",
    updated_at: "",
  });

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

  // Semana que vem (a partir de hoje, não da semana escolhida na tela): o
  // Painel mostra o que começa nela e se alguém já marcou dia.
  const nextFrom = shiftISODate(mondayOf(todayISO()), 7);
  const nextTo = shiftISODate(nextFrom, 6);
  const nextAssignmentsQ = useQuery({
    queryKey: queryKeys.obrasPanel.assignments(ids, nextFrom, nextTo),
    enabled,
    staleTime: 60_000,
    placeholderData: keepSameRange(nextFrom, nextTo),
    queryFn: async () => unwrap(await obrasPanelRepo.listAssignments(ids, nextFrom, nextTo)),
  });

  const rows = useMemo<ObraRow[]>(() => {
    const today = todayISO();
    const nextAsg = nextAssignmentsQ.data ? groupBy(nextAssignmentsQ.data) : null;
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
        const row = buildObraRow({
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
        return {
          ...row,
          andamento: buildAndamento(stages.get(id) ?? [], today, { from: nextFrom, to: nextTo }),
          nextWeekPlanned: nextAsg ? (nextAsg.get(id)?.length ?? 0) : undefined,
        };
      }),
    );
  }, [active, painel.obras, stagesQ.data, activitiesQ.data, materialsQ.data, assignmentsQ.data, closingsQ.data, closingsQ.isSuccess, nextAssignmentsQ.data, week, prevFrom, nextFrom, nextTo]);

  /** Cadastro de cada obra (para a gaveta e para as outras listas). */
  const obraById = useMemo(() => new Map<string, PainelObra>(painel.obras.map((o) => [o.id, o])), [painel.obras]);
  const deadlineById = useMemo(
    () => new Map((deadlinesQ.data ?? []).filter((d) => d.project_id).map((d) => [d.project_id as string, d])),
    [deadlinesQ.data],
  );

  // Fase de projeto: etapas de todas as obras em projeto, numa leitura só.
  const phaseIds = useMemo(
    () => painel.obras.filter((o) => o.is_project_phase).map((o) => o.id).sort(),
    [painel.obras],
  );
  const phaseKey = phaseIds.join(",");
  const phaseQ = useProjectPhasePortfolio(phaseIds);
  const { data: staff } = useStaffUsers();
  // A lista de obras em projeto está na chave da consulta. Quando uma obra
  // entra ou sai, a chave muda e os dados somem até a nova leitura chegar:
  // nesse intervalo vale o último resultado, só para as obras que ele cobria.
  const lastPhase = useRef<{ key: string; ids: ReadonlySet<string>; data: ProjectPhasePortfolio } | null>(null);
  if (phaseQ.data && (lastPhase.current?.data !== phaseQ.data || lastPhase.current.key !== phaseKey)) {
    lastPhase.current = { key: phaseKey, ids: new Set(phaseIds), data: phaseQ.data };
  }
  const phaseStatus: PhaseStepsStatus =
    phaseIds.length === 0 || phaseQ.data ? "ok" : phaseQ.isError ? "error" : "loading";

  /** Obras em fase de projeto: etapa atrasada primeiro (ver `sortProjetos`). */
  const projetos = useMemo<ProjetoRow[]>(() => {
    const today = todayISO();
    const staffNames = new Map((staff ?? []).map((u) => [u.id, u.nome]));
    const previous = phaseQ.isError ? null : lastPhase.current;
    /** undefined = não se sabe (carregando, ou a leitura falhou). */
    const stepsOf = (id: string) => {
      if (phaseQ.data) return phaseQ.data[id] ?? [];
      return previous?.ids.has(id) ? (previous.data[id] ?? []) : undefined;
    };
    return sortProjetos(
      painel.obras
        .filter((o) => o.is_project_phase)
        .map((o) => buildProjetoRow(o, today, { steps: stepsOf(o.id), staffNames })),
    );
  }, [painel.obras, phaseQ.data, phaseQ.isError, staff]);

  // "Esta obra está na etapa X" (arrastar no Kanban). Mesmo cuidado de
  // `updateObra`: a tela muda na hora e volta ao que era se o banco recusar.
  const qc = useQueryClient();
  const { mutateAsync: movePhase } = useMoveProjectToPhaseStep();
  const moveToPhaseStep = useCallback(
    async (projectId: string, step: ProjectPhaseStepKey) => {
      const prefix = queryKeys.projectPhase.portfolios();
      await qc.cancelQueries({ queryKey: prefix });
      const snapshots = qc.getQueriesData<ProjectPhasePortfolio>({ queryKey: prefix });
      const today = todayISO();
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<ProjectPhasePortfolio>(key, {
          ...prev,
          [projectId]: moveStepsLocally(prev[projectId] ?? [], step, today, blankStep(projectId)),
        });
      }
      try {
        return await movePhase({ projectId, step });
      } catch (err) {
        for (const [key, prev] of snapshots) qc.setQueryData(key, prev);
        // Relê do banco: a leitura cancelada acima não pode ficar pela metade.
        void qc.invalidateQueries({ queryKey: prefix });
        throw err; // o aviso de erro é o global das mutações
      }
    },
    [qc, movePhase],
  );

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
    /** Etapas da fase de projeto: "ok", "loading" ou "error" (não bloqueia o Painel). */
    phaseStatus,
    refetchPhase: () => {
      void phaseQ.refetch();
    },
    moveToPhaseStep,
    isLoading,
    error: error ? friendlyError(error) : painel.error,
    refetch: () => {
      void painel.refetch();
      void deadlinesQ.refetch();
      void stagesQ.refetch();
      void activitiesQ.refetch();
      void materialsQ.refetch();
      void assignmentsQ.refetch();
      void nextAssignmentsQ.refetch();
      void closingsQ.refetch();
      void phaseQ.refetch();
    },
  };
}
