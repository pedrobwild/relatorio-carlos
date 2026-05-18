import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MobileBottomNav } from "../MobileBottomNav";

const navState = {
  pathname: "/gestao/painel-obras",
  projectId: undefined as string | undefined,
  isStaff: true,
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useLocation: () => ({ pathname: navState.pathname }),
  };
});

vi.mock("@/hooks/useProjectNavigation", () => ({
  useProjectNavigation: () => ({
    projectId: navState.projectId,
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

describe("MobileBottomNav — reset do hub da obra", () => {
  beforeEach(() => {
    localStorage.clear();
    navState.pathname = "/gestao/painel-obras";
    navState.projectId = undefined;
    navState.isStaff = true;
  });

  it('ao tocar em "Obras" numa rota global, limpa o detalhe persistido e volta o tab para cronograma', () => {
    localStorage.setItem("bwild:lastProjectId", "proj-123");
    localStorage.setItem(
      "portal:view:proj-123",
      JSON.stringify({
        activeTab: "relatorios",
        weeklyReport: { open: true, index: 2 },
      }),
    );
    localStorage.setItem("mobileBottomNav:lastSlot:proj-123", "documentos");

    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: /^Obras/i }));

    expect(localStorage.getItem("mobileBottomNav:lastSlot:proj-123")).toBeNull();
    expect(JSON.parse(localStorage.getItem("portal:view:proj-123") || "{}")).toEqual({
      activeTab: "cronograma",
      weeklyReport: { open: false, index: 2 },
    });
  });

  it('também reseta ao tocar em "Obra" dentro da rota da obra', () => {
    navState.isStaff = false;
    navState.pathname = "/obra/proj-456/documentos";
    navState.projectId = "proj-456";
    localStorage.setItem(
      "portal:view:proj-456",
      JSON.stringify({
        activeTab: "documentos",
        weeklyReport: { open: true, index: 1 },
      }),
    );
    localStorage.setItem("mobileBottomNav:lastSlot:proj-456", "documentos");

    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: /^Obra/i }));

    expect(localStorage.getItem("mobileBottomNav:lastSlot:proj-456")).toBeNull();
    expect(JSON.parse(localStorage.getItem("portal:view:proj-456") || "{}")).toEqual({
      activeTab: "cronograma",
      weeklyReport: { open: false, index: 1 },
    });
  });
});