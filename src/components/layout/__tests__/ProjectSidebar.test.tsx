/**
 * ProjectSidebar — itens na fase de projeto.
 *
 * Garante que a equipe consegue abrir o Cronograma enquanto a obra está em
 * fase de projeto (precisa subir o cronograma antes de iniciar a obra),
 * enquanto "Obra" (relatório) continua bloqueado até a execução.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const projectState: { is_project_phase: boolean } = { is_project_phase: true };

vi.mock("@/contexts/ProjectContext", () => ({
  useProject: () => ({
    project: { id: "p1", name: "Obra Teste", ...projectState },
    loading: false,
  }),
}));

vi.mock("@/hooks/usePendencias", () => ({
  usePendencias: () => ({
    stats: { total: 0, overdueCount: 0, byType: { signature: 0, invoice: 0 } },
  }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ isStaff: true, roles: ["engineer"], loading: false }),
}));

vi.mock("@/hooks/useCan", () => ({
  useCan: () => ({ can: () => true, loading: false }),
}));

import { ProjectSidebar } from "../ProjectSidebar";

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/obra/p1/jornada"]}>
      <Routes>
        <Route
          path="/obra/:projectId/*"
          element={
            <SidebarProvider>
              <TooltipProvider>
                <ProjectSidebar />
              </TooltipProvider>
            </SidebarProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectSidebar · fase de projeto", () => {
  beforeEach(() => {
    projectState.is_project_phase = true;
  });

  it("libera o Cronograma para a equipe na fase de projeto", () => {
    renderSidebar();

    const cronograma = screen.getByRole("link", { name: "Cronograma" });
    expect(cronograma).toHaveAttribute("href", "/obra/p1/cronograma");
  });

  it("mantém 'Obra' (relatório) desabilitado na fase de projeto", () => {
    renderSidebar();

    expect(screen.queryByRole("link", { name: "Obra" })).toBeNull();
    // Continua visível, só que como item desabilitado (sem link).
    expect(screen.getAllByText("Obra").length).toBeGreaterThan(0);
  });

  it("em execução, Cronograma e Obra são links normais", () => {
    projectState.is_project_phase = false;
    renderSidebar();

    expect(screen.getByRole("link", { name: "Cronograma" })).toHaveAttribute(
      "href",
      "/obra/p1/cronograma",
    );
    expect(screen.getByRole("link", { name: "Obra" })).toHaveAttribute(
      "href",
      "/obra/p1/relatorio",
    );
  });
});
