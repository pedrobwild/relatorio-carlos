import { describe, expect, it } from "vitest";
import { buildAnalysis } from "../insightEngine";

describe("buildAnalysis", () => {
  it("builds a complete analysis result", () => {
    const rows = [
      { project_name: "Obra A", amount: 5000, due_date: "2000-01-01" },
      { project_name: "Obra B", amount: 1500, due_date: "2099-01-01" },
      { project_name: "Obra C", amount: 8000, due_date: "2000-05-05" },
    ];
    const r = buildAnalysis({
      question: "total a pagar",
      rows,
      rowsReturned: rows.length,
      sql: "SELECT 1",
      domain: "financeiro",
      status: "success",
    });
    expect(r.insights.length).toBeGreaterThan(0);
    expect(r.executive_summary).toContain("financeiro");
    expect(r.suggested_questions?.length).toBeGreaterThan(0);
    expect(typeof r.confidence).toBe("number");
    expect(r.visualizations?.length).toBeGreaterThan(0);
  });

  it("handles an empty result gracefully", () => {
    const r = buildAnalysis({
      question: "qualquer",
      rows: [],
      rowsReturned: 0,
      sql: "SELECT 1",
      domain: "compras",
      status: "success",
    });
    expect(r.insights[0].id).toBe("empty");
    expect(r.limitations?.some((l) => l.includes("Nenhum registro"))).toBe(
      true,
    );
  });

  it("includes data quality warnings when applicable", () => {
    const rows = [{ amount: -50 }, { amount: 100 }];
    const r = buildAnalysis({
      question: "x",
      rows,
      rowsReturned: 2,
      sql: "SELECT 1",
      domain: "financeiro",
      status: "success",
    });
    expect(r.data_quality?.length).toBeGreaterThan(0);
  });

  it("preserves existing answer when provided", () => {
    const r = buildAnalysis({
      question: "x",
      rows: [{ amount: 100 }],
      rowsReturned: 1,
      sql: "SELECT 1",
      domain: "financeiro",
      status: "success",
      answer: "Resposta original",
    });
    expect(r.answer).toBe("Resposta original");
  });
});
