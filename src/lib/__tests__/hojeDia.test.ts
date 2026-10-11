import { describe, expect, it } from "vitest";
import {
  canConfirmOn,
  countDay,
  dayLabel,
  doneAtLabel,
  groupByObra,
  longDayLabel,
  normalizeDateParam,
  progressPhrase,
  shiftISODate,
  whoLabel,
} from "../hojeDia";
import type { OpsDayAssignment } from "@/infra/repositories/ops.repository";

const NOW = new Date(2026, 9, 14, 10, 0); // quarta, 14/10/2026

function a(over: Partial<OpsDayAssignment> & { id: string }): OpsDayAssignment {
  return {
    activity_id: `act-${over.id}`,
    created_at: "2026-10-14T08:00:00Z",
    created_by: null,
    done_at: null,
    done_by: null,
    fornecedor_id: null,
    not_done_reason: null,
    notes: null,
    outcome: null,
    photo_paths: [],
    project_id: "p1",
    updated_at: "2026-10-14T08:00:00Z",
    user_id: null,
    work_date: "2026-10-14",
    worker_name: "João",
    activity: { id: `act-${over.id}`, title: "Atividade", status: "planejada", stage_id: "s1", project_id: "p1", is_critical: false, stage: { description: "Elétrica" } },
    project: { id: "p1", name: "Obra Moema" },
    fornecedor: null,
    ...over,
  };
}

describe("datas", () => {
  it("navega e rotula dias sem deslocamento de fuso", () => {
    expect(shiftISODate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftISODate("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayLabel("2026-10-14", NOW)).toBe("Hoje");
    expect(dayLabel("2026-10-13", NOW)).toBe("Ontem");
    expect(dayLabel("2026-10-15", NOW)).toBe("Amanhã");
    expect(dayLabel("2026-10-19", NOW)).toBe("segunda, 19/10");
    expect(longDayLabel("2026-10-14")).toBe("quarta, 14/10");
  });

  it("parâmetro de data inválido na URL volta para hoje", () => {
    expect(normalizeDateParam(null, NOW)).toBe("2026-10-14");
    expect(normalizeDateParam("2026-02-30", NOW)).toBe("2026-10-14");
    expect(normalizeDateParam("ontem", NOW)).toBe("2026-10-14");
    expect(normalizeDateParam("2026-10-09", NOW)).toBe("2026-10-09");
  });

  it("só confirma hoje ou dias passados", () => {
    expect(canConfirmOn("2026-10-14", NOW)).toBe(true);
    expect(canConfirmOn("2026-10-10", NOW)).toBe(true);
    expect(canConfirmOn("2026-10-15", NOW)).toBe(false);
  });
});

describe("quem faz", () => {
  const names = new Map([["u1", "Pedro"]]);
  it("junta usuário, nome livre e prestador", () => {
    expect(whoLabel({ user_id: "u1", worker_name: null, fornecedor: null }, names)).toBe("Pedro");
    expect(whoLabel({ user_id: null, worker_name: " João ", fornecedor: { nome: "Elétrica XP" } }, names)).toBe("João · Elétrica XP");
    expect(whoLabel({ user_id: "u9", worker_name: null, fornecedor: null }, names)).toBe("Equipe interna");
    expect(whoLabel({ user_id: null, worker_name: "  ", fornecedor: null }, names)).toBe("Sem responsável");
  });
});

describe("contagem e agrupamento", () => {
  const items = [
    a({ id: "1", outcome: "feito" }),
    a({ id: "2", outcome: "nao_feito", not_done_reason: "material" }),
    a({ id: "3" }),
    a({ id: "4", activity: { id: "act-4", title: "Crítica", status: "planejada", stage_id: "s1", project_id: "p1", is_critical: true, stage: { description: "Elétrica" } } }),
    a({ id: "5", project_id: "p2", project: { id: "p2", name: "Obra Alphaville" }, outcome: "feito" }),
  ];

  it("conta feito / não feito / pendente", () => {
    expect(countDay(items)).toEqual({ total: 5, done: 2, notDone: 1, pending: 2 });
  });

  it("ordem fixa: obra por nome; críticas primeiro; confirmar não muda a ordem", () => {
    const g = groupByObra(items);
    expect(g.map((x) => x.projectName)).toEqual(["Obra Alphaville", "Obra Moema"]);
    expect(g[1].items.map((x) => x.id)).toEqual(["4", "1", "2", "3"]);
    expect(g[1]).toMatchObject({ total: 4, done: 1, notDone: 1, pending: 2 });
    expect(g[0]).toMatchObject({ total: 1, pending: 0 });
    const after = groupByObra(items.map((i) => (i.id === "3" ? { ...i, outcome: "feito" as const } : i)));
    expect(after[1].items.map((x) => x.id)).toEqual(["4", "1", "2", "3"]);
  });

  it("frase de progresso", () => {
    expect(progressPhrase({ total: 0, done: 0, notDone: 0, pending: 0 })).toBe("Nada planejado");
    expect(progressPhrase({ total: 1, done: 1, notDone: 0, pending: 0 })).toBe("1 de 1 confirmado");
    expect(progressPhrase({ total: 5, done: 2, notDone: 1, pending: 2 })).toBe("3 de 5 confirmados · 1 não feito");
    expect(progressPhrase({ total: 5, done: 0, notDone: 2, pending: 3 })).toBe("2 de 5 confirmados · 2 não feitos");
  });

  it("hora do carimbo", () => {
    expect(doneAtLabel(new Date(2026, 9, 14, 14, 5).toISOString())).toBe("14:05");
    expect(doneAtLabel(null)).toBeNull();
    expect(doneAtLabel("lixo")).toBeNull();
  });
});
