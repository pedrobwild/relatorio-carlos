import { describe, expect, it } from "vitest";
import {
  recommendVisualizations,
  profileColumns,
} from "../visualizationRecommender";

describe("profileColumns", () => {
  it("identifies numeric and date columns", () => {
    const profile = profileColumns([
      { project_name: "A", amount: 100, due_date: "2026-01-01" },
      { project_name: "B", amount: 200, due_date: "2026-02-01" },
    ]);
    const amount = profile.find((p) => p.name === "amount");
    const date = profile.find((p) => p.name === "due_date");
    const name = profile.find((p) => p.name === "project_name");
    expect(amount?.type).toBe("number");
    expect(date?.type).toBe("date");
    expect(name?.type).toBe("text");
  });
});

describe("recommendVisualizations", () => {
  it("returns table when input is empty", () => {
    expect(recommendVisualizations({ rows: [] })).toEqual([]);
  });

  it("returns KPI for a single row with a numeric column", () => {
    const out = recommendVisualizations({ rows: [{ total: 1234 }] });
    expect(out[0]?.type).toBe("kpi");
  });

  it("recommends bar chart for grouped data", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      obra: `Obra ${i}`,
      valor: i * 100,
    }));
    const out = recommendVisualizations({ rows });
    expect(out.some((v) => v.type === "bar")).toBe(true);
  });

  it("recommends line chart for time series", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      due_date: `2026-0${i + 1}-01`,
      amount: i * 50,
    }));
    const out = recommendVisualizations({ rows });
    expect(out.some((v) => v.type === "line")).toBe(true);
  });
});
