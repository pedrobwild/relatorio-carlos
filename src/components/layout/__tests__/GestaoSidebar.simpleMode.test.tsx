/**
 * GestaoSidebar — modo simples (Fase 0 da reformulação do processo core).
 *
 * Gestor de obra (papel só de campo) vê apenas Obras / Semana / Hoje e um
 * botão para abrir o menu completo. Escritório/admin continua vendo tudo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppRole } from "@/hooks/useUserRole";

const state: { roles: AppRole[]; flag: boolean; novoPainel: boolean; reformulado: boolean; oQueFazer: boolean } = {
  roles: ["gestor"],
  flag: true,
  novoPainel: false,
  reformulado: false,
  oQueFazer: false,
};

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    roles: state.roles,
    isAdmin: state.roles.includes("admin"),
    isStaff: true,
    loading: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u-test", email: "gestor@bewild.com.br" } }),
}));

vi.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({
    flags: { simpleModeGestor: state.flag, novoPainelObras: state.novoPainel, painelReformulado: state.reformulado },
    isEnabled: (key: string) =>
      key === "simpleModeGestor"
        ? state.flag
        : key === "novoPainelObras"
          ? state.novoPainel
          : key === "painelReformulado"
            ? state.reformulado
            : key === "telaOQueFazer"
              ? state.oQueFazer
              : false,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useScheduleAlerts", () => ({
  useScheduleAlertsSummary: () => ({ total: 0 }),
}));

vi.mock("@/hooks/useScheduleAlertPrefs", () => ({
  useScheduleAlertPrefs: () => ({ prefs: { showBadge: false } }),
}));

vi.mock("@/lib/assistantAccess", () => ({
  isAssistantAllowed: () => false,
}));

import { GestaoSidebar } from "../GestaoSidebar";

function Onde() {
  const l = useLocation();
  return <output data-testid="onde">{l.pathname + l.search}</output>;
}

function renderSidebar(entry = "/gestao/painel-obras") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SidebarProvider>
        <TooltipProvider>
          <GestaoSidebar />
        </TooltipProvider>
      </SidebarProvider>
      <Onde />
    </MemoryRouter>,
  );
}

describe("GestaoSidebar · modo simples", () => {
  beforeEach(() => {
    state.roles = ["gestor"];
    state.flag = true;
    state.novoPainel = false;
    state.reformulado = false;
    window.localStorage.clear();
  });

  it("gestor vê só Obras / Semana / Hoje, apontando para telas existentes", () => {
    renderSidebar();

    const links = screen.getAllByRole("link").map((a) => [
      a.textContent?.trim(),
      a.getAttribute("href"),
    ]);
    expect(links).toEqual([
      ["Obras", "/gestao/painel-obras"],
      ["Semana", "/gestao/semana"],
      ["Hoje", "/gestao/hoje"],
    ]);
    expect(screen.queryByRole("link", { name: /Fornecedores/ })).toBeNull();
    expect(screen.queryByRole("tablist", { name: /Obras e Projetos/ })).toBeNull();
  });

  it("com a tela 'O que fazer' ligada, ela é o 1º item do menu simples e do completo", () => {
    state.oQueFazer = true;
    try {
      renderSidebar();
      const first = screen.getAllByRole("link")[0];
      expect([first.textContent?.trim(), first.getAttribute("href")]).toEqual(["O que fazer", "/gestao/o-que-fazer"]);
      fireEvent.click(screen.getByRole("button", { name: "Ver menu completo" }));
      expect(screen.getByRole("link", { name: /O que fazer/ })).toHaveAttribute("href", "/gestao/o-que-fazer");
    } finally {
      state.oQueFazer = false;
    }
  });

  it("gestor consegue abrir o menu completo e a escolha persiste", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Ver menu completo" }));

    expect(screen.getByRole("link", { name: /Fornecedores/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lookahead/ })).toBeInTheDocument();
    expect(window.localStorage.getItem("bwild.menuMode.u-test")).toBe("full");

    // Voltar ao simples limpa o override (segue o padrão de novo).
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao menu simples" }));
    expect(screen.queryByRole("link", { name: /Fornecedores/ })).toBeNull();
    expect(window.localStorage.getItem("bwild.menuMode.u-test")).toBeNull();
  });

  it("engineer com papel de escritório (admin) mantém o menu completo sem alternador", () => {
    state.roles = ["engineer", "admin"];
    renderSidebar();

    expect(screen.getByRole("link", { name: /Painel de Obras/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Fornecedores/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });

  it("Resumo da semana aparece no menu completo só para quem tem a permissão (admin/manager)", () => {
    state.roles = ["admin"];
    const { unmount } = renderSidebar();
    expect(screen.getByRole("link", { name: /Resumo da semana/ })).toHaveAttribute("href", "/gestao/resumo");
    unmount();

    // Gestor no menu completo (flag desligada) não vê o resumo da diretoria.
    state.roles = ["gestor"];
    state.flag = false;
    renderSidebar();
    expect(screen.getByRole("link", { name: /Painel de Obras/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Resumo da semana/ })).toBeNull();
  });

  it("flag desligada → gestor vê o menu completo (rollback sem deploy)", () => {
    state.flag = false;
    renderSidebar();

    expect(screen.getByRole("link", { name: /Painel de Obras/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Fornecedores/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });

  it("flag novoPainelObras ligada → Obras abre a tela nova (Fase 5)", () => {
    state.novoPainel = true;
    renderSidebar();

    expect(screen.getByRole("link", { name: "Obras" })).toHaveAttribute("href", "/gestao/obras");
  });

  it("flag novoPainelObras ligada → menu completo ganha Obras e mantém o Painel de Obras", () => {
    state.novoPainel = true;
    state.roles = ["admin"];
    renderSidebar();

    expect(screen.getByRole("link", { name: "Obras" })).toHaveAttribute("href", "/gestao/obras");
    expect(screen.getByRole("link", { name: /Painel de Obras/ })).toHaveAttribute("href", "/gestao/painel-obras");
  });

  it("painel reformulado ligado → menu completo fica só com o Painel de Obras (é a mesma tela)", () => {
    state.novoPainel = true;
    state.reformulado = true;
    state.roles = ["admin"];
    renderSidebar();

    expect(screen.queryByRole("link", { name: "Obras" })).toBeNull();
    expect(screen.getByRole("link", { name: /Painel de Obras/ })).toHaveAttribute("href", "/gestao/painel-obras");
  });

  it("painel reformulado: trocar para Projetos sai de Concluídas e fecha a gaveta", () => {
    state.reformulado = true;
    state.roles = ["admin"];
    renderSidebar("/gestao/painel-obras?aba=concluidas&obra=x&view=board");

    fireEvent.click(screen.getByRole("tab", { name: "Projetos" }));
    expect(screen.getByTestId("onde").textContent).toBe("/gestao/painel-obras?view=board&fase=projetos");
  });

  it("painel antigo: trocar de fase mantém os outros filtros (lá fase e aba são independentes)", () => {
    state.reformulado = true;
    state.roles = ["admin"];
    renderSidebar("/gestao/painel-obras?painel=antigo&aba=concluidas");

    fireEvent.click(screen.getByRole("tab", { name: "Projetos" }));
    expect(screen.getByTestId("onde").textContent).toBe("/gestao/painel-obras?painel=antigo&aba=concluidas&fase=projetos");
  });
});
