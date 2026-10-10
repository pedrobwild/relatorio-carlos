import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

/**
 * Banner "Iniciar obra" da Jornada. Trava o que importa:
 *   1. cliente nunca vê (nem busca as atividades);
 *   2. com cronograma cadastrado, a equipe inicia a obra pela RPC;
 *   3. sem cronograma, só depois do Executivo, e manda cadastrar o cronograma;
 *   4. obra já em execução ou só com o modelo de placeholders: nada.
 */

vi.mock("@/hooks/useUserRole", () => ({ useUserRole: vi.fn() }));
vi.mock("@/hooks/useProjectActivities", () => ({
  useProjectActivities: vi.fn(),
}));
vi.mock("@/hooks/useStartProjectExecution", () => ({
  useStartProjectExecution: vi.fn(),
}));

import { ProjectPhaseCompletionBanner } from "@/components/journey/ProjectPhaseCompletionBanner";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useProjectActivities } from "@/hooks/useProjectActivities";
import { useStartProjectExecution } from "@/hooks/useStartProjectExecution";
import type { JourneyStage } from "@/hooks/useProjectJourney";

const mockedRole = vi.mocked(useUserRole);
const mockedActivities = vi.mocked(useProjectActivities);
const start = vi.fn();

const roleState = (roles: AppRole[]) =>
  ({
    roles,
    loading: false,
    isStaff: !roles.includes("customer"),
  }) as unknown as ReturnType<typeof useUserRole>;

const activitiesState = (
  activities: Array<{ planned_start: string; planned_end: string }>,
) =>
  ({
    activities,
    loading: false,
  }) as unknown as ReturnType<typeof useProjectActivities>;

const stage = (name: string, status: JourneyStage["status"]) =>
  ({ id: name, name, status }) as JourneyStage;

const stagesExecutivoPendente = [
  stage("Projeto Executivo", "in_progress"),
  stage("Liberação da Obra", "pending"),
];
const stagesExecutivoConcluido = [
  stage("Projeto Executivo", "completed"),
  stage("Liberação da Obra", "in_progress"),
];

const realSchedule = [
  { planned_start: "2026-10-20", planned_end: "2026-10-24" },
  { planned_start: "2026-10-27", planned_end: "2026-11-07" },
];

function renderBanner(
  props: Partial<{
    isProjectPhase: boolean;
    stages: JourneyStage[];
  }> = {},
) {
  return render(
    <MemoryRouter>
      <ProjectPhaseCompletionBanner
        projectId="p1"
        isProjectPhase={props.isProjectPhase ?? true}
        stages={props.stages ?? stagesExecutivoPendente}
      />
    </MemoryRouter>,
  );
}

describe("ProjectPhaseCompletionBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockedRole.mockReturnValue(roleState(["engineer"]));
    mockedActivities.mockReturnValue(activitiesState(realSchedule));
    start.mockResolvedValue({ project_id: "p1", already_in_execution: false });
    vi.mocked(useStartProjectExecution).mockReturnValue({
      start,
      isPending: false,
    });
  });

  it("não renderiza nada para o cliente e nem busca o cronograma", () => {
    mockedRole.mockReturnValue(roleState(["customer"]));
    const { container } = renderBanner({ stages: stagesExecutivoConcluido });

    expect(container).toBeEmptyDOMElement();
    expect(mockedActivities).toHaveBeenCalledWith(undefined);
  });

  it("não renderiza nada enquanto o papel carrega", () => {
    mockedRole.mockReturnValue({
      roles: [],
      loading: true,
      isStaff: false,
    } as unknown as ReturnType<typeof useUserRole>);
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("com cronograma cadastrado, inicia a obra pela RPC (data padrão da RPC)", async () => {
    renderBanner();

    expect(mockedActivities).toHaveBeenCalledWith("p1");
    expect(
      screen.getByText(
        "O cronograma já está cadastrado, mas o cliente ainda não vê: a obra está em fase de projeto.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Iniciar obra e liberar cronograma/ }),
    );
    expect(start).toHaveBeenCalledWith("p1", null);
  });

  it("sem cronograma e Executivo concluído, manda cadastrar o cronograma", () => {
    mockedActivities.mockReturnValue(activitiesState([]));
    renderBanner({ stages: stagesExecutivoConcluido });

    expect(
      screen.getByText(
        "Quando a obra começar, cadastre o cronograma e inicie a obra para o cliente acompanhar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Cadastrar cronograma/ }),
    ).toHaveAttribute("href", "/obra/p1/cronograma");
    expect(
      screen.queryByRole("button", { name: /Iniciar obra/ }),
    ).not.toBeInTheDocument();
  });

  it("sem cronograma e Executivo pendente, não aparece", () => {
    mockedActivities.mockReturnValue(activitiesState([]));
    const { container } = renderBanner({ stages: stagesExecutivoPendente });
    expect(container).toBeEmptyDOMElement();
  });

  it("cronograma só com o modelo (tudo na mesma data) não conta como cadastrado", () => {
    mockedActivities.mockReturnValue(
      activitiesState([
        { planned_start: "2026-10-01", planned_end: "2026-10-01" },
        { planned_start: "2026-10-01", planned_end: "2026-10-01" },
      ]),
    );
    const { container } = renderBanner({ stages: stagesExecutivoPendente });
    expect(container).toBeEmptyDOMElement();
  });

  it("obra já em execução: não aparece", () => {
    const { container } = renderBanner({ isProjectPhase: false });
    expect(container).toBeEmptyDOMElement();
    expect(mockedActivities).toHaveBeenCalledWith(undefined);
  });

  it("'Lembrar depois' esconde o banner", async () => {
    const { container } = renderBanner();
    await userEvent.click(screen.getByRole("button", { name: /Lembrar depois/ }));
    expect(container).toBeEmptyDOMElement();
    expect(start).not.toHaveBeenCalled();
  });
});
