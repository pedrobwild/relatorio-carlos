/**
 * Regressão: papéis do usuário devem sobreviver a um 401 no primeiro
 * carregamento.
 *
 * A leitura de `user_roles` é uma chamada direta ao Supabase — não passa pelo
 * TanStack Query — então a recuperação de sessão do `queryClient` nunca a
 * alcança. Sem retry próprio, um token vencido no boot (a renovação disparada
 * por `installSessionRecovery` ainda em voo quando o React monta) deixava o
 * usuário parado na tela "Não conseguimos confirmar suas permissões", com um
 * botão de tentar novamente que só repetia o mesmo 401.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const selectResults: Array<{ data: unknown; error: unknown }> = [];
let selectCalls = 0;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => {
          const next = selectResults[selectCalls] ?? {
            data: [],
            error: null,
          };
          selectCalls += 1;
          return Promise.resolve(next);
        }),
      })),
    })),
  },
}));

const recoverFromAuthError = vi.fn();

vi.mock("@/lib/authRecovery", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/authRecovery")>(
      "@/lib/authRecovery",
    );
  return {
    ...actual,
    recoverFromAuthError: () => recoverFromAuthError(),
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    loading: false,
    session: {},
    isAuthenticated: true,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/debugAuth", () => ({ debugAuth: vi.fn() }));
vi.mock("@/lib/errorLogger", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

import { useUserRole, clearRoleCache } from "@/hooks/useUserRole";

const JWT_EXPIRED = {
  message: "JWT expired",
  details: "",
  hint: "",
  code: "PGRST301",
};

beforeEach(() => {
  selectResults.length = 0;
  selectCalls = 0;
  recoverFromAuthError.mockReset();
  clearRoleCache();
});

afterEach(() => {
  clearRoleCache();
});

describe("useUserRole — recuperação de sessão", () => {
  it("renova a sessão e tenta de novo quando a leitura devolve 401", async () => {
    selectResults.push({ data: null, error: JWT_EXPIRED });
    selectResults.push({ data: [{ role: "admin" }], error: null });
    recoverFromAuthError.mockResolvedValue(true);

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(recoverFromAuthError).toHaveBeenCalledTimes(1);
    expect(result.current.roles).toEqual(["admin"]);
    expect(result.current.isStaff).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.sessionExpired).toBe(false);
  });

  it("marca sessionExpired quando a renovação falha — sem beco sem saída", async () => {
    selectResults.push({ data: null, error: JWT_EXPIRED });
    recoverFromAuthError.mockResolvedValue(false);

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sessionExpired).toBe(true);
    expect(result.current.error).not.toBeNull();
    // Nunca inferir um papel: rebaixar um admin a "customer" foi o bug original.
    expect(result.current.roles).toEqual([]);
  });

  it("não tenta renovar quando o erro NÃO é de sessão", async () => {
    selectResults.push({
      data: null,
      error: { message: "Failed to fetch", code: "", details: "", hint: "" },
    });

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(recoverFromAuthError).not.toHaveBeenCalled();
    // Erro de rede é recuperável por retry manual, então NÃO é sessão morta.
    expect(result.current.sessionExpired).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it("não cacheia o resultado de uma falha", async () => {
    selectResults.push({ data: null, error: JWT_EXPIRED });
    recoverFromAuthError.mockResolvedValue(false);

    const first = renderHook(() => useUserRole());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.error).not.toBeNull();

    // Próxima montagem precisa consultar o servidor de novo, não servir o erro.
    selectResults.push({ data: [{ role: "engineer" }], error: null });
    const second = renderHook(() => useUserRole());
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.roles).toEqual(["engineer"]);
    expect(second.result.current.error).toBeNull();
  });
});
