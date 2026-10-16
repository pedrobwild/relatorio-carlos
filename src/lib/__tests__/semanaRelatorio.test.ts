import { describe, it, expect } from "vitest";
import { buildWeekReportDraft } from "../semanaRelatorio";

const MON = "2026-10-05";
const a = (activity_id: string, work_date: string, outcome: "feito" | "nao_feito" | null = null) => ({
  activity_id,
  work_date,
  outcome,
});
const activities = [
  { id: "a1", title: "Passar conduíte", stage_name: "Elétrica", stage_sort_order: 2, sort_order: 1, status: "concluida" as const },
  { id: "a2", title: "Montar quadro", stage_name: "Elétrica", stage_sort_order: 2, sort_order: 2, status: "em_execucao" as const },
  { id: "a3", title: "Demolir parede", stage_name: "Demolição", stage_sort_order: 1, sort_order: 1, status: "aprovada" as const },
  { id: "a4", title: "Massa corrida", stage_name: "Pintura", stage_sort_order: 3, sort_order: 1, status: "planejada" as const },
  { id: "a5", title: "Limpeza", stage_name: null, stage_sort_order: null, sort_order: 1, status: "planejada" as const },
];
const stage = (description: string, sort_order: number, planned_start: string, planned_end: string, actual_end: string | null = null) => ({
  description,
  sort_order,
  planned_start,
  planned_end,
  actual_end,
});

describe("buildWeekReportDraft", () => {
  it("o que foi feito: só atividade com dia Feito, por etapa na ordem do cronograma", () => {
    const d = buildWeekReportDraft({
      monday: MON,
      assignments: [
        a("a2", "2026-10-06", "feito"),
        a("a1", "2026-10-05", "feito"),
        a("a1", "2026-10-06", "feito"),
        a("a3", "2026-10-05", "feito"),
        a("a4", "2026-10-07", "nao_feito"),
        a("a4", "2026-10-12", "feito"), // semana seguinte: não entra
      ],
      nextAssignments: [],
      activities,
      stages: [],
    });
    expect(d.done).toEqual([
      { stage: "Demolição", items: ["Demolir parede (concluída)"] },
      { stage: "Elétrica", items: ["Passar conduíte (concluída)", "Montar quadro"] },
    ]);
  });

  it("próxima semana: o que já está marcado, sem etapa vira 'Outros serviços' no fim", () => {
    const d = buildWeekReportDraft({
      monday: MON,
      assignments: [],
      nextAssignments: [a("a5", "2026-10-13"), a("a4", "2026-10-14"), a("a4", "2026-10-15")],
      activities,
      stages: [stage("Pintura", 3, "2026-10-01", "2026-10-30")],
    });
    expect(d.next).toEqual([
      { stage: "Pintura", items: ["Massa corrida"] },
      { stage: "Outros serviços", items: ["Limpeza"] },
    ]);
    expect(d.nextFromSchedule).toBe(false);
  });

  it("sem nada marcado na semana seguinte, usa as etapas previstas e não concluídas", () => {
    const d = buildWeekReportDraft({
      monday: MON,
      assignments: [],
      nextAssignments: [],
      activities,
      stages: [
        stage("Pintura", 3, "2026-10-14", "2026-10-30"),
        stage("Elétrica", 2, "2026-09-20", "2026-10-12"),
        stage("Demolição", 1, "2026-09-01", "2026-10-20", "2026-10-02"), // já terminou
        stage("Marcenaria", 4, "2026-10-19", "2026-11-10"), // começa depois
      ],
    });
    expect(d.next).toEqual([
      { stage: "Elétrica", items: [] },
      { stage: "Pintura", items: [] },
    ]);
    expect(d.nextFromSchedule).toBe(true);
  });

  it("texto para colar, com frases de vazio", () => {
    const d = buildWeekReportDraft({ monday: MON, assignments: [], nextAssignments: [], activities, stages: [] });
    expect(d.text).toBe(
      [
        "Resumo da semana de 05/10 a 09/10",
        "",
        "O que foi feito",
        "• Nenhum serviço registrado como feito nesta semana.",
        "",
        "Próxima semana (12/10 a 16/10)",
        "• Ainda sem serviços marcados.",
      ].join("\n"),
    );
  });

  it("texto com etapas e itens", () => {
    const d = buildWeekReportDraft({
      monday: MON,
      assignments: [a("a1", "2026-10-05", "feito"), a("a2", "2026-10-06", "feito")],
      nextAssignments: [],
      activities,
      stages: [stage("Pintura", 3, "2026-10-12", "2026-10-30")],
    });
    expect(d.text).toContain("• Elétrica: Passar conduíte (concluída); Montar quadro");
    expect(d.text).toContain("Próxima semana (12/10 a 16/10)\n• Pintura");
  });
});
