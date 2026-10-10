/**
 * Cronograma · obra em fase de projeto
 *
 * Na fase de projeto o cliente não vê o cronograma (Index.tsx o manda para a
 * Jornada). Garante que:
 *  1. quem edita o cronograma vê o aviso fixo com "Iniciar obra e liberar
 *     cronograma" (e só quem edita, e só na fase de projeto);
 *  2. o botão fica desabilitado, com motivo, sem cronograma gravado;
 *  3. salvar na fase de projeto NÃO navega para o relatório (que cai na
 *     Jornada) — abre a pergunta "Iniciar a obra agora?";
 *  4. em execução, salvar mantém a navegação para o relatório.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

// ── Estado controlado pelos testes (referências estáveis entre renders) ──
const state = vi.hoisted(() => ({
  project: {
    id: "p1",
    name: "Exalt 808",
    is_project_phase: true,
    planned_start_date: "2026-10-12",
    planned_end_date: "2026-12-18",
  } as Record<string, unknown>,
  activities: [] as unknown[],
  canEdit: true,
}));

const startMock = vi.hoisted(() => vi.fn());
const saveActivitiesMock = vi.hoisted(() => vi.fn());
const noop = vi.hoisted(() => () => undefined);

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@/contexts/ProjectContext", () => ({
  useProject: () => ({ project: state.project, loading: false }),
}));

vi.mock("@/hooks/useProjectActivities", () => ({
  useProjectActivities: () => ({
    activities: state.activities,
    loading: false,
    saveActivities: saveActivitiesMock,
    saveBaseline: noop,
    clearBaseline: noop,
    hasBaseline: false,
  }),
}));

vi.mock("@/hooks/useCan", () => ({
  useCan: () => ({
    can: (feature: string) =>
      feature.startsWith("schedule:") && feature !== "schedule:view"
        ? state.canEdit
        : true,
    loading: false,
  }),
}));

vi.mock("@/hooks/useStartProjectExecution", () => ({
  useStartProjectExecution: () => ({ start: startMock, isPending: false }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

vi.mock("@/hooks/useScheduleAlerts", () => ({
  useScheduleAlerts: () => ({ summary: { total: 0 } }),
}));

vi.mock("@/hooks/useScheduleAlertPrefs", () => ({
  useScheduleAlertPrefs: () => ({ prefs: { showBadge: false } }),
}));

// Peças pesadas/irrelevantes para este fluxo.
vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, children }: { title: string; children?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
}));
vi.mock("@/components/schedule/AIScheduleGenerator", () => ({
  AIScheduleGenerator: () => null,
}));
vi.mock("@/components/agent", () => ({ AssessorSheet: () => null }));
vi.mock("@/components/cronograma/CronogramaPdfButton", () => ({
  CronogramaPdfButton: () => null,
}));
vi.mock("@/components/cronograma/CronogramaMobileView", () => ({
  CronogramaMobileView: () => null,
}));
vi.mock("@/components/ImportScheduleModal", () => ({
  ImportScheduleModal: () => null,
}));
vi.mock("@/components/DatePickerField", () => ({
  DatePickerField: ({ value }: { value: string }) => (
    <input readOnly value={value} />
  ),
}));

import Cronograma from "@/pages/Cronograma";

const NOTICE =
  /Este cronograma ainda não aparece para o cliente: a obra está em fase de projeto\./;
const START_LABEL = "Iniciar obra e liberar cronograma";

const savedActivities = [
  {
    id: "a1",
    project_id: "p1",
    description: "Demolição",
    planned_start: "2026-10-12",
    planned_end: "2026-10-16",
    actual_start: null,
    actual_end: null,
    weight: 50,
    sort_order: 0,
    predecessor_ids: [],
    etapa: null,
    detailed_description: null,
  },
  {
    id: "a2",
    project_id: "p1",
    description: "Elétrica",
    planned_start: "2026-10-19",
    planned_end: "2026-10-23",
    actual_start: null,
    actual_end: null,
    weight: 50,
    sort_order: 1,
    predecessor_ids: [],
    etapa: null,
    detailed_description: null,
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/obra/p1/cronograma"]}>
      <Routes>
        <Route path="/obra/:projectId/cronograma" element={<Cronograma />} />
        <Route
          path="/obra/:projectId/relatorio"
          element={<div>Página do relatório</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Cronograma · obra em fase de projeto", () => {
  beforeEach(() => {
    state.project = { ...state.project, is_project_phase: true };
    state.activities = savedActivities;
    state.canEdit = true;
    startMock.mockReset();
    startMock.mockResolvedValue({
      project_id: "p1",
      already_in_execution: false,
      activities: 2,
      completed_stages: 3,
      start_date: "2026-10-12",
    });
    saveActivitiesMock.mockReset();
    saveActivitiesMock.mockResolvedValue({ ok: true });
  });

  it("mostra o aviso e inicia a obra sem data (start(projectId, null))", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    const startBtn = screen.getByRole("button", { name: START_LABEL });
    await waitFor(() => expect(startBtn).toBeEnabled());

    await user.click(startBtn);
    expect(startMock).toHaveBeenCalledWith("p1", null);
  });

  it("não mostra o aviso quando a obra já está em execução", async () => {
    state.project = { ...state.project, is_project_phase: false };
    renderPage();

    await screen.findAllByDisplayValue("Demolição");
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("não mostra o aviso para quem não edita o cronograma", async () => {
    state.canEdit = false;
    renderPage();

    await screen.findAllByDisplayValue("Demolição");
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("desabilita o botão, com o motivo, quando não há cronograma gravado", async () => {
    state.activities = [];
    renderPage();

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: START_LABEL })).toBeDisabled();
    expect(
      screen.getByText(/Salve o cronograma com ao menos uma atividade/),
    ).toBeInTheDocument();
  });

  it("com o cronograma em cache, abrir a tela não dispara autosave nem acusa alteração", async () => {
    renderPage();
    await screen.findByText(NOTICE);
    expect(screen.getByRole("button", { name: START_LABEL })).toBeEnabled();

    // Passa do debounce do autosave (1,2s): nada para gravar.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(saveActivitiesMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: START_LABEL })).toBeEnabled();
  });

  it("desabilita o botão enquanto houver alterações não salvas", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(NOTICE);
    const startBtn = screen.getByRole("button", { name: START_LABEL });
    await waitFor(() => expect(startBtn).toBeEnabled());

    const [descricao] = screen.getAllByDisplayValue("Demolição");
    await user.type(descricao, " e retirada");

    expect(startBtn).toBeDisabled();
    expect(
      screen.getByText(/Há alterações não salvas: salve o cronograma/),
    ).toBeInTheDocument();
  });

  it("ao salvar na fase de projeto, fica na tela e pergunta se inicia a obra", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(NOTICE);

    await user.click(screen.getByRole("button", { name: /Salvar/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        /O cliente ainda não vê porque a obra está em fase de projeto\./,
      ),
    ).toBeInTheDocument();
    expect(saveActivitiesMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Página do relatório")).toBeNull();

    // "Agora não" só fecha — não inicia a obra.
    await user.click(within(dialog).getByRole("button", { name: "Agora não" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(startMock).not.toHaveBeenCalled();
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it("no diálogo pós-salvar, 'Iniciar obra' chama a RPC e fecha", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(NOTICE);

    await user.click(screen.getByRole("button", { name: /Salvar/ }));
    const dialog = await screen.findByRole("alertdialog");

    await user.click(within(dialog).getByRole("button", { name: START_LABEL }));
    expect(startMock).toHaveBeenCalledWith("p1", null);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("em execução, salvar continua levando ao relatório", async () => {
    state.project = { ...state.project, is_project_phase: false };
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByDisplayValue("Demolição");

    await user.click(screen.getByRole("button", { name: /Salvar/ }));

    expect(await screen.findByText("Página do relatório")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
