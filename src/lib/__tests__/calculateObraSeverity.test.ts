import { describe, it, expect } from "vitest";
import {
  calculateObraSeverity,
  severityLabel,
  severityTone,
} from "../calculateObraSeverity";

const base = {
  overdueDays: 0,
  variacaoPct: 0,
  pendingOverdue: 0,
  comprasCriticas: 0,
  hoursSinceUpdate: 0,
  ncsCriticas: 0,
};

describe("calculateObraSeverity", () => {
  it("obra saudável tem score baixo", () => {
    const r = calculateObraSeverity(base);
    expect(r.score).toBe(0);
    expect(r.level).toBe("saudavel");
    expect(r.triggeredCritical).toBe(false);
  });

  it("componentes respeitam os pesos máximos", () => {
    const r = calculateObraSeverity({
      overdueDays: 60,
      variacaoPct: 30,
      pendingOverdue: 30,
      comprasCriticas: 20,
      hoursSinceUpdate: 300,
      ncsCriticas: 0,
    });
    expect(r.components.prazo).toBe(35);
    expect(r.components.financeiro).toBe(30);
    expect(r.components.pendencias).toBe(15);
    expect(r.components.compras).toBe(10);
    expect(r.components.desatualizacao).toBe(10);
    expect(r.score).toBe(100);
    expect(r.level).toBe("critica");
  });

  it("atraso >15d força classificação crítica", () => {
    const r = calculateObraSeverity({ ...base, overdueDays: 16 });
    expect(r.level).toBe("critica");
    expect(r.triggeredCritical).toBe(true);
    expect(r.criticalReasons[0]).toMatch(/Atraso/);
  });

  it("variação de custo >10% força crítica", () => {
    const r = calculateObraSeverity({ ...base, variacaoPct: 11 });
    expect(r.level).toBe("critica");
    expect(r.triggeredCritical).toBe(true);
  });

  it("NC crítica aberta força crítica", () => {
    const r = calculateObraSeverity({ ...base, ncsCriticas: 1 });
    expect(r.level).toBe("critica");
    expect(r.triggeredCritical).toBe(true);
  });

  it(">120h sem atualização força crítica", () => {
    const r = calculateObraSeverity({ ...base, hoursSinceUpdate: 121 });
    expect(r.level).toBe("critica");
    expect(r.triggeredCritical).toBe(true);
  });

  it("score entre 30 e 59 é atenção", () => {
    // 10d atraso  → 10/30 * 35 = 11.7 prazo
    // 8% variação →  8/15 * 30 = 16.0 financeiro  (≤10%, não dispara gatilho)
    // 5 pendências→  5/10 * 15 =  7.5 pendências
    // total = 35.2 → 'atencao'
    //
    // O caso antes passava variacaoPct: 5 (= 10.0 financeiro), somando 29.2 e
    // caindo em 'saudavel' por 1 ponto — contradizendo o próprio comentário do
    // teste, que já dizia "8% variação ~ 16 financeiro". Os valores agora
    // batem com a intenção descrita.
    const r = calculateObraSeverity({
      ...base,
      overdueDays: 10,
      variacaoPct: 8,
      pendingOverdue: 5,
    });
    expect(r.level).toBe("atencao");
    expect(r.score).toBeGreaterThanOrEqual(30);
    expect(r.score).toBeLessThan(60);
  });

  it("variação negativa (economia) não contribui para o score", () => {
    const r = calculateObraSeverity({ ...base, variacaoPct: -20 });
    expect(r.components.financeiro).toBe(0);
    expect(r.level).toBe("saudavel");
  });

  it("variacaoPct null não quebra o cálculo", () => {
    const r = calculateObraSeverity({ ...base, variacaoPct: null });
    expect(r.components.financeiro).toBe(0);
  });

  it("severityLabel e severityTone traduzem os níveis", () => {
    expect(severityLabel("critica")).toBe("Crítica");
    expect(severityLabel("atencao")).toBe("Atenção");
    expect(severityLabel("saudavel")).toBe("Saudável");
    expect(severityTone("critica")).toBe("destructive");
    expect(severityTone("atencao")).toBe("warning");
    expect(severityTone("saudavel")).toBe("success");
  });
});
