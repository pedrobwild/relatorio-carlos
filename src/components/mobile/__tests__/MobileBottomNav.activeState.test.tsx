import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MobileBottomNav } from "../MobileBottomNav";

const navState = {
  projectId: "proj-1" as string | undefined,
  isStaff: false,
  isSimple: false,
  novoPainel: false,
};

vi.mock("@/hooks/useProjectNavigation", () => ({
  useProjectNavigation: () => ({
    projectId: navState.projectId,
    // Paths aren't consulted by the obra/financeiro/pendências slots (they
    // derive the URL from projectId directly), so an empty object is enough.
    paths: {},
  }),
}));

vi.mock("@/hooks/usePendencias", () => ({
  usePendencias: () => ({ stats: { overdueCount: 0, urgentCount: 0 } }),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ isStaff: navState.isStaff }),
}));

vi.mock("@/hooks/useMenuMode", () => ({
  useMenuMode: () => ({ isSimple: navState.isSimple }),
}));

vi.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({ isEnabled: (key: string) => key === "novoPainelObras" && navState.novoPainel }),
}));

vi.mock("../MobileProfileSheet", () => ({
  MobileProfileSheet: () => null,
}));

vi.mock("../RegistrarSheet", () => ({
  RegistrarSheet: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Registrar" /> : null,
}));

/**
 * Regression: the obra hub tab (`/obra/:id`) is a prefix of every project
 * sub-route, so without NavLink `end` it stayed active alongside the real tab,
 * lighting up two tabs at once. The hub slots now declare `end: true`.
 */
describe("MobileBottomNav — active state on sub-routes", () => {
  beforeEach(() => {
    localStorage.clear();
    navState.projectId = "proj-1";
    navState.isStaff = false;
    navState.isSimple = false;
    navState.novoPainel = false;
  });

  it('cliente em /financeiro: só "Financeiro" fica ativo, não "Obra"', () => {
    render(
      <MemoryRouter initialEntries={["/obra/proj-1/financeiro"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    const obra = screen.getByRole("link", { name: /^Obra$/i });
    const financeiro = screen.getByRole("link", { name: /^Financeiro$/i });

    expect(financeiro).toHaveAttribute("aria-current", "page");
    expect(obra).not.toHaveAttribute("aria-current");
  });

  it('staff em /pendencias: só "Pendências" fica ativo, não "Obras"', () => {
    navState.isStaff = true;

    render(
      <MemoryRouter initialEntries={["/obra/proj-1/pendencias"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    const obras = screen.getByRole("link", { name: /^Obras$/i });
    const pendencias = screen.getByRole("link", { name: /Pendências/i });

    expect(pendencias).toHaveAttribute("aria-current", "page");
    expect(obras).not.toHaveAttribute("aria-current");
  });

  it('cliente no hub /obra/:id: "Obra" fica ativo', () => {
    render(
      <MemoryRouter initialEntries={["/obra/proj-1"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    const obra = screen.getByRole("link", { name: /^Obra$/i });
    expect(obra).toHaveAttribute("aria-current", "page");
  });

  it('cliente no hub de relatório /obra/:id/relatorio: "Obra" continua ativo', () => {
    // /obra/:id/relatorio renderiza a mesma página Index do hub da obra, então
    // a aba "Obra" deve permanecer ativa (alias do hub), e nenhuma outra aba.
    render(
      <MemoryRouter initialEntries={["/obra/proj-1/relatorio"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    const obra = screen.getByRole("link", { name: /^Obra$/i });
    const financeiro = screen.getByRole("link", { name: /^Financeiro$/i });

    expect(obra).toHaveAttribute("aria-current", "page");
    expect(financeiro).not.toHaveAttribute("aria-current");
  });

  it("equipe: Hoje, Obras, Registrar, Pendências e Perfil; Obras abre a lista e fica aceso dentro da obra", () => {
    navState.isStaff = true;

    render(
      <MemoryRouter initialEntries={["/obra/proj-1/etapas"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const labels = Array.from(nav.querySelectorAll("a, button")).map(
      (el) => el.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Hoje", "Obras", "Registrar", "Pendências", "Perfil"]);

    const obras = screen.getByRole("link", { name: /^Obras$/i });
    expect(obras).toHaveAttribute("href", "/gestao/painel-obras");
    expect(obras).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Hoje$/i })).toHaveAttribute("href", "/gestao/hoje");
    expect(screen.queryByRole("link", { name: /Atividades/i })).toBeNull();
  });

  it("equipe: o botão Registrar abre a gaveta", () => {
    navState.isStaff = true;

    render(
      <MemoryRouter initialEntries={["/gestao/hoje"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("dialog", { name: "Registrar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(screen.getByRole("dialog", { name: "Registrar" })).toBeInTheDocument();
  });

  it("cliente: sem botão Registrar", () => {
    render(
      <MemoryRouter initialEntries={["/obra/proj-1"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
  });

  it("gestor no modo simples: a barra é Obras / Semana / Registrar / Hoje, com Hoje ativo na tela Hoje", () => {
    navState.isStaff = true;
    navState.isSimple = true;
    navState.novoPainel = true;
    navState.projectId = undefined;

    render(
      <MemoryRouter initialEntries={["/gestao/hoje"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /^Obras$/i })).toHaveAttribute("href", "/gestao/obras");
    expect(screen.getByRole("link", { name: /^Semana$/i })).toHaveAttribute("href", "/gestao/semana");
    expect(screen.getByRole("link", { name: /^Hoje$/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Registrar" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Atividades/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Pendências/i })).toBeNull();
  });

  it("modo simples sem a tela Obras nova: Obras leva ao Painel e fica ativo nele", () => {
    navState.isStaff = true;
    navState.isSimple = true;
    navState.projectId = undefined;

    render(
      <MemoryRouter initialEntries={["/gestao/painel-obras"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    const obras = screen.getByRole("link", { name: /^Obras$/i });
    expect(obras).toHaveAttribute("href", "/gestao/painel-obras");
    expect(obras).toHaveAttribute("aria-current", "page");
  });
});
