import { describe, expect, it } from "vitest";
import {
  buildAccessLinkMessage,
  buildFirstAccessUrl,
  describeAccessInviteError,
} from "@/infra/repositories/accessInvites.repository";

describe("buildFirstAccessUrl", () => {
  it("monta a URL de /primeiro-acesso com o token", () => {
    expect(buildFirstAccessUrl("abc123", "https://portal.example")).toBe(
      "https://portal.example/primeiro-acesso?t=abc123",
    );
  });
});

describe("describeAccessInviteError", () => {
  it.each([
    ["invite_expired", /expirou/],
    ["invite_used", /já foi usado/],
    ["invite_invalid", /inválido/],
    ["invite_weak_password", /8 e 72/],
    ["invite_user_blocked", /bloqueada/],
    ["invite_forbidden_staff", /administradores/],
    ["invite_forbidden", /permissão/],
  ])("traduz %s", (code, expected) => {
    expect(describeAccessInviteError({ message: code })).toMatch(expected);
  });

  it("tem mensagem padrão", () => {
    expect(describeAccessInviteError(null)).toMatch(/Tente novamente/);
  });
});

describe("buildAccessLinkMessage", () => {
  it("usa o primeiro nome, o link e o login", () => {
    const msg = buildAccessLinkMessage(
      { id: "1", email: "jose@ex.com", display_name: "José Luiz Tepedino" },
      "https://x/primeiro-acesso?t=1",
    );
    expect(msg).toContain("Olá, José!");
    expect(msg).toContain("https://x/primeiro-acesso?t=1");
    expect(msg).toContain("jose@ex.com");
  });
});
