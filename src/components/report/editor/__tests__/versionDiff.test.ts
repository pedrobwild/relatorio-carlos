import { describe, it, expect } from "vitest";
import { diffWords, diffReportVersions, stripHtml } from "../versionDiff";
import type { WeeklyReportData } from "@/types/weeklyReport";

const base = (overrides: Partial<WeeklyReportData> = {}) =>
  ({
    projectId: "p",
    projectName: "Obra",
    unitName: "",
    clientName: "",
    weekNumber: 1,
    periodStart: "",
    periodEnd: "",
    issuedAt: "",
    preparedBy: "",
    kpis: { physicalPlanned: 0, physicalActual: 0, scheduleVarianceDays: 0 },
    nextMilestones: [],
    executiveSummary: "",
    activities: [],
    deliverablesCompleted: [],
    lookaheadTasks: [],
    risksAndIssues: [],
    qualityItems: [],
    clientDecisions: [],
    incidents: [],
    gallery: [],
    ...overrides,
  }) as WeeklyReportData;

describe("stripHtml", () => {
  it("remove tags e normaliza quebras", () => {
    expect(stripHtml("<p>Olá <b>obra</b></p>")).toBe("Olá obra");
  });
});

describe("diffWords", () => {
  it("marca palavras adicionadas e removidas", () => {
    const tokens = diffWords("gesso pronto", "gesso quase pronto");
    expect(tokens.some((t) => t.type === "added" && t.value.includes("quase"))).toBe(true);
    expect(tokens.filter((t) => t.type === "removed")).toHaveLength(0);
  });

  it("não marca nada quando o texto é igual", () => {
    expect(diffWords("igual", "igual").every((t) => t.type === "equal")).toBe(true);
  });
});

describe("diffReportVersions", () => {
  it("detecta mudança no resumo executivo", () => {
    const diff = diffReportVersions(
      base({ executiveSummary: "<p>Semana boa</p>" }),
      base({ executiveSummary: "<p>Semana ótima</p>" }),
    );
    expect(diff.hasChanges).toBe(true);
    expect(diff.textSections[0].changed).toBe(true);
  });

  it("classifica fotos adicionadas, removidas e editadas", () => {
    const photo = (id: string, caption: string) => ({
      id,
      url: `https://x/${id}.jpg`,
      path: `${id}.jpg`,
      caption,
      area: "Sala",
      date: "2026-01-01",
      category: "progresso",
    });
    const diff = diffReportVersions(
      base({ gallery: [photo("a", "Antes"), photo("b", "Sai")] }),
      base({ gallery: [photo("a", "Depois"), photo("c", "Nova")] }),
    );
    expect(diff.photos.added.map((p) => p.id)).toEqual(["c"]);
    expect(diff.photos.removed.map((p) => p.id)).toEqual(["b"]);
    expect(diff.photos.changed[0].fields?.[0].label).toBe("Legenda");
  });

  it("não aponta mudanças entre versões idênticas", () => {
    const data = base({ executiveSummary: "<p>Igual</p>" });
    expect(diffReportVersions(data, data).hasChanges).toBe(false);
  });
});
