import { describe, expect, it } from "vitest";
import { planAnalysis } from "../analysisPlanner";

describe("planAnalysis", () => {
  it("classifies executive intent", () => {
    const plan = planAnalysis("O que eu preciso priorizar hoje?");
    expect(plan.intent).toBe("executive");
    expect(plan.complexity).toBe("advanced");
    expect(plan.needsClarification).toBe(false);
  });

  it("classifies aggregation intent", () => {
    const plan = planAnalysis("Qual o total recebido este mês?");
    expect(plan.intent).toBe("aggregation");
    expect(plan.domain).toBe("financeiro");
    expect(plan.dateRangeSql).toContain("date_trunc('month'");
  });

  it("classifies comparison intent", () => {
    const plan = planAnalysis("Compare o mês atual com o mês passado");
    expect(plan.intent).toBe("comparison");
    expect(plan.expectedInsightTypes).toContain("comparative");
  });

  it("classifies forecast intent", () => {
    const plan = planAnalysis("Qual a previsão de pagamentos para os próximos 30 dias?");
    expect(plan.intent).toBe("forecast");
    expect(plan.dateRangeSql).toContain("30 days");
  });

  it("classifies data quality intent", () => {
    const plan = planAnalysis("Quais dados estão inconsistentes ou incompletos?");
    expect(plan.intent).toBe("data_quality");
    expect(plan.expectedInsightTypes).toContain("quality");
  });

  it("falls back to lookup for short questions", () => {
    const plan = planAnalysis("ajuda?");
    expect(plan.needsClarification).toBe(true);
  });

  it("does not require clarification for executive questions", () => {
    const plan = planAnalysis("Resumo executivo");
    expect(plan.needsClarification).toBe(false);
  });
});
