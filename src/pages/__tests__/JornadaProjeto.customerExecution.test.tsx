/**
 * Jornada · obra já em execução
 *
 * Caso real: cliente (Exalt 808) com a obra rodando lia "Etapa atual:
 * Briefing" / "Liberação da Obra" porque as etapas pré-obra ficaram pendentes
 * no banco. Com `is_project_phase = false`:
 *  1. o CLIENTE vê todas as etapas concluídas (só exibição);
 *  2. a EQUIPE continua vendo os status reais;
 *  3. em fase de projeto, o cliente vê os status reais.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import type {
  JourneyStage,
  JourneyStageStatus,
} from "@/hooks/useProjectJourney";

const state = vi.hoisted(() => ({
  project: { id: "p1", name: "Exalt 808", is_project_phase: false } as Record<
    string,
    unknown
  >,
  role: { role: "customer", loading: false, isStaff: false } as Record<
    string,
    unknown
  >,
  journey: null as unknown,
}));

const tabContentProps = vi.hoisted(() => vi.fn());
const noop = vi.hoisted(() => () => undefined);

vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("@/contexts/ProjectContext", () => ({
  useProject: () => ({ project: state.project, loading: false }),
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => state.role,
}));
vi.mock("@/hooks/useProjectJourney", () => ({
  useProjectJourney: () => ({
    data: state.journey,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useInitializeJourney: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children }: { children?: ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/components/layout/ProjectLayoutContext", () => ({
  useProjectLayout: () => ({ hasShell: true }),
}));
vi.mock("@/hooks/useKeyboardShortcuts", () => ({ useTabKeyboardNav: noop }));
vi.mock("@/hooks/usePullToRefresh", () => ({
  usePullToRefresh: () => ({
    pulling: false,
    refreshing: false,
    pullDistance: 0,
    threshold: 80,
  }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/usePendencias", () => ({
  usePendencias: () => ({ stats: { total: 0 } }),
}));
vi.mock("@/pages/jornada/JornadaTabsBar", () => ({ JornadaTabsBar: noop }));
vi.mock("@/pages/jornada/MobileNavDrawer", () => ({ MobileNavDrawer: noop }));
vi.mock("@/components/journey/ProjectPhaseCompletionBanner", () => ({
  ProjectPhaseCompletionBanner: noop,
}));
vi.mock("@/components/internal-notes/InternalNotesCard", () => ({
  InternalNotesCard: noop,
}));
vi.mock("@/pages/jornada/JornadaTabContent", () => ({
  JornadaTabContent: (props: unknown) => {
    tabContentProps(props);
    return null;
  },
}));

import JornadaProjeto from "@/pages/JornadaProjeto";

const stage = (id: string, status: JourneyStageStatus): JourneyStage =>
  ({ id, name: id, status, todos: [] }) as unknown as JourneyStage;

const STALE_STAGES = [
  stage("Briefing", "completed"),
  stage("Projeto 3D", "completed"),
  stage("Medição Técnica", "completed"),
  stage("Projeto Executivo", "completed"),
  stage("Liberação da Obra", "in_progress"),
  stage("Mobilização", "pending"),
];

interface CapturedProps {
  journey: { stages: JourneyStage[] };
  hasRealProgress: boolean;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/obra/p1/jornada"]}>
      <Routes>
        <Route path="/obra/:projectId/jornada" element={<JornadaProjeto />} />
      </Routes>
    </MemoryRouter>,
  );
  const calls = tabContentProps.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as CapturedProps;
}

const statuses = (p: CapturedProps) => p.journey.stages.map((s) => s.status);

describe("JornadaProjeto · etapas exibidas com a obra em execução", () => {
  beforeEach(() => {
    tabContentProps.mockClear();
    localStorage.clear();
    state.project = { id: "p1", name: "Exalt 808", is_project_phase: false };
    state.role = { role: "customer", loading: false, isStaff: false };
    state.journey = { hero: { id: "h1" }, stages: STALE_STAGES };
  });

  it("cliente vê todas as etapas concluídas (sem alterar os dados)", () => {
    const props = renderPage();

    expect(statuses(props)).toEqual(Array(6).fill("completed"));
    expect(props.hasRealProgress).toBe(true);
    // Só exibição: o objeto vindo da query segue com os status reais.
    expect(STALE_STAGES[4].status).toBe("in_progress");
  });

  it("cliente sem nenhum progresso no banco também vê tudo concluído", () => {
    state.journey = {
      hero: { id: "h1" },
      stages: [stage("Briefing", "in_progress"), stage("Projeto 3D", "pending")],
    };

    const props = renderPage();

    expect(statuses(props)).toEqual(["completed", "completed"]);
    // Sem isso o JornadaTabContent zeraria tudo para "pending" (boas-vindas).
    expect(props.hasRealProgress).toBe(true);
  });

  it("equipe vê os status reais", () => {
    state.role = { role: "engineer", loading: false, isStaff: true };

    const props = renderPage();

    expect(statuses(props)).toEqual(STALE_STAGES.map((s) => s.status));
  });

  it("cliente em fase de projeto vê os status reais", () => {
    state.project = { id: "p1", name: "Exalt 808", is_project_phase: true };

    const props = renderPage();

    expect(statuses(props)).toEqual(STALE_STAGES.map((s) => s.status));
  });
});
