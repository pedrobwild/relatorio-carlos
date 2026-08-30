import { describe, it, expect } from "vitest";
import { describeError, isExpiredSessionError } from "@/lib/authRecovery";

/**
 * Regressão do bug que deixava o app numa "sessão zumbi".
 *
 * Os erros do Supabase chegam como objetos simples — e o `base.repository`
 * ainda os clona com `Object.assign({}, error, ...)`, o que os tira de
 * `instanceof Error`. O código antigo usava `String(error)` para procurar
 * "jwt expired" e recebia sempre `"[object Object]"`. Com isso a detecção de
 * sessão expirada nunca disparava: o usuário continuava "logado", todo request
 * respondia 401 e a tela só dizia "verifique sua conexão".
 */
describe("describeError", () => {
  it("lê a mensagem de um PostgrestError simples (não é instanceof Error)", () => {
    const supabaseError = {
      message: "JWT expired",
      details: "",
      hint: "",
      code: "PGRST301",
    };

    // A armadilha original:
    expect(String(supabaseError)).toBe("[object Object]");

    const { text, code } = describeError(supabaseError);
    expect(text).toContain("JWT expired");
    expect(code).toBe("PGRST301");
  });

  it("preserva o clone feito pelo base.repository", () => {
    const original = {
      message: "JWT expired",
      details: "",
      hint: "",
      code: "PGRST301",
    };
    const cloned = Object.assign({}, original, { userError: { kind: "auth" } });

    expect(cloned instanceof Error).toBe(false);
    expect(describeError(cloned).text).toContain("JWT expired");
  });

  it("lê status HTTP quando presente", () => {
    expect(describeError({ status: 401, message: "Unauthorized" }).status).toBe(
      401,
    );
  });

  it("lida com Error, string, null e undefined", () => {
    expect(describeError(new Error("boom")).text).toContain("boom");
    expect(describeError("texto solto").text).toBe("texto solto");
    expect(describeError(null).text).toBe("");
    expect(describeError(undefined).text).toBe("");
  });
});

describe("isExpiredSessionError", () => {
  it.each([
    ["JWT expired do PostgREST", { message: "JWT expired", code: "PGRST301" }],
    ["401 explícito", { status: 401, message: "Unauthorized" }],
    ["invalid JWT", { message: "invalid JWT: unable to parse" }],
    ["refresh token sumiu", { message: "Refresh Token Not Found" }],
    ["sem api key", { message: "No API key found in request" }],
  ])("detecta %s", (_label, error) => {
    expect(isExpiredSessionError(error)).toBe(true);
  });

  it("NÃO trata erro de permissão (RLS/403) como sessão expirada", () => {
    // Aqui a sessão é válida — deslogar o usuário seria o comportamento errado.
    expect(
      isExpiredSessionError({
        message: "new row violates row-level security policy",
        code: "42501",
      }),
    ).toBe(false);
    expect(isExpiredSessionError({ status: 403, message: "Forbidden" })).toBe(
      false,
    );
  });

  it("NÃO trata erro de rede como sessão expirada", () => {
    expect(isExpiredSessionError({ message: "Failed to fetch" })).toBe(false);
  });

  it("ignora erro vazio", () => {
    expect(isExpiredSessionError(null)).toBe(false);
    expect(isExpiredSessionError({})).toBe(false);
  });
});
