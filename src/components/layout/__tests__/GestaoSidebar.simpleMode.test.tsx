/**
 * GestaoSidebar — modo simples (Fase 0 da reformulação do processo core).
 *
 * Gestor de obra (papel só de campo) vê apenas Obras / Semana / Hoje e um
 * botão para abrir o menu completo. Escritório/admin continua vendo tudo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppRole } from "@/hooks/useUserRole";

const state: { roles: AppRole[]; flag: boolean } = { roles: ["gestor"], flag: true };

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
    flags: { simpleModeGestor: state.flag },
    isEnabled: (key: string) => (key === "simpleModeGestor" ? state.flag : false),
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

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/gestao/painel-obras"]}>
      <SidebarProvider>
        <TooltipProvider>
          <GestaoSidebar />
        </TooltipProvider>
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe("GestaoSidebar · modo simples", () => {
  beforeEach(() => {
    state.roles = ["gestor"];
    state.flag = true;
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
      ["Semana", "/gestao/lookahead"],
      ["Hoje", "/gestao/minha-semana"],
    ]);
    expect(screen.queryByRole("link", { name: /Fornecedores/ })).toBeNull();
    expect(screen.queryByRole("tablist", { name: /Obras e Projetos/ })).toBeNull();
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

  it("flag desligada → gestor vê o menu completo (rollback sem deploy)", () => {
    state.flag = false;
    renderSidebar();

    expect(screen.getByRole("link", { name: /Painel de Obras/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hoje" })).toBeNull();
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });
});
