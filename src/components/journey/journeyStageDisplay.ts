import type {
  JourneyStage,
  JourneyStageStatus,
} from "@/hooks/useProjectJourney";

/**
 * Derivações de EXIBIÇÃO da jornada (nada aqui grava no banco).
 *
 *  - `deriveJourneyForViewer` — o que o cliente vê numa obra já em execução;
 *  - `getJourneyStagePosition` / `formatJourneyStagePosition` — rótulo
 *    "Etapa X de Y" pela posição da etapa atual;
 *  - `pickCurrentStageId` — etapa que a tela abre automaticamente.
 */

/* ─── Obra em execução: visão do cliente ─── */

export interface JourneyViewerContext {
  /** Quem está vendo é da equipe (qualquer papel além de cliente). */
  isStaff: boolean;
  /**
   * `projects.is_project_phase`. Só `false` explícito conta como obra em
   * execução — `null`/`undefined` (projeto ainda carregando) não deriva nada.
   */
  isProjectPhase: boolean | null | undefined;
}

/**
 * Obra em execução (`is_project_phase = false`) já passou por todas as etapas
 * pré-obra da jornada, mas obras antigas ficaram com etapas em `pending` /
 * `in_progress` no banco ("Etapa atual: Briefing" com a obra em andamento).
 * Para o cliente, essas etapas aparecem como concluídas. A equipe continua
 * vendo os status reais para poder corrigi-los.
 */
export function shouldShowAllStagesCompleted({
  isStaff,
  isProjectPhase,
}: JourneyViewerContext): boolean {
  return !isStaff && isProjectPhase === false;
}

/**
 * Devolve a jornada como o visualizador deve vê-la. Mantém a mesma referência
 * quando não há o que derivar (memo/efeitos a jusante não disparam à toa).
 */
export function deriveJourneyForViewer<T extends { stages: JourneyStage[] }>(
  journey: T | undefined,
  viewer: JourneyViewerContext,
): T | undefined {
  if (!journey || !shouldShowAllStagesCompleted(viewer)) return journey;
  if (journey.stages.every((s) => s.status === "completed")) return journey;

  return {
    ...journey,
    stages: journey.stages.map((s) =>
      s.status === "completed"
        ? s
        : { ...s, status: "completed" as JourneyStageStatus },
    ),
  };
}

/* ─── Posição da etapa atual ─── */

export interface JourneyStagePosition {
  /** Índice (0-based) da etapa atual = primeira não concluída; -1 se não houver. */
  currentIndex: number;
  completedCount: number;
  total: number;
  /** Há etapas e todas estão concluídas. */
  allCompleted: boolean;
}

export function getJourneyStagePosition(
  stages: Pick<JourneyStage, "status">[],
): JourneyStagePosition {
  const total = stages.length;
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const currentIndex = stages.findIndex((s) => s.status !== "completed");
  return {
    currentIndex,
    completedCount,
    total,
    allCompleted: total > 0 && currentIndex === -1,
  };
}

/**
 * "Etapa X de Y" onde X é a POSIÇÃO da etapa atual (1-based), não o número de
 * etapas concluídas — quem está na 6ª etapa lê "Etapa 6 de 7", não "5 de 7".
 */
export function formatJourneyStagePosition(
  position: JourneyStagePosition,
): string {
  if (position.allCompleted) return "Todas as etapas concluídas";
  if (position.currentIndex < 0) return `Etapa 0 de ${position.total}`;
  return `Etapa ${position.currentIndex + 1} de ${position.total}`;
}

/* ─── Etapa aberta automaticamente ─── */

/**
 * Etapa que a Jornada deve abrir: a que está em andamento/aguardando ação;
 * senão a primeira não concluída; com tudo concluído, a última etapa.
 */
export function pickCurrentStageId(
  stages: Pick<JourneyStage, "id" | "status">[],
): string | null {
  if (stages.length === 0) return null;
  const active =
    stages.find(
      (s) => s.status === "in_progress" || s.status === "waiting_action",
    ) ?? stages.find((s) => s.status !== "completed");
  return (active ?? stages[stages.length - 1]).id;
}
