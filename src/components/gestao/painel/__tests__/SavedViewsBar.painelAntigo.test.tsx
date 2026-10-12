/**
 * Visões salvas do painel antigo: escolher uma visão não pode tirar a pessoa
 * do painel antigo (`?painel=antigo`), e esse parâmetro não faz parte da visão.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const h = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@/hooks/usePainelSavedViews", () => ({
  usePainelSavedViews: () => ({
    views: [{ id: "v1", name: "Kanban de projetos", query: "fase=projetos&view=kanban", createdAt: "2026-01-01" }],
    save: h.save,
    rename: vi.fn(),
    remove: vi.fn(),
  }),
}));

import { SavedViewsBar } from "../SavedViewsBar";

function Onde() {
  const l = useLocation();
  return <output data-testid="onde">{l.pathname + l.search}</output>;
}

const renderBar = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/gestao/painel-obras${search}`]}>
      <SavedViewsBar />
      <Onde />
    </MemoryRouter>,
  );

describe("SavedViewsBar no painel antigo", () => {
  beforeEach(() => h.save.mockReset());

  it("abrir uma visão mantém ?painel=antigo", () => {
    renderBar("?painel=antigo");
    fireEvent.click(screen.getByRole("button", { name: "Kanban de projetos" }));
    expect(screen.getByTestId("onde").textContent).toBe("/gestao/painel-obras?fase=projetos&view=kanban&painel=antigo");
  });

  it("a visão aparece ativa com ou sem o parâmetro do painel antigo", () => {
    renderBar("?painel=antigo&fase=projetos&view=kanban");
    expect(screen.getByRole("button", { name: "Kanban de projetos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sem ?painel=antigo (flag desligada) nada muda no endereço da visão", () => {
    renderBar("");
    fireEvent.click(screen.getByRole("button", { name: "Kanban de projetos" }));
    expect(screen.getByTestId("onde").textContent).toBe("/gestao/painel-obras?fase=projetos&view=kanban");
  });
});
