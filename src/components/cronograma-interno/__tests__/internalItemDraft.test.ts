/** Validação da gaveta do Cronograma interno antes de gravar. */
import { describe, it, expect } from "vitest";
import { draftFrom, normalizeDraft } from "../internalItemDraft";

const base = draftFrom(null, { description: "Elétrica", planned_start: "2026-11-02", planned_end: "2026-11-06" });

describe("normalizeDraft", () => {
  it("apara textos, vazio vira null e peso aceita vírgula", () => {
    const res = normalizeDraft({ ...base, description: "  Elétrica ", etapa: " ", notes: " ok ", weight: "12,5" });
    expect(res).toEqual({
      values: expect.objectContaining({ description: "Elétrica", etapa: null, notes: "ok", weight: 12.5 }),
    });
  });

  it("recusa descrição vazia, datas invertidas e peso fora de 0–100", () => {
    expect(normalizeDraft({ ...base, description: "  " })).toEqual({ error: "Informe a descrição." });
    expect(normalizeDraft({ ...base, planned_end: "2026-11-01" })).toEqual({
      error: "O fim previsto não pode ser antes do início previsto.",
    });
    expect(normalizeDraft({ ...base, weight: "120" })).toEqual({ error: "O peso vai de 0 a 100." });
    expect(normalizeDraft({ ...base, weight: "abc" })).toEqual({ error: "O peso vai de 0 a 100." });
  });
});
