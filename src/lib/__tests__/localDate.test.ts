import { describe, it, expect } from "vitest";
import { toLocalISODate } from "../localDate";

describe("toLocalISODate", () => {
  it("formata no fuso local (não em UTC)", () => {
    // 23:30 local de 10/03 — em UTC-3 o toISOString() daria 11/03.
    const d = new Date(2026, 2, 10, 23, 30, 0);
    expect(toLocalISODate(d)).toBe("2026-03-10");
  });

  it("preenche mês/dia com zero à esquerda", () => {
    expect(toLocalISODate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });
});
