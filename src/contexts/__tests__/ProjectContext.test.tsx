/**
 * Tests for ProjectContext.
 *
 * Cobre a recuperação do "Projeto não encontrado" causado por vínculo
 * pendente: quando a primeira busca volta vazia (RLS escondendo a obra),
 * o provider força o re-link do cliente por e-mail e tenta de novo antes
 * de declarar erro.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import {
  ProjectProvider,
  SILENT_REFETCH_MIN_INTERVAL_MS,
  useProject,
} from "../ProjectContext";

const getProjectWithCustomerMock = vi.fn();
const getCustomerProjectsMock = vi.fn();
const ensureCustomerProjectLinkMock = vi.fn();
const invalidateProjectQueriesMock = vi.fn();

const STABLE_USER = { id: "user-1", email: "cliente@exemplo.com" };

vi.mock("@/infra/repositories", () => ({
  projectsRepo: {
    getProjectWithCustomer: (projectId: string) =>
      getProjectWithCustomerMock(projectId),
    getCustomerProjects: (userId: string) =>
      getCustomerProjectsMock(userId),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: STABLE_USER }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ isCustomer: false, isStaff: true }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/hooks/useLinkCustomerOnLogin", () => ({
  ensureCustomerProjectLink: (
    user: unknown,
    opts?: { force?: boolean },
  ): Promise<void> => ensureCustomerProjectLinkMock(user, opts),
}));

vi.mock("@/lib/amplitude", () => ({
  trackAmplitude: vi.fn(),
}));

vi.mock("@/lib/queryKeys", () => ({
  invalidateProjectQueries: (projectId?: string) =>
    invalidateProjectQueriesMock(projectId),
}));


const PROJECT = {
  id: "p-1",
  name: "Obra Teste",
  status: "active",
};

function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={["/obra/p-1"]}>
      <Routes>
        <Route
          path="/obra/:projectId"
          element={<ProjectProvider>{children}</ProjectProvider>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProjectContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomerProjectLinkMock.mockResolvedValue(undefined);
    getCustomerProjectsMock.mockResolvedValue({ data: [], error: null });
  });


  it("carrega o projeto na primeira tentativa sem forçar re-link", async () => {
    getProjectWithCustomerMock.mockResolvedValue({
      data: PROJECT,
      error: null,
    });

    const { result } = renderHook(() => useProject(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.project).toMatchObject({ id: "p-1" });
    expect(result.current.error).toBeNull();
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(1);
    expect(ensureCustomerProjectLinkMock).not.toHaveBeenCalled();
    expect(invalidateProjectQueriesMock).not.toHaveBeenCalled();
  });

  it("recupera obra invisível por vínculo pendente: força re-link e refaz a busca", async () => {
    getProjectWithCustomerMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: PROJECT, error: null });

    const { result } = renderHook(() => useProject(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(ensureCustomerProjectLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      { force: true },
    );
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(2);
    expect(result.current.project).toMatchObject({ id: "p-1" });
    expect(result.current.error).toBeNull();
    // Acesso recém-estabelecido: queries de escopo do projeto que cachearam
    // listas vazias durante a janela sem vínculo precisam ser invalidadas.
    expect(invalidateProjectQueriesMock).toHaveBeenCalledWith("p-1");
  });

  it('mostra "Projeto não encontrado" só depois do retry pós re-link falhar', async () => {
    getProjectWithCustomerMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useProject(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(ensureCustomerProjectLinkMock).toHaveBeenCalledTimes(1);
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(2);
    expect(result.current.project).toBeNull();
    expect(result.current.error).toBe("Projeto não encontrado");
    // Sem acesso estabelecido, não há cache a invalidar.
    expect(invalidateProjectQueriesMock).not.toHaveBeenCalled();
  });

  it("refetch refaz a busca e limpa o erro quando o projeto passa a existir", async () => {
    getProjectWithCustomerMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useProject(), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.error).toBe("Projeto não encontrado"),
    );

    getProjectWithCustomerMock.mockResolvedValue({
      data: PROJECT,
      error: null,
    });

    act(() => {
      void result.current.refetch();
    });

    await waitFor(() => expect(result.current.project).not.toBeNull());
    expect(result.current.error).toBeNull();
  });

  it("propaga mensagem de erro quando a query falha", async () => {
    getProjectWithCustomerMock.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("permission denied"), {
        userError: { userMessage: "Sem permissão" },
      }),
    });
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useProject(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("permission denied");
    expect(ensureCustomerProjectLinkMock).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// Atualização silenciosa: `is_project_phase` decide entre Jornada e
// Cronograma, mas o projeto só era buscado ao trocar de obra. Ao voltar para
// a aba/janela, o provider rebusca em silêncio (sem loading, sem limpar o
// projeto), no máximo uma vez por minuto.
describe("ProjectContext atualização silenciosa (foco/visibilidade)", () => {
  const T0 = 1_000_000;
  let now = T0;

  beforeEach(() => {
    vi.clearAllMocks();
    now = T0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const fireVisible = () =>
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  const fireFocus = () =>
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

  async function renderLoaded() {
    getProjectWithCustomerMock.mockResolvedValue({
      data: { ...PROJECT, is_project_phase: true },
      error: null,
    });
    const seen: Array<{ loading: boolean; hasProject: boolean }> = [];
    const hook = renderHook(
      () => {
        const ctx = useProject();
        seen.push({ loading: ctx.loading, hasProject: !!ctx.project });
        return ctx;
      },
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    return { ...hook, seen };
  }

  it("ao voltar para a aba atualiza o projeto sem loading nem limpar o projeto", async () => {
    const { result, seen } = await renderLoaded();
    expect(result.current.project?.is_project_phase).toBe(true);
    const rendersBefore = seen.length;

    getProjectWithCustomerMock.mockResolvedValue({
      data: { ...PROJECT, is_project_phase: false },
      error: null,
    });
    now = T0 + SILENT_REFETCH_MIN_INTERVAL_MS + 1;
    fireVisible();

    await waitFor(() =>
      expect(result.current.project?.is_project_phase).toBe(false),
    );
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(2);
    // Nenhum render intermediário com skeleton/projeto vazio.
    expect(
      seen.slice(rendersBefore).every((s) => !s.loading && s.hasProject),
    ).toBe(true);
    expect(result.current.status).toBe("ready");
  });

  it("no máximo uma busca por minuto (foco + visibilidade juntos)", async () => {
    await renderLoaded();
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(1);

    // Logo após carregar: dentro da janela, nada.
    fireFocus();
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(1);

    // Passou 1 minuto: foco e visibilidade disparam juntos → uma busca só.
    now = T0 + SILENT_REFETCH_MIN_INTERVAL_MS + 1;
    fireVisible();
    fireFocus();
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(2);

    // 30s depois: ainda dentro da janela.
    now += 30_000;
    fireFocus();
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(2);

    now += SILENT_REFETCH_MIN_INTERVAL_MS;
    fireFocus();
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(3);
  });

  it("erro na busca silenciosa mantém o projeto atual", async () => {
    const { result } = await renderLoaded();
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    getProjectWithCustomerMock.mockResolvedValue({
      data: null,
      error: new Error("Failed to fetch"),
    });
    now = T0 + SILENT_REFETCH_MIN_INTERVAL_MS + 1;
    fireVisible();

    await waitFor(() =>
      expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(2),
    );
    expect(result.current.project).toMatchObject({ id: "p-1" });
    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
    warnSpy.mockRestore();
  });

  it("resposta silenciosa atrasada não sobrescreve uma busca completa mais nova", async () => {
    const { result } = await renderLoaded();

    let resolveSilent: (v: unknown) => void = () => undefined;
    getProjectWithCustomerMock.mockImplementationOnce(
      () => new Promise((resolve) => (resolveSilent = resolve)),
    );
    now = T0 + SILENT_REFETCH_MIN_INTERVAL_MS + 1;
    fireVisible();
    expect(getProjectWithCustomerMock).toHaveBeenCalledTimes(2);

    // Busca completa (refetch manual) começa e termina antes da silenciosa.
    getProjectWithCustomerMock.mockResolvedValueOnce({
      data: { ...PROJECT, name: "Obra Nova" },
      error: null,
    });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.project?.name).toBe("Obra Nova");

    await act(async () => {
      resolveSilent({
        data: { ...PROJECT, name: "Obra Antiga" },
        error: null,
      });
    });
    expect(result.current.project?.name).toBe("Obra Nova");
  });
});

// Fallback de customer: quando a obra do link some (soft-delete de duplicata
// ou orphan) o cliente não pode ficar preso em "Projeto não encontrado" se
// tiver outras obras acessíveis — deve ser redirecionado.
describe("ProjectContext customer fallback", () => {
  const navigateMock = vi.fn();
  const toastMock = vi.fn();

  vi.doMock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
    return { ...actual, useNavigate: () => navigateMock };
  });

  it("redireciona cliente para outra obra ativa quando a atual não existe", async () => {
    // Reset via dynamic import in isolated module scope
    vi.resetModules();
    vi.doMock("@/hooks/useUserRole", () => ({
      useUserRole: () => ({ isCustomer: true, isStaff: false }),
    }));
    vi.doMock("@/hooks/useAuth", () => ({
      useAuth: () => ({ user: STABLE_USER }),
    }));
    vi.doMock("@/hooks/use-toast", () => ({ toast: toastMock }));
    vi.doMock("@/hooks/useLinkCustomerOnLogin", () => ({
      ensureCustomerProjectLink: () => Promise.resolve(),
    }));
    vi.doMock("@/lib/amplitude", () => ({ trackAmplitude: vi.fn() }));
    vi.doMock("@/lib/queryKeys", () => ({
      invalidateProjectQueries: vi.fn(),
    }));
    vi.doMock("@/infra/repositories", () => ({
      projectsRepo: {
        getProjectWithCustomer: () =>
          Promise.resolve({ data: null, error: null }),
        getCustomerProjects: () =>
          Promise.resolve({
            data: [{ id: "p-outra", name: "Outra", status: "active" }],
            error: null,
          }),
      },
    }));
    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom",
      );
      return { ...actual, useNavigate: () => navigateMock };
    });

    const { ProjectProvider: FreshProvider, useProject: freshUseProject } =
      await import("../ProjectContext");
    const { MemoryRouter, Route, Routes } = await import("react-router-dom");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={["/obra/p-1"]}>
        <Routes>
          <Route
            path="/obra/:projectId"
            element={<FreshProvider>{children}</FreshProvider>}
          />
        </Routes>
      </MemoryRouter>
    );

    const { result } = renderHook(() => freshUseProject(), { wrapper });
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/obra/p-outra", {
        replace: true,
      }),
    );
    expect(toastMock).toHaveBeenCalled();
    expect(result.current.error).not.toBe("Projeto não encontrado");
  });
});

