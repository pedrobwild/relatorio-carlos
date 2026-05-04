import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ReactNode } from "react";
import { useObraBreadcrumbs } from "@/hooks/useObraBreadcrumbs";

// Mock useUserRole — we toggle isStaff per test via this state container.
let mockIsStaff = false;
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    isStaff: mockIsStaff,
    isAdmin: false,
    isCustomer: !mockIsStaff,
    isManager: false,
    roles: mockIsStaff ? (["engineer"] as const) : (["customer"] as const),
    role: mockIsStaff ? "engineer" : "customer",
    loading: false,
    hasRole: () => false,
    hasAnyRole: () => false,
  }),
}));

const wrapper =
  (initialRoute: string) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/obra/:projectId/*" element={children} />
        <Route path="/gestao/*" element={children} />
        <Route path="*" element={children} />
      </Routes>
    </MemoryRouter>
  );

describe("useObraBreadcrumbs", () => {
  beforeEach(() => {
    mockIsStaff = false;
  });

  it("returns [] for unrelated routes", () => {
    const { result } = renderHook(() => useObraBreadcrumbs(), {
      wrapper: wrapper("/auth"),
    });
    expect(result.current).toEqual([]);
  });

  it("builds [Minhas Obras > Obra > Section] for client on /obra/:id/<section>", () => {
    mockIsStaff = false;
    const { result } = renderHook(() => useObraBreadcrumbs(), {
      wrapper: wrapper("/obra/abc-123/cronograma"),
    });
    expect(result.current).toHaveLength(3);
    expect(result.current[0]).toEqual({
      label: "Minhas Obras",
      href: "/minhas-obras",
    });
    expect(result.current[1]).toMatchObject({
      label: "Obra", // no project context in test
      href: "/obra/abc-123",
    });
    // Client label for cronograma is "Evolução da Obra".
    expect(result.current[2].label).toBe("Evolução da Obra");
  });

  it("builds staff breadcrumb starting at Painel de Obras", () => {
    mockIsStaff = true;
    const { result } = renderHook(() => useObraBreadcrumbs(), {
      wrapper: wrapper("/obra/abc-123/compras"),
    });
    expect(result.current[0]).toEqual({
      label: "Painel de Obras",
      href: "/gestao/painel-obras",
    });
    expect(result.current[2].label).toBe("Compras");
  });

  it("builds /gestao/* trail with section labels", () => {
    mockIsStaff = true;
    const { result } = renderHook(() => useObraBreadcrumbs(), {
      wrapper: wrapper("/gestao/painel-obras"),
    });
    expect(result.current).toEqual([
      { label: "Gestão", href: "/gestao/painel-obras" },
      { label: "Painel de Obras" },
    ]);
  });

  it("skips UUID-looking segments in /gestao/* trails", () => {
    mockIsStaff = true;
    const uuid = "12345678-90ab-4cde-8f01-23456789abcd";
    const { result } = renderHook(() => useObraBreadcrumbs(), {
      wrapper: wrapper(`/gestao/orcamentos/${uuid}`),
    });
    // UUID is filtered out — last visible segment is "Orçamentos".
    const labels = result.current.map((c) => c.label);
    expect(labels).toContain("Orçamentos");
    expect(labels.some((l) => l.includes(uuid))).toBe(false);
  });
});
