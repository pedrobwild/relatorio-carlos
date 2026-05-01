import { describe, expect, it } from "vitest";
import { parseDateRange } from "../dateRangeParser";

describe("parseDateRange", () => {
  it("recognizes 'hoje'", () => {
    const r = parseDateRange("quais compras venceram hoje?");
    expect(r.granularity).toBe("day");
    expect(r.sqlFragment).toBe("= CURRENT_DATE");
  });

  it("recognizes 'próximos N dias'", () => {
    const r = parseDateRange("o que vence nos próximos 7 dias?");
    expect(r.granularity).toBe("custom");
    expect(r.sqlFragment).toContain("INTERVAL '7 days'");
  });

  it("recognizes 'esta semana'", () => {
    const r = parseDateRange("atividades desta semana");
    expect(r.granularity).toBe("week");
    expect(r.sqlFragment).toContain("date_trunc('week'");
  });

  it("recognizes 'mês passado'", () => {
    const r = parseDateRange("quanto recebemos no mês passado?");
    expect(r.granularity).toBe("month");
    expect(r.sqlFragment).toContain("date_trunc('month'");
  });

  it("recognizes 'este ano'", () => {
    const r = parseDateRange("total do ano atual");
    expect(r.granularity).toBe("year");
  });

  it("returns 'none' when no temporal phrase is found", () => {
    const r = parseDateRange("Quais NCs críticas estão abertas?");
    expect(r.granularity).toBe("none");
    expect(r.sqlFragment).toBeUndefined();
  });
});
