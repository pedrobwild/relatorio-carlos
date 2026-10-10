import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

/**
 * "Iniciar obra" (antigo "Concluir Mobilização", que clonava a obra):
 *   1. sem cronograma não deixa confirmar e aponta para o Cronograma;
 *   2. com cronograma, sugere o início da 1ª atividade e chama a RPC na
 *      mesma obra;
 *   3. se a RPC falhar (hook devolve null), o modal continua aberto.
 */

vi.mock("@/hooks/useProjectActivities", () => ({
  useProjectActivities: vi.fn(),
}));
vi.mock("@/hooks/useStartProjectExecution", () => ({
  useStartProjectExecution: vi.fn(),
}));
const completeStageMutate = vi.fn();
vi.mock("@/hooks/useProjectJourney", () => ({
  useCompleteStage: () => ({ mutateAsync: completeStageMutate }),
}));

import { MobilizacaoCompletionModal } from "@/components/journey/MobilizacaoCompletionModal";
import { useProjectActivities } from "@/hooks/useProjectActivities";
import { useStartProjectExecution } from "@/hooks/useStartProjectExecution";

const mockedActivities = vi.mocked(useProjectActivities);
const start = vi.fn();
const onOpenChange = vi.fn();
const onSuccess = vi.fn();

const activitiesState = (
  activities: Array<{ planned_start: string; planned_end: string }>,
  loading = false,
) =>
  ({
    activities,
    loading,
  }) as unknown as ReturnType<typeof useProjectActivities>;

function renderModal() {
  return render(
    <MemoryRouter>
      <MobilizacaoCompletionModal
        open
        onOpenChange={onOpenChange}
        stageId="stage-mob"
        projectId="p1"
        onSuccess={onSuccess}
      />
    </MemoryRouter>,
  );
}

const confirmButton = () =>
  screen.getByRole("button", { name: /^Iniciar obra$/ });

describe("MobilizacaoCompletionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    start.mockResolvedValue({ project_id: "p1", already_in_execution: false });
    vi.mocked(useStartProjectExecution).mockReturnValue({
      start,
      isPending: false,
    });
  });

  it("sem cronograma: desabilita a confirmação e leva ao Cronograma", () => {
    mockedActivities.mockReturnValue(activitiesState([]));
    renderModal();

    expect(
      screen.getByText("Cadastre o cronograma antes de iniciar a obra"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir cronograma/ })).toHaveAttribute(
      "href",
      "/obra/p1/cronograma",
    );
    expect(confirmButton()).toBeDisabled();
    // Não fala mais em criar obra nova.
    expect(screen.queryByText(/O que será mantido/)).not.toBeInTheDocument();
  });

  it("cronograma só com o modelo (tudo na mesma data) também bloqueia", () => {
    mockedActivities.mockReturnValue(
      activitiesState([
        { planned_start: "2026-10-01", planned_end: "2026-10-01" },
        { planned_start: "2026-10-01", planned_end: "2026-10-01" },
      ]),
    );
    renderModal();
    expect(confirmButton()).toBeDisabled();
  });

  it("enquanto carrega o cronograma, não deixa confirmar", () => {
    mockedActivities.mockReturnValue(activitiesState([], true));
    renderModal();
    expect(confirmButton()).toBeDisabled();
    expect(
      screen.queryByText("Cadastre o cronograma antes de iniciar a obra"),
    ).not.toBeInTheDocument();
  });

  it("com cronograma: sugere o início da 1ª atividade e inicia a obra", async () => {
    mockedActivities.mockReturnValue(
      activitiesState([
        { planned_start: "2026-10-27", planned_end: "2026-11-07" },
        { planned_start: "2026-10-20", planned_end: "2026-10-24" },
      ]),
    );
    renderModal();

    expect(screen.getByLabelText(/Data de início da obra/)).toHaveValue(
      "2026-10-20",
    );
    expect(confirmButton()).toBeEnabled();

    await userEvent.click(confirmButton());

    expect(start).toHaveBeenCalledWith("p1", "2026-10-20");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("se a RPC recusar, mantém o modal aberto", async () => {
    start.mockResolvedValue(null);
    mockedActivities.mockReturnValue(
      activitiesState([{ planned_start: "2026-10-20", planned_end: "2026-10-24" }]),
    );
    renderModal();

    await userEvent.click(confirmButton());

    expect(start).toHaveBeenCalledWith("p1", "2026-10-20");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });
  it("obra já em execução: conclui a Mobilização pela etapa", async () => {
    mockedActivities.mockReturnValue(
      activitiesState([{ planned_start: "2026-10-20", planned_end: "2026-10-24" }]),
    );
    start.mockResolvedValue({ project_id: "p1", already_in_execution: true });
    completeStageMutate.mockResolvedValue({ projectId: "p1" });
    const user = userEvent.setup();
    renderModal();

    await user.click(confirmButton());

    expect(completeStageMutate).toHaveBeenCalledWith({
      stageId: "stage-mob",
      projectId: "p1",
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("obra iniciada pela RPC: não conclui a etapa de novo", async () => {
    mockedActivities.mockReturnValue(
      activitiesState([{ planned_start: "2026-10-20", planned_end: "2026-10-24" }]),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(confirmButton());

    expect(start).toHaveBeenCalled();
    expect(completeStageMutate).not.toHaveBeenCalled();
  });
});
