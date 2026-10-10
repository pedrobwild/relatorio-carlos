import { describe, it, expect } from "vitest";
import type {
  JourneyStage,
  JourneyStageStatus,
} from "@/hooks/useProjectJourney";
import {
  deriveJourneyForViewer,
  formatJourneyStagePosition,
  getJourneyStagePosition,
  pickCurrentStageId,
  shouldShowAllStagesCompleted,
} from "@/components/journey/journeyStageDisplay";

/**
 * Derivações de exibição da Jornada:
 *   1. cliente de obra em execução vê todas as etapas concluídas; equipe vê
 *      os status reais (caso real: "Etapa atual: Briefing" com obra rodando);
 *   2. "Etapa X de Y" é a posição da etapa atual, não a contagem de concluídas;
 *   3. etapa aberta automaticamente.
 */

const stage = (id: string, status: JourneyStageStatus) =>
  ({ id, name: id, status }) as JourneyStage;

const STALE_STAGES = [
  stage("Briefing", "in_progress"),
  stage("Projeto 3D", "pending"),
  stage("Medição Técnica", "pending"),
  stage("Projeto Executivo", "pending"),
  stage("Liberação da Obra", "pending"),
  stage("Mobilização", "pending"),
];

const journeyOf = (stages: JourneyStage[]) => ({
  hero: { id: "h1" },
  stages,
});

describe("deriveJourneyForViewer", () => {
  it("cliente em obra em execução vê todas as etapas concluídas", () => {
    const journey = journeyOf(STALE_STAGES);
    const shown = deriveJourneyForViewer(journey, {
      isStaff: false,
      isProjectPhase: false,
    });

    expect(shown?.stages.map((s) => s.status)).toEqual(
      Array(6).fill("completed"),
    );
    // Demais campos preservados (hero, nomes, ordem).
    expect(shown?.hero).toBe(journey.hero);
    expect(shown?.stages.map((s) => s.name)).toEqual(
      STALE_STAGES.map((s) => s.name),
    );
  });

  it("só exibição: não altera os objetos de origem (nada a gravar no banco)", () => {
    const journey = journeyOf(STALE_STAGES.map((s) => ({ ...s })));
    deriveJourneyForViewer(journey, { isStaff: false, isProjectPhase: false });

    expect(journey.stages[0].status).toBe("in_progress");
    expect(journey.stages[5].status).toBe("pending");
  });

  it("equipe vê os status reais mesmo com a obra em execução", () => {
    const journey = journeyOf(STALE_STAGES);
    const shown = deriveJourneyForViewer(journey, {
      isStaff: true,
      isProjectPhase: false,
    });

    expect(shown).toBe(journey);
    expect(shown?.stages[0].status).toBe("in_progress");
  });

  it("cliente em fase de projeto vê os status reais", () => {
    const journey = journeyOf(STALE_STAGES);
    expect(
      deriveJourneyForViewer(journey, { isStaff: false, isProjectPhase: true }),
    ).toBe(journey);
  });

  it("projeto ainda sem is_project_phase conhecido não deriva nada", () => {
    const journey = journeyOf(STALE_STAGES);
    expect(
      deriveJourneyForViewer(journey, {
        isStaff: false,
        isProjectPhase: undefined,
      }),
    ).toBe(journey);
    expect(
      deriveJourneyForViewer(journey, { isStaff: false, isProjectPhase: null }),
    ).toBe(journey);
  });

  it("mantém a referência quando tudo já está concluído ou sem jornada", () => {
    const done = journeyOf([stage("A", "completed"), stage("B", "completed")]);
    const viewer = { isStaff: false, isProjectPhase: false };
    expect(deriveJourneyForViewer(done, viewer)).toBe(done);
    expect(deriveJourneyForViewer(undefined, viewer)).toBeUndefined();
  });

  it("shouldShowAllStagesCompleted só para cliente com obra em execução", () => {
    expect(
      shouldShowAllStagesCompleted({ isStaff: false, isProjectPhase: false }),
    ).toBe(true);
    expect(
      shouldShowAllStagesCompleted({ isStaff: true, isProjectPhase: false }),
    ).toBe(false);
    expect(
      shouldShowAllStagesCompleted({ isStaff: false, isProjectPhase: true }),
    ).toBe(false);
  });
});

describe("getJourneyStagePosition / formatJourneyStagePosition", () => {
  const label = (stages: JourneyStage[]) =>
    formatJourneyStagePosition(getJourneyStagePosition(stages));

  it("cliente na 6ª etapa (Boas-vindas + 6) lê 'Etapa 6 de 7', não '5 de 7'", () => {
    const stages = [
      stage("welcome", "completed"),
      stage("Briefing", "completed"),
      stage("Projeto 3D", "completed"),
      stage("Medição Técnica", "completed"),
      stage("Projeto Executivo", "completed"),
      stage("Liberação da Obra", "in_progress"),
      stage("Mobilização", "pending"),
    ];
    expect(label(stages)).toBe("Etapa 6 de 7");
  });

  it("etapa atual ainda 'pending' conta pela posição", () => {
    expect(
      label([
        stage("A", "completed"),
        stage("B", "pending"),
        stage("C", "pending"),
      ]),
    ).toBe("Etapa 2 de 3");
  });

  it("Boas-vindas em andamento é a etapa 1", () => {
    expect(
      label([stage("welcome", "in_progress"), stage("Briefing", "pending")]),
    ).toBe("Etapa 1 de 2");
  });

  it("tudo concluído vira 'Todas as etapas concluídas'", () => {
    const position = getJourneyStagePosition([
      stage("A", "completed"),
      stage("B", "completed"),
    ]);
    expect(position).toEqual({
      currentIndex: -1,
      completedCount: 2,
      total: 2,
      allCompleted: true,
    });
    expect(formatJourneyStagePosition(position)).toBe(
      "Todas as etapas concluídas",
    );
  });

  it("lista vazia não é 'todas concluídas'", () => {
    expect(getJourneyStagePosition([]).allCompleted).toBe(false);
  });
});

describe("pickCurrentStageId", () => {
  it("prefere a etapa em andamento / aguardando ação", () => {
    expect(
      pickCurrentStageId([
        stage("A", "completed"),
        stage("B", "pending"),
        stage("C", "waiting_action"),
      ]),
    ).toBe("C");
  });

  it("sem etapa ativa, abre a primeira não concluída", () => {
    expect(
      pickCurrentStageId([stage("A", "completed"), stage("B", "pending")]),
    ).toBe("B");
  });

  it("com tudo concluído, abre a última etapa", () => {
    expect(
      pickCurrentStageId([stage("A", "completed"), stage("B", "completed")]),
    ).toBe("B");
  });

  it("sem etapas, null", () => {
    expect(pickCurrentStageId([])).toBeNull();
  });
});
