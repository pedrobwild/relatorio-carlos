/**
 * Fase de projeto (staff-only): leitura e gravação de `project_phase_steps`.
 *
 * As regras de tela (etapa atual, atraso, veredito) ficam em
 * `@/lib/faseProjeto` — passe o `data` destes hooks para `phaseState`.
 *
 * Gravar uma etapa mexe em mais do que a etapa: o banco atualiza em
 * `projects` a etapa do Painel, as datas de aprovação, o início oficial e o
 * início do prazo contratual. Por isso as duas mutações, ao dar certo,
 * mandam reler também as listas de obras e o prazo contratual
 * (`invalidateProjectPhaseQueries`).
 *
 * Erros: o aviso é o global das mutações (queryClient), que já mostra em
 * português as recusas do banco ("A data de conclusão não pode ser no
 * futuro", "Esta obra já saiu da fase de projeto…").
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateProjectPhaseQueries, queryKeys } from "@/lib/queryKeys";
import {
  projectPhaseRepo,
  type ProjectPhaseStep,
  type ProjectPhaseStepKey,
  type SaveProjectPhaseStepInput,
} from "@/infra/repositories/projectPhase.repository";

const STALE_TIME = 60_000;

/**
 * Etapas registradas de UMA obra (lista vazia = nada registrado ainda;
 * `undefined` = ainda não carregou).
 */
export function useProjectPhaseSteps(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.projectPhase.steps(projectId ?? undefined),
    enabled: !!projectId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<ProjectPhaseStep[]> => {
      if (!projectId) return [];
      const res = await projectPhaseRepo.listSteps(projectId);
      if (res.error) throw res.error;
      return res.data;
    },
  });
}

/**
 * Etapas agrupadas por obra (id da obra → linhas). Obra sem nada registrado
 * não tem chave. Objeto simples de propósito: o cache das consultas é gravado
 * no aparelho como JSON, e um `Map` voltaria de lá vazio.
 */
export type ProjectPhasePortfolio = Record<string, ProjectPhaseStep[]>;

/**
 * Etapas de VÁRIAS obras numa leitura só (carteira / Painel). Use
 * `data?.[id] ?? []` com `phaseState`. A ordem dos ids não importa (a chave
 * do cache é a lista ordenada, sem repetidos).
 */
export function useProjectPhasePortfolio(projectIds: readonly string[] | null | undefined) {
  const ids = [...new Set(projectIds ?? [])].filter(Boolean).sort();
  return useQuery({
    queryKey: queryKeys.projectPhase.portfolio(ids),
    enabled: ids.length > 0,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<ProjectPhasePortfolio> => {
      const res = await projectPhaseRepo.listStepsForProjects(ids);
      if (res.error) throw res.error;
      const byProject: ProjectPhasePortfolio = {};
      for (const row of res.data) {
        (byProject[row.project_id] ??= []).push(row);
      }
      return byProject;
    },
  });
}

/**
 * Grava uma etapa (prazo, conclusão, responsável, observação) — só os campos
 * enviados; os demais ficam como estão. `done_at: null` reabre a etapa.
 */
export function useSaveProjectPhaseStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveProjectPhaseStepInput) => {
      const res = await projectPhaseRepo.saveStep(input);
      if (res.error) throw res.error;
      return res.data as ProjectPhaseStep;
    },
    onSuccess: (saved, input) => {
      // Mostra na hora o que o banco gravou; a releitura abaixo confirma.
      if (saved) {
        qc.setQueryData<ProjectPhaseStep[]>(queryKeys.projectPhase.steps(input.project_id), (prev) => {
          if (!prev) return prev;
          return prev.some((s) => s.step === saved.step)
            ? prev.map((s) => (s.step === saved.step ? saved : s))
            : [...prev, saved];
        });
      }
      invalidateProjectPhaseQueries(input.project_id, qc);
    },
  });
}

export interface MoveProjectToPhaseStepVars {
  projectId: string;
  /** Etapa em que a obra ESTÁ: as anteriores são concluídas, esta e as seguintes reabertas. */
  step: ProjectPhaseStepKey;
}

/** "Esta obra está na etapa X" (RPC `move_project_to_phase_step`). */
export function useMoveProjectToPhaseStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, step }: MoveProjectToPhaseStepVars) => {
      const res = await projectPhaseRepo.moveToStep(projectId, step);
      if (res.error) throw res.error;
      return { projectId, step };
    },
    onSuccess: (_data, { projectId }) => {
      invalidateProjectPhaseQueries(projectId, qc);
    },
  });
}
