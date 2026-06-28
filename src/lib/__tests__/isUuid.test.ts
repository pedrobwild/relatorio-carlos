import { describe, it, expect } from "vitest";
import { isUuid } from "@/lib/utils";

describe("isUuid", () => {
  it("aceita UUIDs válidos (qualquer caixa)", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("rejeita segmentos estáticos de rota capturados por :ticketId", () => {
    // Cenário do bug: /gestao/cs/:ticketId capturando rotas estáticas.
    expect(isUuid("operacional")).toBe(false);
    expect(isUuid("analytics")).toBe(false);
  });

  it("rejeita strings malformadas e valores não-string", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid("123e4567-e89b-12d3-a456")).toBe(false); // curto demais
    expect(isUuid("123e4567e89b12d3a456426614174000")).toBe(false); // sem hífens
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000 ")).toBe(false); // espaço extra
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});
