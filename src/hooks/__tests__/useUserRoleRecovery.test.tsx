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

const selectResults: Array<{
  data: unknown;
  error: unknown;
  status?: number;
}> = [];
let selectCalls = 0;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => {
          const next = selectResults[selectCalls] ?? {
            data: [],
            error: null,
            status: 200,
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


/**
 * Regressão apontada pela auditoria multi-agente.
 *
 * O postgrest-js entrega o corpo cru do PostgREST como `error`
 * (`error = JSON.parse(body)`) e devolve o `status` como campo IRMÃO. Um
 * `throw error` simples descartava o status — e as guardas `status === 401` /
 * `status === 503` de authRecovery viravam código morto para toda leitura
 * via `.from()`.
 *
 * Pior: os primeiros testes que escrevi usavam `{ status: 401, ... }` dentro
 * do objeto de erro — uma forma que o PostgREST NUNCA produz. Passavam sem
 * exercitar o caminho real. Estes usam a forma verdadeira.
 */
describe("useUserRole — status HTTP preservado (forma real do postgrest-js)", () => {
  it("401 sem `code` e sem a palavra jwt ainda é tratado como sessão", async () => {
    // Corpo real de um 401 de gateway: nem PGRST301, nem 'jwt'.
    selectResults.push({
      data: null,
      error: { message: "Invalid API key", details: "", hint: "", code: "" },
      status: 401,
    });
    selectResults.push({ data: [{ role: "admin" }], error: null, status: 200 });
    recoverFromAuthError.mockResolvedValue(true);

    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Antes: escapava da classificação e travava na tela de permissões.
    expect(recoverFromAuthError).toHaveBeenCalledTimes(1);
    expect(result.current.roles).toEqual(["admin"]);
  });

  it("503 sem `code` é tratado como backend indisponível", async () => {
    // A resposta 503 sintética do service worker chega exatamente assim:
    // corpo não-JSON vira `{ message: <corpo> }`, sem code.
    selectResults.push({
      data: null,
      error: { message: '{"error":"offline"}', details: "", hint: "", code: "" },
      status: 503,
    });
    selectResults.push({ data: [{ role: "admin" }], error: null, status: 200 });

    const { result } = renderHook(() => useUserRole());
    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 15000,
    });

    expect(recoverFromAuthError).not.toHaveBeenCalled();
    expect(result.current.roles).toEqual(["admin"]);
  }, 20000);

  it("lista vazia NUNCA é cacheada — 200 com [] pode ser token anônimo", async () => {
    // A policy é `user_id = auth.uid()`. Sem sessão, o supabase-js manda a
    // chave anônima: auth.uid() é NULL e a leitura devolve 200 com [] SEM
    // erro. Cachear isso gravava "usuário sem papel" para sempre.
    selectResults.push({ data: [], error: null, status: 200 });

    const first = renderHook(() => useUserRole());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.roles).toEqual([]);

    // A montagem seguinte precisa CONSULTAR o servidor de novo.
    selectResults.push({ data: [{ role: "admin" }], error: null, status: 200 });
    const second = renderHook(() => useUserRole());
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.roles).toEqual(["admin"]);
  });
});
