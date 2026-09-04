/**
 * Regressão de 04/09/2026.
 *
 * O retry global de mutações casava "timeout" em qualquer texto — inclusive
 * em "canceling statement due to lock timeout", que é o Postgres RESPONDENDO
 * (55P03). Cada gravação recusada virava até 4 chamadas ao banco: um
 * multiplicador em cima do laço de autosave que esgotou o pool do PostgREST.
 *
 * Regra: erro com SQLSTATE veio do servidor; só classes de infraestrutura
 * (conexão, recursos, shutdown, erro interno) merecem nova tentativa.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      refreshSession: vi.fn(),
    },
  },
}));

import { queryClient } from "@/lib/queryClient";

type Retry = (failureCount: number, error: unknown) => boolean;

const retryMutation = queryClient.getDefaultOptions().mutations
  ?.retry as Retry;
const retryQuery = queryClient.getDefaultOptions().queries?.retry as Retry;

/** Forma real do postgrest-js: corpo cru + `status` como campo irmão. */
function erroPostgrest(
  body: { message: string; code?: string; details?: string; hint?: string },
  status?: number,
) {
  return Object.assign(
    new Error(body.message),
    { details: "", hint: "", code: "", ...body },
    status == null ? {} : { status },
  );
}

describe("retry global x erros do Postgres", () => {
  it("lock timeout (55P03) NÃO é retentado — o banco respondeu", () => {
    const erro = erroPostgrest(
      {
        message: "canceling statement due to lock timeout",
        code: "55P03",
      },
      500,
    );
    expect(retryMutation(0, erro)).toBe(false);
    expect(retryQuery(0, erro)).toBe(false);
  });

  it("statement timeout (57014) NÃO é retentado", () => {
    const erro = erroPostgrest(
      {
        message: "canceling statement due to statement timeout",
        code: "57014",
      },
      500,
    );
    expect(retryMutation(0, erro)).toBe(false);
  });

  it("conflito de versão (40001) e violação de regra NÃO são retentados", () => {
    expect(
      retryMutation(
        0,
        erroPostgrest({ message: "WEEKLY_REPORT_CONFLICT", code: "40001" }, 500),
      ),
    ).toBe(false);
    expect(
      retryMutation(
        0,
        erroPostgrest(
          { message: "duplicate key value violates unique constraint timeout_x", code: "23505" },
          409,
        ),
      ),
    ).toBe(false);
  });

  it("classes de infraestrutura do Postgres continuam retentáveis", () => {
    // 53300 too_many_connections — mensagem casa com padrão de rede? Não
    // precisa: a classe 53 é transitória por definição, mas o retry ainda
    // depende do texto (comportamento anterior preservado).
    const conexao = erroPostgrest(
      { message: "connection timeout expired", code: "08006" },
      503,
    );
    expect(retryMutation(0, conexao)).toBe(true);
  });

  it("falha de rede de verdade continua retentável, até 3 vezes", () => {
    const rede = new TypeError("Failed to fetch");
    expect(retryMutation(0, rede)).toBe(true);
    expect(retryMutation(2, rede)).toBe(true);
    expect(retryMutation(3, rede)).toBe(false);
  });
});
