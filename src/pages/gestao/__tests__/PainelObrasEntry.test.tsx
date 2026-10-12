/**
 * /gestao/painel-obras: Painel reformulado por padrão; o antigo com
 * `?painel=antigo` ou quando a flag `painelReformulado` é desligada (rollback).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({ on: true, loading: false }));

vi.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({
    isEnabled: (key: string) => (key === "painelReformulado" ? h.on : false),
    isLoading: h.loading,
  }),
}));
vi.mock("@/pages/gestao/Obras", () => ({ default: () => <div>PAINEL NOVO</div> }));
vi.mock("@/pages/PainelObras", () => ({ default: () => <div>PAINEL ANTIGO</div> }));

import PainelObrasEntry from "../PainelObrasEntry";

const renderEntry = (search = "") =>
  render(
    <MemoryRouter initialEntries={[`/gestao/painel-obras${search}`]}>
      <Suspense fallback={null}>
        <PainelObrasEntry />
      </Suspense>
    </MemoryRouter>,
  );

describe("PainelObrasEntry", () => {
  beforeEach(() => {
    h.on = true;
    h.loading = false;
  });

  it("abre o Painel reformulado por padrão", async () => {
    renderEntry();
    expect(await screen.findByText("PAINEL NOVO")).toBeInTheDocument();
    expect(screen.queryByText("PAINEL ANTIGO")).toBeNull();
  });

  it("os filtros do endereço antigo continuam abrindo o Painel reformulado", async () => {
    renderEntry("?fase=projetos");
    expect(await screen.findByText("PAINEL NOVO")).toBeInTheDocument();
  });

  it("?painel=antigo abre o antigo, com o caminho de volta", async () => {
    renderEntry("?painel=antigo&view=kanban");
    expect(await screen.findByText("PAINEL ANTIGO")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar ao painel novo/ })).toHaveAttribute("href", "/gestao/painel-obras");
    expect(screen.queryByText("PAINEL NOVO")).toBeNull();
  });

  it("flag desligada: todo mundo no antigo, sem a faixa de volta", async () => {
    h.on = false;
    renderEntry();
    expect(await screen.findByText("PAINEL ANTIGO")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Voltar ao painel novo/ })).toBeNull();
  });

  it("enquanto a flag carrega não mostra um painel para trocar depois", () => {
    h.loading = true;
    const { container } = renderEntry();
    expect(container).toBeEmptyDOMElement();
  });

  it("quem pediu o antigo não espera a flag", async () => {
    h.loading = true;
    renderEntry("?painel=antigo");
    expect(await screen.findByText("PAINEL ANTIGO")).toBeInTheDocument();
  });
});
