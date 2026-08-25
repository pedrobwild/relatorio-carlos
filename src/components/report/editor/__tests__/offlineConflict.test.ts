import { describe, it, expect } from "vitest";
import { resolveOfflineConflict } from "../offlineConflict";
import type { WeeklyReportData } from "@/types/weeklyReport";

const base = {
  weekNumber: 3,
  periodStart: "2026-08-17",
  periodEnd: "2026-08-23",
  executiveSummary: "Base",
  lookaheadTasks: [],
  risksAndIssues: [],
  clientDecisions: [],
  incidents: [],
  gallery: [],
} as unknown as WeeklyReportData;

const task = {
  id: "t1",
  date: "2026-08-20",
  description: "Pintura",
  prerequisites: "",
  responsible: "Ana",
  risk: "baixo",
};

describe("resolveOfflineConflict", () => {
  it("envia o local quando o servidor não mudou", () => {
    const local = { ...base, executiveSummary: "Editado offline" };
    const r = resolveOfflineConflict({ base, local, server: base });
    expect(r.kind).toBe("auto-local");
    expect(r.merged.executiveSummary).toBe("Editado offline");
  });

  it("adota o servidor quando não houve edição offline", () => {
    const server = { ...base, executiveSummary: "Do servidor" };
    const r = resolveOfflineConflict({ base, local: base, server });
    expect(r.kind).toBe("auto-server");
    expect(r.merged.executiveSummary).toBe("Do servidor");
  });

  it("junta automaticamente quando as seções são diferentes", () => {
    const local = { ...base, executiveSummary: "Texto local" };
    const server = {
      ...base,
      lookaheadTasks: [task],
    } as unknown as WeeklyReportData;
    const r = resolveOfflineConflict({ base, local, server });
    expect(r.kind).toBe("auto-merged");
    expect(r.merged.executiveSummary).toBe("Texto local");
    expect(r.merged.lookaheadTasks).toHaveLength(1);
  });

  it("pede decisão quando a mesma seção mudou dos dois lados", () => {
    const local = { ...base, executiveSummary: "Texto local" };
    const server = { ...base, executiveSummary: "Texto do servidor" };
    const r = resolveOfflineConflict({ base, local, server });
    expect(r.kind).toBe("conflict");
    expect(r.conflictingSections).toEqual(["Resumo executivo"]);
  });

  it("mantém seções só do servidor na sugestão de merge do conflito", () => {
    const local = { ...base, executiveSummary: "Texto local" };
    const server = {
      ...base,
      executiveSummary: "Texto do servidor",
      lookaheadTasks: [task],
    } as unknown as WeeklyReportData;
    const r = resolveOfflineConflict({ base, local, server });
    expect(r.kind).toBe("conflict");
    expect(r.merged.executiveSummary).toBe("Texto local");
    expect(r.merged.lookaheadTasks).toHaveLength(1);
  });
});
