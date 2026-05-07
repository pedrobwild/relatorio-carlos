import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { ReactNode } from "react";

// Wrapper with router context
const createWrapper = (initialRoute: string) => {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/obra/:projectId/*" element={children} />
        <Route path="*" element={children} />
      </Routes>
    </MemoryRouter>
  );
};

describe("useProjectNavigation", () => {
  it("should return null projectId when not in project route", () => {
    const { result } = renderHook(() => useProjectNavigation(), {
      wrapper: createWrapper("/some-other-route"),
    });

    expect(result.current.projectId).toBeUndefined();
  });

  it("should extract projectId from route params", () => {
    const { result } = renderHook(() => useProjectNavigation(), {
      wrapper: createWrapper("/obra/project-123/relatorio"),
    });

    expect(result.current.projectId).toBe("project-123");
  });

  it("should generate correct project paths", () => {
    const { result } = renderHook(() => useProjectNavigation(), {
      wrapper: createWrapper("/obra/project-123/relatorio"),
    });

    expect(result.current.paths.relatorio).toBe("/obra/project-123/relatorio");
    expect(result.current.paths.contrato).toBe("/obra/project-123/contrato");
    expect(result.current.paths.projeto3D).toBe("/obra/project-123/projeto-3d");
    expect(result.current.paths.executivo).toBe("/obra/project-123/executivo");
    expect(result.current.paths.financeiro).toBe(
      "/obra/project-123/financeiro",
    );
    expect(result.current.paths.pendencias).toBe(
      "/obra/project-123/pendencias",
    );
    expect(result.current.paths.documentos).toBe(
      "/obra/project-123/documentos",
    );
    expect(result.current.paths.formalizacoes).toBe(
      "/obra/project-123/formalizacoes",
    );
    expect(result.current.paths.formalizacoesNova).toBe(
      "/obra/project-123/formalizacoes/nova",
    );
  });

  it("should return path without projectId prefix when no projectId", () => {
    const { result } = renderHook(() => useProjectNavigation(), {
      wrapper: createWrapper("/some-route"),
    });

    expect(result.current.getProjectPath("/relatorio")).toBe("/relatorio");
  });

  it("should return path with projectId prefix when projectId exists", () => {
    const { result } = renderHook(() => useProjectNavigation(), {
      wrapper: createWrapper("/obra/abc-123/test"),
    });

    expect(result.current.getProjectPath("/custom-path")).toBe(
      "/obra/abc-123/custom-path",
    );
  });
});
