import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ReactNode } from "react";
import { useObraBreadcrumbs } from "@/hooks/useObraBreadcrumbs";

vi.mock("@/contexts/ProjectContext", () => ({
  useProjectOptional: () => ({
    project: {
      name: "Apto 101",
      unit_name: "Bloco A",
    },
    loading: false,
    error: null,
    setProject: vi.fn(),
  }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ isStaff: true, loading: false }),
}));

const wrap = (path: string, route: string) => {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  );
};

describe("useObraBreadcrumbs", () => {
  it("returns empty list outside known scopes", () => {
    const { result } = renderHook(() => useObraBreadcrumbs(), {
      wrapper: wrap("/qualquer-coisa", "/qualquer-coisa"),
    });
    expect(result.current).toEqual([]);
  });

  it("builds gestao crumbs with section label", () => {
    const { result } = renderHook(() => useObraBreadcrumbs(), {
      wrapper: wrap("/gestao/atividades", "/gestao/atividades"),
    });
    expect(result.current[0]).toEqual({
      label: "Gestão",
      href: "/gestao/painel-obras",
    });
    expect(result.current[1]?.label).toBe("Atividades");
  });

  it("collapses /gestao/painel-obras to a single Gestão crumb", () => {
    const { result } = renderHook(() => useObraBreadcrumbs(), {
      wrapper: wrap("/gestao/painel-obras", "/gestao/painel-obras"),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].label).toBe("Gestão");
  });

  it("builds project crumbs with project name and section", () => {
    const { result } = renderHook(() => useObraBreadcrumbs(), {
      wrapper: wrap("/obra/abc123/cronograma", "/obra/:projectId/cronograma"),
    });
    expect(result.current).toHaveLength(3);
    expect(result.current[0]).toEqual({
      label: "Painel de Obras",
      href: "/gestao/painel-obras",
    });
    expect(result.current[1]).toEqual({
      label: "Apto 101 – Bloco A",
      href: "/obra/abc123",
    });
    expect(result.current[2].label).toBe("Cronograma");
  });
});
