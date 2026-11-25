import { describe, it, expect } from "vitest";
import {
  buildTaskCandidates,
  type ScheduleItemForTasks,
} from "@/lib/tasksFromSchedule";

const item = (o: Partial<ScheduleItemForTasks> & { id: string }): ScheduleItemForTasks => ({
  parent_id: null,
  description: o.id,
  etapa: null,
  planned_start: "2026-11-02",
  planned_end: "2026-11-06",
  actual_end: null,
  responsible_user_id: null,
  notes: null,
  sort_order: 0,
  ...o,
});

describe("buildTaskCandidates", () => {
  const items = [
    item({ id: "s2", description: "Semana 2", sort_order: 2 }),
    item({ id: "s1", description: "Semana 1", sort_order: 1 }),
    item({ id: "b", parent_id: "s2", description: "Pintura", sort_order: 1 }),
    item({ id: "a2", parent_id: "s1", description: "Elétrica", sort_order: 2, actual_end: "2026-11-05" }),
    item({ id: "a1", parent_id: "s1", description: "Demolição", sort_order: 1, responsible_user_id: "u1" }),
  ];

  it("usa só os itens-folha, na ordem do cronograma, agrupados pela semana", () => {
    const c = buildTaskCandidates(items, []);
    expect(c.map((x) => x.title)).toEqual(["Demolição", "Elétrica", "Pintura"]);
    expect(c.map((x) => x.group)).toEqual(["Semana 1", "Semana 1", "Semana 2"]);
    expect(c[0]).toMatchObject({
      start_date: "2026-11-02",
      due_date: "2026-11-06",
      responsible_user_id: "u1",
      done: false,
    });
    expect(c[1].done).toBe(true);
  });

  it("marca o que já existe como atividade, ignorando caixa e espaços", () => {
    const c = buildTaskCandidates(items, ["  demolição "]);
    expect(c.find((x) => x.title === "Demolição")?.alreadyExists).toBe(true);
    expect(c.find((x) => x.title === "Pintura")?.alreadyExists).toBe(false);
  });

  it("etapa sem detalhamento vira a própria candidata; repetidos entram uma vez", () => {
    const c = buildTaskCandidates(
      [
        item({ id: "x", description: "Vistoria", etapa: "Entrega" }),
        item({ id: "y", description: "vistoria" }),
      ],
      [],
    );
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ title: "Vistoria", group: "Entrega" });
  });
});
