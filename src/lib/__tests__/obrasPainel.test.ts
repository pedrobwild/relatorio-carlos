import { describe, it, expect } from "vitest";
import {
  addBusinessDaysISO,
  businessDaysAfter,
  businessDiff,
  buildObraRow,
  projectEnd,
  projectedPenalty,
  slackLabel,
  sortByRisk,
  summarize,
  type BuildRowInput,
  type ObraRow,
} from "../obrasPainel";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";
import type { PortfolioStage } from "@/infra/repositories/obrasPanel.repository";

// Quarta, 14/10/2026. Segunda 12/10 é feriado (N. Sra. Aparecida).
const TODAY = "2026-10-14";
const WEEK = { from: "2026-10-12", to: "2026-10-17" };

function deadline(p: Partial<ProjectDeadline> = {}): ProjectDeadline {
  return {
    project_id: "p1",
    project_name: "Apto 142",
    status: "active",
    is_project_phase: false,
    current_deadline: "2026-11-27",
    business_days_remaining: 30,
    current_business_days: 60,
    pct_prazo_consumido: 50,
    penalty_pct_per_day: 0.5,
    penalty_cap_pct: 10,
    contract_value: 100_000,
    ...p,
  } as ProjectDeadline;
}

function stage(p: Partial<PortfolioStage>): PortfolioStage {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    project_id: "p1",
    description: "Etapa",
    sort_order: 1,
    planned_start: "2026-10-01",
    planned_end: "2026-10-30",
    actual_start: null,
    actual_end: null,
    ...p,
  } as PortfolioStage;
}

function row(p: Partial<BuildRowInput> = {}): ObraRow {
  return buildObraRow({
    deadline: deadline(),
    progress: 50,
    stages: [],
    activities: [],
    materials: [],
    weekAssignments: [],
    week: WEEK,
    today: TODAY,
    ...p,
  });
}

describe("dias úteis em ISO", () => {
  it("pula fim de semana e feriado", () => {
    // sex 09/10 → ter 13/10 : seg 12 é feriado, sáb/dom não contam
    expect(businessDaysAfter("2026-10-09", "2026-10-13")).toBe(1);
    expect(addBusinessDaysISO("2026-10-09", 1)).toBe("2026-10-13");
    expect(businessDiff("2026-10-13", "2026-10-09")).toBe(-1);
    expect(businessDaysAfter("2026-10-14", "2026-10-14")).toBe(0);
  });
});

describe("projectEnd", () => {
  it("sem cronograma devolve null", () => {
    expect(projectEnd([], TODAY)).toBeNull();
  });

  it("etapa em aberto atrasada empurra o fim pelo mesmo tanto", () => {
    const p = projectEnd(
      [
        stage({ description: "Elétrica", planned_end: "2026-10-09" }), // sex; hoje qua → 2 du (ter, qua)
        stage({ description: "Pintura", planned_end: "2026-11-20" }),
      ],
      TODAY,
    )!;
    expect(p.lateStage).toEqual({ name: "Elétrica", days: 2 });
    expect(p.scheduleEnd).toBe("2026-11-20");
    // 20/11 é feriado; +2 du = seg 23 e ter 24
    expect(p.projectedEnd).toBe("2026-11-24");
    expect(p.finished).toBe(false);
  });

  it("etapa concluída não atrasa", () => {
    const p = projectEnd([stage({ planned_end: "2026-10-02", actual_end: "2026-10-08" })], TODAY)!;
    expect(p.lateStage).toBeNull();
    expect(p.projectedEnd).toBe("2026-10-08");
    expect(p.finished).toBe(true);
  });
});

describe("projectedPenalty", () => {
  it("multa = atraso × % × valor, com teto", () => {
    expect(projectedPenalty(-4, deadline())).toBe(2000); // 4 × 0,5% × 100k
    expect(projectedPenalty(-40, deadline())).toBe(10_000); // teto 10%
    expect(projectedPenalty(3, deadline())).toBe(0);
    expect(projectedPenalty(-4, deadline({ penalty_pct_per_day: null }))).toBeNull();
    expect(projectedPenalty(null, deadline())).toBeNull();
  });
});

describe("buildObraRow", () => {
  it("verde com folga ≥ 3", () => {
    const r = row({ stages: [stage({ planned_end: "2026-11-20" })] });
    expect(r.slack).toBeGreaterThanOrEqual(3);
    expect(r.risk).toBe("verde");
    expect(r.alerts).toEqual([]);
  });

  it("vermelho e multa quando o término projetado passa da entrega", () => {
    const r = row({
      deadline: deadline({ current_deadline: "2026-11-19" }),
      stages: [
        stage({ description: "Elétrica", planned_end: "2026-10-09" }),
        stage({ description: "Pintura", planned_end: "2026-11-19" }),
      ],
    });
    // projetado = 19/11 + 2 du = 23/11 (20 é feriado) e 24/11 → folga −2
    expect(r.projectedEnd).toBe("2026-11-24");
    expect(r.slack).toBe(-2);
    expect(r.risk).toBe("vermelho");
    expect(r.penalty).toBe(1000);
    expect(r.alerts.map((a) => a.kind)).toEqual(["multa", "etapa_atrasada"]);
  });

  it("amarelo com folga 0–2", () => {
    const r = row({
      deadline: deadline({ current_deadline: "2026-11-24" }),
      stages: [stage({ planned_end: "2026-11-23" })],
    });
    expect(r.slack).toBe(1);
    expect(r.risk).toBe("amarelo");
  });

  it("amarelo quando o prazo consumido passa o avanço em mais de 5 p.p.", () => {
    const r = row({
      deadline: deadline({ pct_prazo_consumido: 68 }),
      progress: 55,
      stages: [stage({ planned_end: "2026-11-13" })],
    });
    expect(r.risk).toBe("amarelo");
    expect(r.alerts.find((a) => a.kind === "consumo")?.text).toBe("68% do prazo com 55% de avanço");
  });

  it("vermelho com atividade crítica não feita", () => {
    const r = row({
      stages: [stage({ planned_end: "2026-11-13" })],
      activities: [
        { id: "a1", project_id: "p1", stage_id: null, title: "Impermeabilizar box", status: "em_execucao", is_critical: true, late_finish: null, assignments_not_done: 1 },
      ],
    });
    expect(r.risk).toBe("vermelho");
    expect(r.alerts[0].text).toBe("Crítica não feita: Impermeabilizar box");
  });

  it("material faltando com limite em até 10 dias úteis acende amarelo", () => {
    const s = stage({ id: "s1", planned_end: "2026-11-13" });
    const r = row({
      stages: [s],
      activities: [
        { id: "a1", project_id: "p1", stage_id: "s1", title: "Quadro", status: "planejada", is_critical: false, late_finish: null, assignments_not_done: 0 },
      ],
      materials: [
        { id: "m1", project_id: "p1", activity_id: "a1", description: "Disjuntores", needed_by: "2026-10-16", status: "pendente" },
        { id: "m2", project_id: "p1", activity_id: "a1", description: "Longe", needed_by: "2026-12-20", status: "pendente" },
      ],
    });
    expect(r.risk).toBe("amarelo");
    expect(r.alerts.find((a) => a.kind === "material")?.text).toBe("Falta material: Disjuntores (sex)");
  });

  it("sem prazo cadastrado fica cinza e avisa", () => {
    const r = row({ deadline: deadline({ current_deadline: null, business_days_remaining: null }) });
    expect(r.risk).toBe("sem_prazo");
    expect(r.slack).toBeNull();
    expect(r.alerts.map((a) => a.kind)).toEqual(["sem_prazo"]);
  });

  it("semana: etapas que caem nela, dias marcados e 'não planejada'", () => {
    const stages = [
      stage({ description: "Elétrica", planned_start: "2026-10-05", planned_end: "2026-10-14" }),
      stage({ description: "Gesso", planned_start: "2026-10-13", planned_end: "2026-10-21" }),
      stage({ description: "Pintura", planned_start: "2026-11-01", planned_end: "2026-11-20" }),
    ];
    const vazia = row({ stages });
    expect(vazia.week.stages).toEqual(["Elétrica", "Gesso"]);
    expect(vazia.week.unplanned).toBe(true);

    const marcada = row({
      stages,
      weekAssignments: [
        { id: "x1", project_id: "p1", activity_id: "a", work_date: "2026-10-13", outcome: "feito" },
        { id: "x2", project_id: "p1", activity_id: "a", work_date: "2026-10-14", outcome: "nao_feito" },
        { id: "x3", project_id: "p1", activity_id: "a", work_date: "2026-10-15", outcome: null },
      ],
    });
    expect(marcada.week).toMatchObject({ planned: 3, done: 1, notDone: 1, unplanned: false });
  });
});

describe("ordem e resumo", () => {
  it("vermelho → amarelo → verde → sem prazo; menor folga primeiro", () => {
    const mk = (name: string, risk: ObraRow["risk"], slack: number | null): ObraRow =>
      ({ ...row(), id: name, name, risk, slack }) as ObraRow;
    const out = sortByRisk([
      mk("verde", "verde", 8),
      mk("semprazo", "sem_prazo", null),
      mk("verm-1", "vermelho", -1),
      mk("amar", "amarelo", 2),
      mk("verm-5", "vermelho", -5),
    ]);
    expect(out.map((r) => r.name)).toEqual(["verm-5", "verm-1", "amar", "verde", "semprazo"]);
  });

  it("resume ativas, no vermelho e multa projetada total", () => {
    const a = { ...row(), risk: "vermelho", slack: -2, penalty: 1000 } as ObraRow;
    const b = { ...row(), risk: "vermelho", slack: -1, penalty: null } as ObraRow;
    const c = { ...row(), risk: "verde", slack: 5, penalty: 0 } as ObraRow;
    expect(summarize([a, b, c])).toMatchObject({ active: 3, red: 2, penaltyTotal: 1000, penaltyUnknown: 1 });
  });

  it("folga em texto", () => {
    expect(slackLabel(6)).toBe("+6 dias");
    expect(slackLabel(-4)).toBe("−4 dias");
    expect(slackLabel(1)).toBe("+1 dia");
    expect(slackLabel(0)).toBe("0 dia");
    expect(slackLabel(null)).toBe("—");
  });
});
