import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MobileBottomNav } from "../MobileBottomNav";

const navState = {
  projectId: "proj-1" as string | undefined,
  isStaff: false,
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

vi.mock("../MobileProfileSheet", () => ({
  MobileProfileSheet: () => null,
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
});
