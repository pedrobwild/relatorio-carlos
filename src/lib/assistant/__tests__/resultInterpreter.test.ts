import { describe, expect, it } from "vitest";
import {
  generateInsights,
  metricsFromRow,
  buildExecutiveSummary,
  fmtBRL,
  fmtDateBR,
  fmtNumber,
  suggestFollowUps,
} from "../resultInterpreter";

describe("formatters", () => {
  it("formats BRL", () => {
    // Intl.NumberFormat uses a non-breaking space; use regex to be tolerant.
    expect(fmtBRL(1234.56)).toMatch(/^R\$\s1\.234,56$/);
    expect(fmtBRL("invalid")).toMatch(/^R\$\s0,00$/);
  });

  it("formats numbers in pt-BR", () => {
    expect(fmtNumber(1500)).toBe("1.500");
  });

  it("formats dates as DD/MM/AAAA", () => {
    expect(fmtDateBR("2026-04-30")).toMatch(/30\/04\/2026/);
    expect(fmtDateBR(null)).toBe("—");
  });
});

describe("generateInsights", () => {
  it("returns an empty insight when no rows", () => {
    const insights = generateInsights({
      rows: [],
      question: "x",
      domain: "financeiro",
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe("empty");
  });

  it("emits descriptive count and sum for monetary list", () => {
    const rows = [
      { project_name: "A", amount: 1500 },
      { project_name: "B", amount: 3000 },
      { project_name: "C", amount: 750 },
      { project_name: "D", amount: 100 },
      { project_name: "E", amount: 5000 },
    ];
    const insights = generateInsights({
      rows,
      question: "total a pagar",
      domain: "financeiro",
    });
    expect(insights.find((i) => i.id === "count")).toBeDefined();
    expect(insights.find((i) => i.id === "sum")).toBeDefined();
    expect(insights.find((i) => i.id === "topn")).toBeDefined();
  });

  it("flags overdue items based on due_date", () => {
    const rows = [
      { project_name: "A", amount: 100, due_date: "2000-01-01" },
      { project_name: "B", amount: 100, due_date: "2099-01-01" },
    ];
    const insights = generateInsights({
      rows,
      question: "pagamentos",
      domain: "financeiro",
    });
    expect(insights.find((i) => i.id === "overdue")).toBeDefined();
  });
});

describe("metricsFromRow", () => {
  it("extracts metrics from a single aggregated row", () => {
    const m = metricsFromRow([{ total_received: 12500, count: 35 }]);
    expect(m).toHaveLength(2);
    expect(m[0].label).toBe("total_received");
  });

  it("returns empty for list result", () => {
    expect(metricsFromRow([{ a: 1 }, { a: 2 }])).toEqual([]);
  });
});

describe("buildExecutiveSummary", () => {
  it("notes empty results", () => {
    const out = buildExecutiveSummary({
      question: "x",
      rows: [],
      insights: [],
      domain: "ncs",
    });
    expect(out).toContain("Nenhum registro");
  });

  it("composes a markdown summary with bullets", () => {
    const out = buildExecutiveSummary({
      question: "x",
      rows: [{ a: 1 }],
      insights: [
        {
          id: "i1",
          type: "descriptive",
          domain: "financeiro",
          title: "Crítico",
          summary: "Algo importante",
          evidence: [],
          severity: "high",
          confidence: 0.9,
        },
      ],
      domain: "financeiro",
    });
    expect(out).toContain("- **Crítico**");
  });
});

describe("suggestFollowUps", () => {
  it("returns domain-specific follow-ups", () => {
    expect(suggestFollowUps("financeiro").length).toBeGreaterThan(0);
    expect(suggestFollowUps("ncs").join(" ")).toMatch(/NC/);
  });
});
