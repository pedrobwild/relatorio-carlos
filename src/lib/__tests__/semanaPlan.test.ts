import { describe, expect, it } from "vitest";
import {
  buildWeekGrid,
  hasSaturday,
  isAfterLimit,
  limitFor,
  mondayOf,
  normalizeWeekParam,
  overlapDays,
  parseWho,
  planningMonday,
  proposeWeek,
  shortWho,
  weekCounts,
  weekDays,
  weekLabel,
  weekMaterialSummary,
  whoSuggestions,
} from "../semanaPlan";
import type { OpsActivityView, OpsAssignment, OpsMaterial, OpsStageOption } from "@/infra/repositories/ops.repository";

const NOW = new Date(2026, 9, 14, 10); // qua 14/10/2026
const MON = "2026-10-12";

const stage = (id: string, desc: string, start: string, end: string, sort = 1, actual_end: string | null = null): OpsStageOption => ({
  id, description: desc, sort_order: sort, planned_start: start, planned_end: end, actual_start: null, actual_end,
});

function act(over: Partial<OpsActivityView> & { id: string }): OpsActivityView {
  return {
    actual_cost: null, assignments_done: 0, assignments_not_done: 0, assignments_pending: 0, assignments_total: 0,
    blocked_reason: null, created_at: null, created_by: null, description: null, first_work_date: null, fornecedor_id: null,
    is_critical: false, is_ready: false, last_work_date: null, late_finish: null, materials_missing: 0, materials_on_site: 0,
    materials_total: 0, next_pending_date: null, planned_cost: null, planned_end: null, planned_start: null, project_id: "p1",
    responsible_user_id: null, rework_of_id: null, sort_order: 0, stage_id: "s1", stage_name: "Elétrica", stage_sort_order: 1,
    status: "planejada", title: `Atividade ${over.id}`, updated_at: null,
    ...over,
  };
}

function asg(over: Partial<OpsAssignment> & { id: string; activity_id: string; work_date: string }): OpsAssignment {
  return {
    created_at: "", created_by: null, done_at: null, done_by: null, fornecedor_id: null, not_done_reason: null, notes: null,
    outcome: null, photo_paths: [], project_id: "p1", updated_at: "", user_id: null, worker_name: "João",
    ...over,
  };
}

describe("semana e dias", () => {
  it("segunda-feira de qualquer dia, inclusive domingo", () => {
    expect(mondayOf("2026-10-14")).toBe(MON);
    expect(mondayOf("2026-10-18")).toBe(MON); // domingo
    expect(mondayOf("2026-10-12")).toBe(MON);
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
  });
  it("parâmetro da URL", () => {
    expect(normalizeWeekParam(null, NOW)).toBe(MON);
    expect(normalizeWeekParam("2026-10-16", NOW)).toBe(MON);
    expect(normalizeWeekParam("2026-13-01", NOW)).toBe(MON);
    expect(normalizeWeekParam("2026-10-21", NOW)).toBe("2026-10-19");
  });
  it("no fim de semana a semana atual já é a que vai começar", () => {
    expect(planningMonday(new Date(2026, 9, 16, 18))).toBe(MON); // sexta
    expect(planningMonday(new Date(2026, 9, 17, 9))).toBe("2026-10-19"); // sábado
    expect(planningMonday(new Date(2026, 9, 18, 9))).toBe("2026-10-19"); // domingo
    expect(normalizeWeekParam(null, new Date(2026, 9, 18, 9))).toBe("2026-10-19");
  });
  it("dias da semana com feriado e hoje", () => {
    const d = weekDays(MON, { now: NOW });
    expect(d.map((x) => x.label)).toEqual(["Seg 12", "Ter 13", "Qua 14", "Qui 15", "Sex 16"]);
    expect(d[0].holiday).toBe(true); // 12/10 Nossa Senhora Aparecida
    expect(d.filter((x) => x.holiday)).toHaveLength(1);
    expect(d[2].isToday).toBe(true);
    expect(weekDays(MON, { includeSaturday: true, now: NOW }).map((x) => x.label).at(-1)).toBe("Sáb 17");
    expect(weekLabel(MON)).toBe("12/10 a 16/10");
  });
  it("sábado só aparece se tiver algo marcado", () => {
    expect(hasSaturday([{ work_date: "2026-10-16" }], MON)).toBe(false);
    expect(hasSaturday([{ work_date: "2026-10-17" }], MON)).toBe(true);
  });
});

describe("quem faz", () => {
  const staff = [{ id: "u1", nome: "Pedro Alves" }];
  it("nome da equipe vira usuário; resto vira nome livre", () => {
    expect(parseWho(" pedro  alves ", staff)).toEqual({ user_id: "u1", worker_name: null });
    expect(parseWho("João eletricista", staff)).toEqual({ user_id: null, worker_name: "João eletricista" });
    expect(parseWho("   ", staff)).toBeNull();
  });
  it("nome curto e sugestões sem repetição", () => {
    const names = new Map([["u1", "Pedro Alves"]]);
    expect(shortWho({ user_id: "u1", worker_name: null, fornecedor_id: null }, names)).toBe("Pedro");
    expect(shortWho({ user_id: null, worker_name: "Equipe A", fornecedor_id: null }, names)).toBe("Equipe A");
    expect(shortWho({ user_id: null, worker_name: null, fornecedor_id: "f" }, names)).toBe("Prestador");
    expect(whoSuggestions(staff, [{ worker_name: "João" }, { worker_name: "João" }, { worker_name: null }])).toEqual(["João", "Pedro Alves"]);
  });
});

describe("grade", () => {
  const days = weekDays(MON, { now: NOW });
  const stages = [
    stage("s1", "Elétrica", "2026-10-05", "2026-10-14", 1),
    stage("s2", "Gesso", "2026-10-15", "2026-10-23", 2),
    stage("s3", "Pintura", "2026-11-02", "2026-11-13", 3),
    stage("s4", "Demolição", "2026-09-01", "2026-10-13", 0, "2026-10-01"),
  ];

  it("agrupa por etapa na ordem do cronograma e inclui etapa prevista sem atividade", () => {
    const acts = [act({ id: "a1", stage_id: "s1", title: "Conduíte" }), act({ id: "a2", stage_id: "s3", stage_name: "Pintura" })];
    const as = [asg({ id: "x1", activity_id: "a1", work_date: "2026-10-13" }), asg({ id: "x2", activity_id: "a1", work_date: "2026-10-15" })];
    const g = buildWeekGrid({ stages, activities: acts, assignments: as, days });
    expect(g.map((s) => s.stageName)).toEqual(["Elétrica", "Gesso"]); // Pintura fora da semana; Demolição já terminou
    expect(g[0].rows[0].cells["2026-10-13"]).toHaveLength(1);
    expect(g[0].rows[0].limit).toBe("2026-10-14");
    expect(isAfterLimit("2026-10-15", g[0].rows[0].limit)).toBe(true);
    expect(g[1].rows).toHaveLength(0);
    expect(g[1].plannedThisWeek).toBe(true);
  });

  it("atividade com dia marcado aparece mesmo se a etapa não está prevista", () => {
    const acts = [act({ id: "a2", stage_id: "s3" })];
    const g = buildWeekGrid({ stages, activities: acts, assignments: [asg({ id: "x", activity_id: "a2", work_date: "2026-10-16" })], days });
    expect(g.find((s) => s.stageName === "Pintura")?.rows).toHaveLength(1);
  });

  it("atividade aprovada sem dia na semana some; sem etapa vai para 'Sem etapa' no fim", () => {
    const acts = [act({ id: "a1", stage_id: "s1", status: "aprovada" }), act({ id: "a9", stage_id: null })];
    const g = buildWeekGrid({ stages, activities: acts, assignments: [asg({ id: "x", activity_id: "a9", work_date: "2026-10-14" })], days });
    expect(g.find((s) => s.stageName === "Elétrica")?.rows ?? []).toHaveLength(0);
    expect(g.at(-1)?.stageName).toBe("Sem etapa");
  });

  it("atividade aberta sem nenhum dia aparece mesmo com o período da etapa já passado (nova atividade, retrabalho)", () => {
    const late = stage("s5", "Hidráulica", "2026-09-21", "2026-10-02", 5); // etapa atrasada, ainda aberta
    const acts = [
      act({ id: "n1", stage_id: "s5", stage_name: "Hidráulica", title: "Trocar registro" }),
      act({ id: "n2", stage_id: "s5", stage_name: "Hidráulica", title: "Refazer: Teste de pressão", rework_of_id: "x" }),
      act({ id: "n3", stage_id: "s3", stage_name: "Pintura" }), // etapa só em novembro: ainda não
    ];
    const g = buildWeekGrid({ stages: [...stages, late], activities: acts, assignments: [], days });
    expect(g.find((s) => s.stageName === "Hidráulica")?.rows.map((r) => r.activity.id)).toEqual(["n2", "n1"]);
    expect(g.find((s) => s.stageName === "Pintura")).toBeUndefined();
  });

  it("concluída sem nenhum dia marcado continua na grade para poder ser aprovada", () => {
    const late = stage("s5", "Hidráulica", "2026-09-21", "2026-10-02", 5);
    const acts = [
      act({ id: "c1", stage_id: "s5", status: "concluida" }),
      act({ id: "c2", stage_id: "s5", status: "concluida", assignments_total: 2, last_work_date: "2026-10-02" }), // aparece na semana dela
    ];
    const g = buildWeekGrid({ stages: [...stages, late], activities: acts, assignments: [], days });
    expect(g.find((s) => s.stageName === "Hidráulica")?.rows.map((r) => r.activity.id)).toEqual(["c1"]);
  });

  it("data-limite própria vence a da etapa", () => {
    expect(limitFor({ late_finish: "2026-10-13" }, stages[0])).toBe("2026-10-13");
    expect(limitFor({ late_finish: null }, stages[0])).toBe("2026-10-14");
    expect(limitFor({ late_finish: null }, null)).toBeNull();
    expect(isAfterLimit("2026-10-20", null)).toBe(false);
  });
});

describe("resumos", () => {
  const days = weekDays(MON, { now: NOW });
  it("contagem da semana separa sem confirmação de futuro", () => {
    const c = weekCounts(
      [
        { work_date: "2026-10-13", outcome: "feito" },
        { work_date: "2026-10-13", outcome: null },
        { work_date: "2026-10-14", outcome: "nao_feito" },
        { work_date: "2026-10-15", outcome: null },
        { work_date: "2026-10-20", outcome: null },
      ],
      days,
      NOW,
    );
    expect(c).toEqual({ planned: 4, done: 1, notDone: 1, unconfirmed: 1 });
  });
  it("material só das atividades com dia na semana, faltando por data", () => {
    const m = (id: string, activity_id: string, status: OpsMaterial["status"], needed_by: string | null): OpsMaterial => ({
      id, activity_id, status, needed_by, description: `Mat ${id}`, created_at: "", created_by: null, project_id: "p1", purchase_id: null, quantity: null, unit: null, updated_at: "",
    });
    const s = weekMaterialSummary(
      [m("1", "a1", "na_obra", null), m("2", "a1", "pendente", "2026-10-15"), m("3", "a1", "comprado", "2026-10-13"), m("4", "zz", "pendente", null)],
      new Set(["a1"]),
    );
    expect(s.total).toBe(3);
    expect(s.onSite).toBe(1);
    expect(s.missing.map((x) => x.id)).toEqual(["3", "2"]);
  });
});

describe("planejar semana", () => {
  const NEXT = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]; // seg 19 sem; supõe feriado
  const stages = [
    stage("s1", "Elétrica", "2026-10-05", "2026-10-16", 1),
    stage("s2", "Gesso", "2026-10-19", "2026-10-30", 2),
    stage("s3", "Pintura", "2026-11-02", "2026-11-13", 3),
    stage("s4", "Hidráulica", "2026-10-21", "2026-10-22", 4),
  ];

  it("sobrou: dias não feitos da semana passada voltam no começo da semana, com o mesmo time", () => {
    const acts = [act({ id: "a1", stage_id: "s1", status: "em_execucao", assignments_total: 3 })];
    const prev = [
      asg({ id: "1", activity_id: "a1", work_date: "2026-10-13", outcome: "feito" }),
      asg({ id: "2", activity_id: "a1", work_date: "2026-10-14", outcome: "nao_feito", not_done_reason: "material" }),
      asg({ id: "3", activity_id: "a1", work_date: "2026-10-15", outcome: null, worker_name: "Equipe B" }),
    ];
    const p = proposeWeek({ stages, activities: acts, previous: prev, current: [], workingDays: NEXT });
    const s = p.find((x) => x.activityId === "a1");
    expect(s?.kind).toBe("sobrou");
    expect(s?.days).toEqual(["2026-10-20", "2026-10-21"]);
    expect(s?.who).toEqual({ user_id: null, worker_name: "Equipe B" });
  });

  it("em execução sem sobra continua; já marcada na semana não é sugerida de novo", () => {
    const acts = [
      act({ id: "a1", stage_id: "s1", status: "em_execucao", assignments_total: 2 }),
      act({ id: "a2", stage_id: "s1", status: "em_execucao", assignments_total: 2 }),
    ];
    const prev = [
      asg({ id: "1", activity_id: "a1", work_date: "2026-10-13", outcome: "feito" }),
      asg({ id: "2", activity_id: "a2", work_date: "2026-10-13", outcome: "feito" }),
    ];
    const cur = [asg({ id: "9", activity_id: "a2", work_date: "2026-10-20" })];
    const p = proposeWeek({ stages, activities: acts, previous: prev, current: cur, workingDays: NEXT });
    expect(p.map((x) => [x.activityId, x.kind])).toContainEqual(["a1", "continua"]);
    expect(p.some((x) => x.activityId === "a2")).toBe(false);
  });

  it("sem dia: usa as datas da atividade/etapa; atrasada cai no primeiro dia; futuro não entra", () => {
    const acts = [
      act({ id: "a3", stage_id: "s2", stage_name: "Gesso" }), // etapa 19–30 → todos os dias úteis
      act({ id: "a4", stage_id: "s1", planned_start: "2026-10-01", planned_end: "2026-10-09", responsible_user_id: "u1" }), // atrasada
      act({ id: "a5", stage_id: "s3" }), // só em novembro
      act({ id: "a6", stage_id: "s1", status: "bloqueada", blocked_reason: "cliente_decisao" }),
    ];
    const p = proposeWeek({ stages, activities: acts, previous: [], current: [], workingDays: NEXT });
    expect(p.find((x) => x.activityId === "a3")?.days).toEqual(NEXT);
    expect(p.find((x) => x.activityId === "a4")).toMatchObject({ kind: "sem_dia", days: ["2026-10-20"], who: { user_id: "u1", worker_name: null } });
    expect(p.some((x) => x.activityId === "a5")).toBe(false);
    expect(p.some((x) => x.activityId === "a6")).toBe(false);
  });

  it("sobra de semanas anteriores não some quando a semana passada ficou sem planejar", () => {
    const acts = [
      // "Não feito" em 29/09; a semana de 05/10 não foi planejada.
      act({ id: "a7", stage_id: "s1", assignments_total: 1, assignments_not_done: 1, last_work_date: "2026-09-29", responsible_user_id: "u1" }),
      // Em execução, tudo feito lá atrás, ainda aberta.
      act({ id: "a8", stage_id: "s1", status: "em_execucao", assignments_total: 2, assignments_done: 2, last_work_date: "2026-09-30" }),
      // Já tem dia marcado mais adiante: não sugere.
      act({ id: "a9", stage_id: "s2", assignments_total: 1, assignments_pending: 1, last_work_date: "2026-10-28" }),
    ];
    const p = proposeWeek({ stages, activities: acts, previous: [], current: [], workingDays: NEXT });
    // Voltam como lembrete, desmarcadas: a pessoa escolhe retomar.
    expect(p.find((x) => x.activityId === "a7")).toMatchObject({ kind: "sobrou", days: ["2026-10-20"], who: { user_id: "u1", worker_name: null }, preselect: false });
    expect(p.find((x) => x.activityId === "a8")).toMatchObject({ kind: "continua", days: ["2026-10-20"], preselect: false });
    expect(p.some((x) => x.activityId === "a9")).toBe(false);
  });

  it("cronograma: etapa prevista na semana sem nenhuma atividade vira sugestão com os dias de sobreposição", () => {
    const acts = [act({ id: "a1", stage_id: "s1", status: "aprovada" }), act({ id: "a3", stage_id: "s2", assignments_total: 1 })];
    const p = proposeWeek({ stages, activities: acts, previous: [], current: [], workingDays: NEXT });
    const c = p.filter((x) => x.kind === "cronograma");
    expect(c.map((x) => x.stageName)).toEqual(["Hidráulica"]);
    expect(c[0]).toMatchObject({ activityId: null, title: "Hidráulica", days: ["2026-10-21", "2026-10-22"], who: null });
  });

  it("ordem: sobrou → em execução → sem dia → cronograma", () => {
    const acts = [
      act({ id: "a1", stage_id: "s2", status: "em_execucao", assignments_total: 1 }),
      act({ id: "a2", stage_id: "s1", assignments_total: 1 }),
      act({ id: "a3", stage_id: "s2" }),
    ];
    const prev = [
      asg({ id: "1", activity_id: "a1", work_date: "2026-10-13", outcome: "feito" }),
      asg({ id: "2", activity_id: "a2", work_date: "2026-10-13", outcome: "nao_feito", not_done_reason: "equipe" }),
    ];
    const p = proposeWeek({ stages, activities: acts, previous: prev, current: [], workingDays: NEXT });
    expect(p.map((x) => x.kind)).toEqual(["sobrou", "continua", "sem_dia", "cronograma"]);
  });

  it("sem dias úteis não sugere nada", () => {
    expect(proposeWeek({ stages, activities: [], previous: [], current: [], workingDays: [] })).toEqual([]);
    expect(overlapDays(null, "2026-10-20", NEXT)).toEqual([]);
  });
});
