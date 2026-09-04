/**
 * Regressão de 04/09/2026.
 *
 * Uma usuária viu "Estamos com instabilidade no servidor" e, ao recarregar,
 * ficou presa no esqueleto do ProtectedRoute. Banco, sessão, conta e RLS
 * estavam sãos — a requisição dela simplesmente não completava.
 *
 * Dois defeitos ficaram evidentes:
 *  1. O app afirmava que o SERVIDOR estava fora do ar em casos onde a
 *     requisição nem chegou a sair do aparelho. É uma alegação que o cliente
 *     não tem como provar, e manda o time caçar uma queda que não existiu.
 *  2. O casamento numérico de "502|503|504" rodava sobre `details`/`hint` do
 *     PostgREST, que carregam DADO DE LINHA — qualquer valor delimitado ali
 *     viraria um falso "servidor caiu".
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  isBackendUnavailableError,
  isConnectionFailure,
  SW_OFFLINE_CODE,
} from "@/lib/authRecovery";

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

const onLineOriginal = Object.getOwnPropertyDescriptor(
  window.navigator,
  "onLine",
);

function forcarOnLine(valor: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value: valor,
    configurable: true,
  });
}

afterEach(() => {
  if (onLineOriginal) {
    Object.defineProperty(window.navigator, "onLine", onLineOriginal);
  }
});

describe("indisponibilidade do servidor x falha de conexão", () => {
  it("um 5xx REAL do servidor continua sendo indisponibilidade", () => {
    forcarOnLine(true);
    for (const status of [502, 503, 504]) {
      expect(isBackendUnavailableError(erroPostgrest({ message: "x" }, status)))
        .toBe(true);
    }
    expect(
      isBackendUnavailableError(
        erroPostgrest({ message: "no connection", code: "PGRST003" }, 503),
      ),
    ).toBe(true);
  });

  it("o 503 fabricado pelo service worker NÃO é o servidor caindo", () => {
    forcarOnLine(true);
    // public/sw-cache.js devolve isto quando a rede não respondeu no aparelho.
    const doSW = erroPostgrest(
      {
        message: "Sem conexão com o servidor. Dados não disponíveis offline.",
        code: SW_OFFLINE_CODE,
      },
      503,
    );
    // Antes: 503 => "o sistema está fora do ar", o que era falso.
    expect(isBackendUnavailableError(doSW)).toBe(false);
    expect(isConnectionFailure(doSW)).toBe(true);
  });

  it("estar offline é falha de conexão, não queda do servidor", () => {
    forcarOnLine(false);
    const erro = new TypeError("Failed to fetch");
    expect(isConnectionFailure(erro)).toBe(true);
    expect(isBackendUnavailableError(erro)).toBe(false);
  });

  it("uma resposta HTTP recebida nunca é falha de conexão", () => {
    forcarOnLine(true);
    // Houve resposta: o problema é do outro lado, não do alcance.
    expect(isConnectionFailure(erroPostgrest({ message: "x" }, 503))).toBe(
      false,
    );
    expect(
      isConnectionFailure(
        erroPostgrest({ message: "schema cache", code: "PGRST002" }, 503),
      ),
    ).toBe(false);
  });

  it("timeout do cliente vira indisponibilidade, e não sessão morta", () => {
    forcarOnLine(true);
    // É o erro que useUserRole lança quando a leitura pendura (withDeadline).
    const timeout = Object.assign(
      new Error("Tempo esgotado ao falar com o servidor"),
      { name: "TimeoutError", status: 504 },
    );
    expect(isBackendUnavailableError(timeout)).toBe(true);
  });
});

describe("falso positivo do casamento numérico", () => {
  it("um '503' dentro de `details` NÃO significa servidor fora do ar", () => {
    forcarOnLine(true);
    // `details` do PostgREST carrega dado de linha. Aqui o 503 é parte de um
    // valor do banco — e \b503\b casaria, porque hífen não é caractere de palavra.
    const erro = erroPostgrest(
      {
        message: "duplicate key value violates unique constraint",
        code: "23505",
        details: "Key (codigo)=(OBRA-503-A) already exists.",
      },
      409,
    );
    expect(isBackendUnavailableError(erro)).toBe(false);
  });

  it("ainda detecta corpo de gateway sem status estruturado", () => {
    forcarOnLine(true);
    // CDN devolvendo HTML/texto que o postgrest não consegue tipar: aqui o
    // número solto é a única evidência disponível, e deve valer.
    const erro = erroPostgrest({ message: "503 Service Temporarily Unavailable" });
    expect(isBackendUnavailableError(erro)).toBe(true);
  });
});
