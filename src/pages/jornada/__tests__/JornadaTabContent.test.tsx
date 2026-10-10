import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import type {
  JourneyStage,
  JourneyStageStatus,
} from "@/hooks/useProjectJourney";

/**
 * Seleção automática da etapa atual na Jornada.
 *
 * Antes a etapa era escolhida UMA vez (muitas vezes a partir do cache
 * persistido no localStorage) e a tela ficava parada nela quando os dados
 * frescos chegavam. Agora acompanha a etapa atual até o usuário escolher
 * uma etapa manualmente.
 */

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/ActivityTimeline", () => ({
  ActivityTimelineCompact: () => null,
}));
vi.mock("@/components/journey/JourneyTimelineSheet", () => ({
  JourneyTimelineSheet: () => null,
}));
vi.mock("@/components/journey/JourneyWelcomeStage", () => ({
  JourneyWelcomeStage: () => <div data-testid="welcome-stage" />,
}));
vi.mock("@/components/journey/StageDetailInline", () => ({
  StageDetailInline: ({ stage }: { stage: JourneyStage }) => (
    <section data-testid="stage-detail">{stage.name}</section>
  ),
}));
// Timeline simplificada: um botão por etapa (renderizada 2x: desktop + mobile).
vi.mock("@/components/journey/JourneyTimeline", () => ({
  JourneyTimeline: ({
    stages,
    onStageClick,
  }: {
    stages: JourneyStage[];
    onStageClick: (id: string) => void;
  }) => (
    <ol>
      {stages.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onStageClick(s.id)}>
            {s.name}
          </button>
        </li>
      ))}
    </ol>
  ),
}));

import { JornadaTabContent } from "@/pages/jornada/JornadaTabContent";

const stage = (id: string, status: JourneyStageStatus): JourneyStage =>
  ({ id, name: id, status, todos: [] }) as unknown as JourneyStage;

/** Cache antigo: Projeto 3D em andamento. */
const CACHED = [
  stage("Briefing", "completed"),
  stage("Projeto 3D", "in_progress"),
  stage("Medição Técnica", "pending"),
];
/** Dados frescos: a equipe já avançou para a Medição Técnica. */
const FRESH = [
  stage("Briefing", "completed"),
  stage("Projeto 3D", "completed"),
  stage("Medição Técnica", "in_progress"),
];

type Props = ComponentProps<typeof JornadaTabContent>;

function makeProps(stages: JourneyStage[], overrides: Partial<Props> = {}) {
  return {
    activeTab: "jornada",
    handleTabChange: vi.fn(),
    projectId: "p1",
    projectName: "Obra Teste",
    isAdmin: false,
    journey: { hero: { id: "h1" }, stages },
    welcomeCompleted: true,
    setWelcomeCompleted: vi.fn(),
    welcomeKey: "journey_welcome_p1",
    hasRealProgress: true,
    pulling: false,
    refreshing: false,
    pullDistance: 0,
    threshold: 80,
    ...overrides,
  } satisfies Props;
}

const detail = () => screen.getByTestId("stage-detail");

describe("JornadaTabContent — seleção automática da etapa atual", () => {
  it("abre a etapa atual", () => {
    render(<JornadaTabContent {...makeProps(CACHED)} />);
    expect(detail()).toHaveTextContent("Projeto 3D");
  });

  it("re-seleciona quando dados frescos mudam a etapa atual (cache → servidor)", () => {
    const { rerender } = render(<JornadaTabContent {...makeProps(CACHED)} />);
    expect(detail()).toHaveTextContent("Projeto 3D");

    rerender(<JornadaTabContent {...makeProps(FRESH)} />);

    expect(detail()).toHaveTextContent("Medição Técnica");
    // Rótulo do stepper (Boas-vindas + 3 etapas) acompanha: 4ª posição.
    expect(screen.getAllByText("Etapa 4 de 4").length).toBeGreaterThan(0);
  });

  it("não re-seleciona depois que o usuário escolheu uma etapa", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<JornadaTabContent {...makeProps(CACHED)} />);

    await user.click(screen.getAllByRole("button", { name: "Briefing" })[0]);
    expect(detail()).toHaveTextContent("Briefing");

    rerender(<JornadaTabContent {...makeProps(FRESH)} />);

    expect(detail()).toHaveTextContent("Briefing");
  });

  it("obra em execução com tudo concluído abre a última etapa", () => {
    render(
      <JornadaTabContent
        {...makeProps([
          stage("Briefing", "completed"),
          stage("Liberação da Obra", "completed"),
          stage("Mobilização", "completed"),
        ])}
      />,
    );

    expect(detail()).toHaveTextContent("Mobilização");
    expect(
      screen.getAllByText("Todas as etapas concluídas").length,
    ).toBeGreaterThan(0);
  });

  it("sem progresso real continua nas boas-vindas", () => {
    render(
      <JornadaTabContent
        {...makeProps(
          [stage("Briefing", "in_progress"), stage("Projeto 3D", "pending")],
          { hasRealProgress: false, welcomeCompleted: false },
        )}
      />,
    );

    expect(screen.queryByTestId("stage-detail")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("welcome-stage").length).toBeGreaterThan(0);
  });
});
