import { describe, it, expect } from "vitest";
import { isAssistantAllowed } from "@/lib/assistantAccess";

describe("isAssistantAllowed", () => {
  it("permite e-mails @bwild.com.br", () => {
    expect(isAssistantAllowed("lucas@bwild.com.br")).toBe(true);
    expect(isAssistantAllowed("Victorya@BWild.com.BR")).toBe(true);
    expect(isAssistantAllowed("  ana@bwild.com.br  ")).toBe(true);
  });

  it("bloqueia pseudo-e-mail de cliente (@cpf.bwild.com.br)", () => {
    expect(isAssistantAllowed("12345678900@cpf.bwild.com.br")).toBe(false);
  });

  it("bloqueia domínios externos e valores vazios", () => {
    expect(isAssistantAllowed("cliente@gmail.com")).toBe(false);
    expect(isAssistantAllowed("alguem@bwild.com.br.evil.com")).toBe(false);
    expect(isAssistantAllowed("")).toBe(false);
    expect(isAssistantAllowed(null)).toBe(false);
    expect(isAssistantAllowed(undefined)).toBe(false);
  });
});
