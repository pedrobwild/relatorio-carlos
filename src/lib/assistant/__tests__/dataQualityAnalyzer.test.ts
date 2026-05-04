import { describe, expect, it } from "vitest";
import { analyzeDataQuality } from "../dataQualityAnalyzer";

describe("analyzeDataQuality", () => {
  it("returns empty for empty input", () => {
    expect(analyzeDataQuality([])).toEqual([]);
  });

  it("flags negative monetary amounts", () => {
    const w = analyzeDataQuality([{ amount: -150 }, { amount: 200 }]);
    expect(
      w.find((x) => x.issue === "negative_value" && x.field === "amount")
        ?.count,
    ).toBe(1);
  });

  it("flags purchases without supplier", () => {
    const w = analyzeDataQuality([
      { supplier_name: null, fornecedor_id: null, item_name: "x" },
      { supplier_name: "Acme", fornecedor_id: "abc" },
    ]);
    expect(w.find((x) => x.issue === "missing_supplier")?.count).toBe(1);
  });

  it("flags missing responsible", () => {
    const w = analyzeDataQuality([
      { responsible_user_id: null },
      { responsible_user_id: "u1" },
      { responsible_user_id: "" },
    ]);
    expect(w.find((x) => x.issue === "missing_relation")?.count).toBe(2);
  });

  it("flags missing planned_end", () => {
    const w = analyzeDataQuality([
      { planned_end: null },
      { planned_end: "2026-01-01" },
    ]);
    expect(w.find((x) => x.issue === "missing_planning")?.count).toBe(1);
  });
});
