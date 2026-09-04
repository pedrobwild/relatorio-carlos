/**
 * Regressão do incidente de 31/08: o autosave do cronograma retentava a cada
 * ~1,2s um erro que NUNCA ia passar.
 *
 * A RPC replace_project_activities devolvia
 *   P0001: Sem permissão para editar o cronograma desta obra
 * e o cliente tratava isso como instabilidade: retentava para sempre, repetia
 * o toast (que no desktop fica em top-right, em cima do botão Salvar) e nunca
 * mostrava o motivo real.
 *
 * Estes testes usam a forma VERDADEIRA do postgrest-js: o corpo cru do
 * PostgREST em `error` e o `status` como campo IRMÃO, anexado ao Error lançado.
 */

import { describe, it, expect } from "vitest";
import { isPermanentSaveError, describeSaveError } from "@/lib/saveErrors";

/** Reproduz o que useProjectActivities lança: corpo do PostgREST + status. */
function erroDaRpc(
  body: { message: string; code?: string; details?: string; hint?: string },
  status?: number,
) {
  return Object.assign(
    new Error(body.message),
    { details: "", hint: "", code: "", ...body },
    status == null ? {} : { status },
  );
}

describe("isPermanentSaveError", () => {
  it("trata RAISE EXCEPTION das nossas funções (P0001) como permanente", () => {
    const erro = erroDaRpc(
      {
        message: "Sem permissão para editar o cronograma desta obra",
        code: "P0001",
      },
      400,
    );
    expect(isPermanentSaveError(erro)).toBe(true);
  });

  it("trata violação de regra do banco como permanente", () => {
    for (const code of ["42501", "23503", "23505", "23514", "22P02"]) {
      expect(isPermanentSaveError(erroDaRpc({ message: "x", code }, 400))).toBe(
        true,
      );
    }
  });

  it("trata 400 sem code como permanente", () => {
    expect(
      isPermanentSaveError(erroDaRpc({ message: "Bad Request" }, 400)),
    ).toBe(true);
  });

  it("NÃO trata indisponibilidade de backend como permanente", () => {
    // Foi isso que derrubou o app em 29-30/08: pool esgotado e schema cache.
    const indisponivel = [
      erroDaRpc({ message: "could not query the database", code: "PGRST002" }, 503),
      erroDaRpc({ message: "timed out acquiring connection", code: "PGRST003" }, 503),
      erroDaRpc({ message: "Bad Gateway" }, 502),
      erroDaRpc({ message: "Gateway Timeout" }, 504),
    ];
    for (const erro of indisponivel) {
      expect(isPermanentSaveError(erro)).toBe(false);
    }
  });

  it("NÃO trata falha de rede como permanente", () => {
    expect(isPermanentSaveError(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("NÃO trata 401 como permanente — sessão expirada é recuperável", () => {
    const erro = erroDaRpc({ message: "JWT expired", code: "PGRST301" }, 401);
    expect(isPermanentSaveError(erro)).toBe(false);
  });
});

describe("describeSaveError", () => {
  it("repassa a mensagem em PT-BR do Postgres para o usuário", () => {
    const erro = erroDaRpc(
      {
        message: "Sem permissão para editar o cronograma desta obra",
        code: "P0001",
      },
      400,
    );
    const { message, permanent } = describeSaveError(erro);
    // O usuário precisa ler o motivo, não "tente novamente".
    expect(message).toBe("Sem permissão para editar o cronograma desta obra");
    expect(permanent).toBe(true);
  });

  it("explica instabilidade sem prometer que o usuário deve agir", () => {
    const erro = erroDaRpc({ message: '{"error":"offline"}' }, 503);
    const { message, permanent } = describeSaveError(erro);
    expect(permanent).toBe(false);
    expect(message).toMatch(/instável/i);
    // Não vaza corpo JSON cru na tela.
    expect(message).not.toContain("{");
  });

  it("nunca devolve mensagem vazia", () => {
    const { message } = describeSaveError({});
    expect(message.length).toBeGreaterThan(0);
  });
});

describe("conflito de versão do relatório (40001)", () => {
  it("é permanente mesmo chegando como HTTP 500 do PostgREST", () => {
    // O PostgREST mapeia a classe 40 para 500. Sem tratar o código, o
    // conflito passava por instabilidade e o autosave repetia o MESMO
    // carimbo em backoff — nunca ia passar.
    const erro = erroDaRpc(
      { message: "WEEKLY_REPORT_CONFLICT", code: "40001" },
      500,
    );
    expect(isPermanentSaveError(erro)).toBe(true);
    expect(describeSaveError(erro).permanent).toBe(true);
  });
});
