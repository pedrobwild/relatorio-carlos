import { describe, expect, it } from "vitest";
import { deadlineHealth, parseDecimal, validateContractTerms } from "../contractDeadline";

const d = (remaining: number | null, total = 60, deadline: string | null = "2026-06-01") => ({
  current_deadline: deadline,
  business_days_remaining: remaining,
  current_business_days: total,
});

describe("deadlineHealth", () => {
  it("sem prazo quando não há entrega calculada", () => {
    expect(deadlineHealth(null)).toBe("sem_prazo");
    expect(deadlineHealth(d(10, 60, null))).toBe("sem_prazo");
    expect(deadlineHealth(d(null))).toBe("sem_prazo");
  });
  it("atrasada com restante negativo", () => {
    expect(deadlineHealth(d(-1))).toBe("atrasada");
  });
  it("atenção com folga ≤ max(5, 10% do prazo)", () => {
    expect(deadlineHealth(d(6, 60))).toBe("atencao"); // 10% de 60 = 6
    expect(deadlineHealth(d(7, 60))).toBe("no_prazo");
    expect(deadlineHealth(d(5, 30))).toBe("atencao"); // mínimo 5
    expect(deadlineHealth(d(15, 150))).toBe("atencao");
    expect(deadlineHealth(d(0, 60))).toBe("atencao"); // último dia
  });
});

describe("parseDecimal", () => {
  it("aceita vírgula e ponto", () => {
    expect(parseDecimal("0,5")).toBe(0.5);
    expect(parseDecimal("0.5")).toBe(0.5);
    expect(parseDecimal("1.234,5")).toBe(1234.5);
    expect(parseDecimal(" 10 ")).toBe(10);
  });
  it("vazio ou inválido vira null", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });
});

describe("validateContractTerms", () => {
  const ok = { contract_business_days: 60, contract_start_date: "2026-03-02", penalty_pct_per_day: 0.5, penalty_cap_pct: 10 };
  it("aceita termos válidos e termos vazios", () => {
    expect(validateContractTerms(ok)).toBeNull();
    expect(validateContractTerms({ contract_business_days: null, contract_start_date: null, penalty_pct_per_day: null, penalty_cap_pct: null })).toBeNull();
  });
  it("rejeita dias inválidos ou sem data de gatilho", () => {
    expect(validateContractTerms({ ...ok, contract_business_days: 0 })).toMatch(/maior que zero/);
    expect(validateContractTerms({ ...ok, contract_business_days: 1.5 })).toMatch(/inteiro/);
    expect(validateContractTerms({ ...ok, contract_start_date: null })).toMatch(/gatilho/);
  });
  it("rejeita multa negativa e teto fora de 0–100", () => {
    expect(validateContractTerms({ ...ok, penalty_pct_per_day: -1 })).toMatch(/negativa/);
    expect(validateContractTerms({ ...ok, penalty_cap_pct: 120 })).toMatch(/teto/);
  });
});
