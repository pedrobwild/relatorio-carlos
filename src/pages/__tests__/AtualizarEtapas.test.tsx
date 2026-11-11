/**
 * Atualizar etapas (equipe, celular): grupos, lançamento com um toque e a
 * gaveta de datas reais. As regras de data estão em datasReais.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AtualizarEtapas from "../AtualizarEtapas";
import { shiftISODate, todayISO } from "@/lib/hojeDia";

const h = vi.hoisted(() => ({
  items: [] as unknown[],
  canEdit: true,
  gravar: vi.fn(),
  desfazer: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useAtualizarEtapas", () => ({
  useAtualizarEtapas: () => ({
    items: h.items,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    gravar: h.gravar,
    isSaving: false,
    hasSaved: false,
  }),
}));
vi.mock("@/hooks/useProjectNavigation", () => ({ useProjectNavigation: () => ({ projectId: "p1", paths: {} }) }));
vi.mock("@/contexts/ProjectContext", () => ({
  useProject: () => ({ project: { id: "p1", name: "Studio 1204", unit_name: "Urban Flex" } }),
}));
vi.mock("@/hooks/useCan", () => ({ useCan: () => ({ can: () => h.canEdit }) }));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: vi.fn() } }));

const HOJE = todayISO();
const item = (p: Record<string, unknown>) => ({
  id: "x",
  project_id: "p1",
  parent_id: null,
  client_activity_id: null,
  description: "Etapa",
  planned_start: shiftISODate(HOJE, -3),
  planned_end: shiftISODate(HOJE, 3),
  actual_start: null,
  actual_end: null,
  responsible_user_id: null,
  sort_order: 0,
  ...p,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AtualizarEtapas />
    </MemoryRouter>,
  );

describe("Atualizar etapas", () => {
  beforeEach(() => {
    h.canEdit = true;
    h.gravar.mockReset().mockReturnValue(h.desfazer);
    h.desfazer.mockReset();
    h.toastSuccess.mockReset();
    h.items = [
      item({ id: "pintura", description: "Pintura", actual_start: shiftISODate(HOJE, -2), sort_order: 1 }),
      item({ id: "marcenaria", description: "Marcenaria", planned_start: HOJE, sort_order: 2 }),
      item({ id: "limpeza", description: "Limpeza", planned_start: shiftISODate(HOJE, 5), planned_end: shiftISODate(HOJE, 6), sort_order: 3 }),
      item({
        id: "demolicao",
        description: "Demolição",
        planned_start: shiftISODate(HOJE, -20),
        planned_end: shiftISODate(HOJE, -15),
        actual_start: shiftISODate(HOJE, -20),
        actual_end: shiftISODate(HOJE, -15),
        sort_order: 0,
      }),
    ];
  });

  it("mostra os três grupos com as contagens", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Atualizar etapas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Para atualizar hoje (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximas (1)" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Concluídas (1)" })).toBeInTheDocument();
  });

  it('"Começou hoje" grava o início de hoje e oferece desfazer', () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Começou hoje" }));
    expect(h.gravar).toHaveBeenCalledWith(expect.objectContaining({ id: "marcenaria" }), { actual_start: HOJE });
    const [mensagem, opts] = h.toastSuccess.mock.calls[0];
    expect(mensagem).toBe("Marcenaria: começou");
    expect(opts.action.label).toBe("Desfazer");
    opts.action.onClick();
    expect(h.desfazer).toHaveBeenCalledTimes(1);
  });

  it('"Terminou hoje" grava o término de hoje', () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Terminou hoje" }));
    expect(h.gravar).toHaveBeenCalledWith(expect.objectContaining({ id: "pintura" }), { actual_end: HOJE });
  });

  it('"Outra data" abre a gaveta; ontem no término é salvo', () => {
    renderPage();
    const cartao = screen.getByText("Pintura").closest("article") as HTMLElement;
    fireEvent.click(within(cartao).getByRole("button", { name: "Outra data" }));
    const gaveta = screen.getByRole("dialog", { name: "Datas reais" });
    expect(within(gaveta).getByRole("radio", { name: /Terminou/ })).toHaveAttribute("aria-checked", "true");
    const salvar = within(gaveta).getByRole("button", { name: /^Salvar/ });
    expect(salvar).toBeDisabled();
    fireEvent.click(within(gaveta).getByRole("button", { name: /^Ontem/ }));
    expect(salvar).toBeEnabled();
    fireEvent.click(salvar);
    expect(h.gravar).toHaveBeenCalledWith(expect.objectContaining({ id: "pintura" }), {
      actual_end: shiftISODate(HOJE, -1),
    });
  });

  it("gaveta: término antes do início não pode ser salvo e explica o motivo", () => {
    h.items = [item({ id: "pintura", description: "Pintura", actual_start: HOJE })];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Outra data" }));
    const gaveta = screen.getByRole("dialog", { name: "Datas reais" });
    fireEvent.click(within(gaveta).getByRole("button", { name: /^Ontem/ }));
    expect(within(gaveta).getByRole("alert")).toHaveTextContent("O término não pode ser antes do início.");
    expect(within(gaveta).getByRole("button", { name: /^Salvar/ })).toBeDisabled();
    expect(h.gravar).not.toHaveBeenCalled();
  });

  it("sem permissão de edição: só leitura, sem botões de lançar", () => {
    h.canEdit = false;
    renderPage();
    expect(screen.queryByRole("button", { name: "Começou hoje" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Outra data" })).toBeNull();
    expect(screen.getByText(/não tem permissão para alterar/)).toBeInTheDocument();
  });
});
