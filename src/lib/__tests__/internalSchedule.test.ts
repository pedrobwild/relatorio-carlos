/**
 * Regras puras do Cronograma interno: árvore, agrupamento por etapa,
 * comparação com o cliente, resumo de entrega e reordenação.
 */
import { describe, it, expect } from "vitest";
import {
  buildTree,
  daysBetween,
  daysLabel,
  compareWithClient,
  countClientDifferences,
  deliverySummary,
  groupByEtapa,
  moveWithinSiblings,
  nextSortOrder,
  rangeLabel,
  validateItemDates,
  type ScheduleItemLike,
} from "../internalSchedule";
import { buildObraRow } from "../obrasPainel";

const item = (p: Partial<ScheduleItemLike> & { id: string }): ScheduleItemLike => ({
  parent_id: null,
  client_activity_id: null,
  etapa: null,
  description: p.id,
  planned_start: "2026-11-02",
  planned_end: "2026-11-06",
  sort_order: 0,
  ...p,
});

describe("buildTree", () => {
  it("põe as micro-etapas embaixo do item, cada nível na ordem do cronograma", () => {
    const tree = buildTree([
      item({ id: "b", sort_order: 2 }),
      item({ id: "a", sort_order: 1 }),
      item({ id: "a2", parent_id: "a", sort_order: 5 }),
      item({ id: "a1", parent_id: "a", sort_order: 3 }),
    ]);
    expect(tree.map((n) => n.item.id)).toEqual(["a", "b"]);
    expect(tree[0].children.map((c) => c.id)).toEqual(["a1", "a2"]);
  });

  it("micro-etapa sem o pai na lista sobe para o primeiro nível (nunca some)", () => {
    const tree = buildTree([item({ id: "x", parent_id: "sumiu" })]);
    expect(tree.map((n) => n.item.id)).toEqual(["x"]);
  });
});

describe("groupByEtapa", () => {
  it("agrupa na ordem em que a etapa aparece no cronograma", () => {
    const groups = groupByEtapa(
      buildTree([
        item({ id: "1", etapa: "Demolição", sort_order: 1 }),
        item({ id: "2", etapa: "Elétrica", sort_order: 2 }),
        item({ id: "3", etapa: "Demolição", sort_order: 3 }),
        item({ id: "4", etapa: null, sort_order: 4 }),
      ]),
    );
    expect(groups.map((g) => g.etapa)).toEqual(["Demolição", "Elétrica", null]);
    expect(groups[0].nodes.map((n) => n.item.id)).toEqual(["1", "3"]);
  });

  it("sem nenhuma etapa: um grupo só (lista simples)", () => {
    const groups = groupByEtapa(buildTree([item({ id: "1", etapa: "  " }), item({ id: "2" })]));
    expect(groups).toHaveLength(1);
    expect(groups[0].etapa).toBeNull();
  });
});

describe("compareWithClient", () => {
  const client = new Map([["c1", { id: "c1", planned_start: "2026-11-03", planned_end: "2026-11-14" }]]);

  it("sem vínculo (ou vínculo apagado) é 'Só interno'", () => {
    expect(compareWithClient(item({ id: "i" }), client).kind).toBe("so_interno");
    expect(compareWithClient(item({ id: "i", client_activity_id: "apagada" }), client).kind).toBe("so_interno");
  });

  it("mesmas datas: igual; datas diferentes: mostra as do cliente", () => {
    expect(
      compareWithClient(
        item({ id: "i", client_activity_id: "c1", planned_start: "2026-11-03", planned_end: "2026-11-14" }),
        client,
      ).kind,
    ).toBe("igual");
    const diff = compareWithClient(item({ id: "i", client_activity_id: "c1", planned_end: "2026-11-20" }), client);
    expect(diff).toMatchObject({ kind: "diferente", label: "Cliente: 03/11–14/11" });
  });
});

describe("deliverySummary", () => {
  it("interno depois do cliente = risco, em dias corridos", () => {
    const s = deliverySummary([{ planned_end: "2026-11-17" }, { planned_end: "2026-11-02" }], [{ planned_end: "2026-11-13" }]);
    expect(s).toEqual({ internalEnd: "2026-11-17", clientEnd: "2026-11-13", status: "risco", days: 4 });
  });

  it("entrega do cliente no sábado: a folga nunca vira '0 dia'", () => {
    // 14/11/2026 é sábado; interno termina na sexta, 13/11.
    expect(deliverySummary([{ planned_end: "2026-11-13" }], [{ planned_end: "2026-11-14" }])).toMatchObject({
      status: "folga",
      days: 1,
    });
  });

  it("daysBetween atravessa a troca de horário sem perder um dia", () => {
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-02-20", "2026-02-23")).toBe(3);
  });

  it("interno antes do cliente = folga; mesmo dia = igual", () => {
    expect(deliverySummary([{ planned_end: "2026-11-12" }], [{ planned_end: "2026-11-13" }])).toMatchObject({
      status: "folga",
      days: 1,
    });
    expect(deliverySummary([{ planned_end: "2026-11-13" }], [{ planned_end: "2026-11-13" }]).status).toBe("igual");
  });

  it("sem um dos lados não há comparação", () => {
    expect(deliverySummary([], [{ planned_end: "2026-11-13" }])).toMatchObject({ internalEnd: null, status: null });
    expect(deliverySummary([{ planned_end: "2026-11-13" }], [])).toMatchObject({ clientEnd: null, status: null });
  });

  it("rótulos", () => {
    expect(daysLabel(1)).toBe("1 dia");
    expect(daysLabel(3)).toBe("3 dias");
    expect(rangeLabel("2026-11-03", "2026-11-14")).toBe("03/11–14/11");
  });
});

describe("moveWithinSiblings", () => {
  const sibs = [item({ id: "a", sort_order: 10 }), item({ id: "b", sort_order: 20 }), item({ id: "c", sort_order: 30 })];

  it("troca de lugar reaproveitando as ordens do grupo e devolve só o que mudou", () => {
    expect(moveWithinSiblings(sibs, "c", "up")).toEqual([
      { id: "c", sort_order: 20 },
      { id: "b", sort_order: 30 },
    ]);
  });

  it("não sai das pontas", () => {
    expect(moveWithinSiblings(sibs, "a", "up")).toEqual([]);
    expect(moveWithinSiblings(sibs, "c", "down")).toEqual([]);
  });

  it("ordens repetidas viram sequência crescente", () => {
    const dup = [item({ id: "a", sort_order: 5 }), item({ id: "b", sort_order: 5 })];
    // b sobe e fica com 5 (não muda); a desce para 6.
    expect(moveWithinSiblings(dup, "b", "up")).toEqual([{ id: "a", sort_order: 6 }]);
  });

  it("nextSortOrder vai para o fim", () => {
    expect(nextSortOrder(sibs)).toBe(31);
    expect(nextSortOrder([])).toBe(0);
  });
});

describe("validateItemDates", () => {
  it("exige previstos e ordem das datas", () => {
    expect(validateItemDates({ planned_start: "", planned_end: "2026-11-02" })).toBe("Informe início e fim previstos.");
    expect(validateItemDates({ planned_start: "2026-11-03", planned_end: "2026-11-02" })).toMatch(/fim previsto/);
    expect(
      validateItemDates({ planned_start: "2026-11-01", planned_end: "2026-11-02", actual_start: "2026-11-05", actual_end: "2026-11-04" }),
    ).toMatch(/término real/);
    expect(validateItemDates({ planned_start: "2026-11-01", planned_end: "2026-11-02" })).toBeNull();
  });
});

describe("Painel: fim previsto do cronograma interno na linha", () => {
  it("é o maior fim previsto das etapas internas", () => {
    const row = buildObraRow({
      deadline: { project_id: "p1", current_deadline: "2026-12-01" } as never,
      stages: [
        { id: "s1", project_id: "p1", parent_id: null, description: "A", sort_order: 1, planned_start: "2026-11-01", planned_end: "2026-11-20", actual_start: null, actual_end: null },
        { id: "s2", project_id: "p1", parent_id: null, description: "B", sort_order: 2, planned_start: "2026-11-01", planned_end: "2026-11-25", actual_start: null, actual_end: null },
      ],
      activities: [],
      materials: [],
      weekAssignments: [],
      week: { from: "2026-11-02", to: "2026-11-08" },
      today: "2026-11-02",
    });
    expect(row.internalPlannedEnd).toBe("2026-11-25");
  });
});

describe("countClientDifferences", () => {
  it("conta só itens ligados ao cliente com datas diferentes", () => {
    const client = new Map([
      ["c1", { id: "c1", planned_start: "2026-11-02", planned_end: "2026-11-06" }],
      ["c2", { id: "c2", planned_start: "2026-11-09", planned_end: "2026-11-13" }],
    ]);
    expect(
      countClientDifferences(
        [
          item({ id: "a", client_activity_id: "c1" }),
          item({ id: "b", client_activity_id: "c2", planned_start: "2026-11-09", planned_end: "2026-11-16" }),
          item({ id: "c", planned_end: "2026-12-01" }),
        ],
        client,
      ),
    ).toBe(1);
  });
});
