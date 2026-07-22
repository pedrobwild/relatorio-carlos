/**
 * Tests for ProjectContext.
 *
 * Cobre a recuperação do "Projeto não encontrado" causado por vínculo
 * pendente: quando a primeira busca volta vazia (RLS escondendo a obra),
 * o provider força o re-link do cliente por e-mail e tenta de novo antes
 * de declarar erro.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { ProjectProvider, useProject } from "../ProjectContext";

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
