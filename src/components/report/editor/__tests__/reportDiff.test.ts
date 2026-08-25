import { describe, it, expect } from "vitest";
import { diffWeeklyReportData } from "../reportDiff";
import type { WeeklyReportData } from "@/types/weeklyReport";

const base = {
  weekNumber: 1,
  periodStart: "2026-01-05",
  periodEnd: "2026-01-11",
  executiveSummary: "Semana ok",
  lookaheadTasks: [],
  risksAndIssues: [],
  clientDecisions: [],
  incidents: [],
  gallery: [],
} as unknown as WeeklyReportData;

describe("diffWeeklyReportData", () => {
  it("não acusa divergência para dados iguais", () => {
    expect(diffWeeklyReportData(base, { ...base }).hasDivergence).toBe(false);
  });

  it("ignora query string de URL assinada nas fotos", () => {
    const local = {
      ...base,
      gallery: [{ id: "p1", url: "https://x/f.jpg?token=a", caption: "", area: "", date: "", category: "progresso" }],
    } as unknown as WeeklyReportData;
    const server = {
      ...base,
      gallery: [{ id: "p1", url: "https://x/f.jpg?token=b", caption: "", area: "", date: "", category: "progresso" }],
    } as unknown as WeeklyReportData;
    expect(diffWeeklyReportData(local, server).hasDivergence).toBe(false);
  });

  it("aponta as seções divergentes", () => {
    const server = { ...base, executiveSummary: "Outro texto" };
    const result = diffWeeklyReportData(base, server);
    expect(result.hasDivergence).toBe(true);
    expect(result.sections).toContain("Resumo executivo");
  });
});
