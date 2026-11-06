import { afterEach, describe, expect, it } from "vitest";
import {
  isRecoveryCallback,
  redirectRecoveryLinkToResetPage,
} from "@/lib/passwordRecoveryRedirect";
import { describeUpdatePasswordError } from "@/lib/passwordErrors";

describe("isRecoveryCallback", () => {
  it("reconhece o hash do link de recuperação", () => {
    expect(
      isRecoveryCallback("#access_token=x&refresh_token=y&type=recovery", ""),
    ).toBe(true);
  });

  it("reconhece link expirado/já usado", () => {
    expect(
      isRecoveryCallback(
        "#error=access_denied&error_code=otp_expired&error_description=x",
        "",
      ),
    ).toBe(true);
  });

  it("ignora login comum e URLs sem tokens", () => {
    expect(isRecoveryCallback("#access_token=x&type=signup", "")).toBe(false);
    expect(isRecoveryCallback("", "?foo=bar")).toBe(false);
  });
});

describe("redirectRecoveryLinkToResetPage", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("leva o link que caiu na raiz para /redefinir-senha mantendo o hash", () => {
    window.history.replaceState(
      null,
      "",
      "/#access_token=x&refresh_token=y&type=recovery",
    );
    redirectRecoveryLinkToResetPage();
    expect(window.location.pathname).toBe("/redefinir-senha");
    expect(window.location.hash).toContain("type=recovery");
  });

  it("não mexe em outras rotas sem retorno de recuperação", () => {
    window.history.replaceState(null, "", "/minhas-obras");
    redirectRecoveryLinkToResetPage();
    expect(window.location.pathname).toBe("/minhas-obras");
  });
});

describe("describeUpdatePasswordError", () => {
  it("explica senha igual à atual", () => {
    expect(describeUpdatePasswordError({ code: "same_password" })).toMatch(
      /diferente/,
    );
  });

  it("explica senha fraca", () => {
    expect(
      describeUpdatePasswordError({
        code: "weak_password",
        reasons: ["characters"],
      }),
    ).toMatch(/maiúsculas/);
  });

  it("explica sessão de recuperação ausente", () => {
    expect(
      describeUpdatePasswordError({ name: "AuthSessionMissingError" }),
    ).toMatch(/expirou/);
  });
});
