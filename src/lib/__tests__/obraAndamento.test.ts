import { describe, it, expect } from "vitest";
import { axisPosition, buildAndamento, itemStateLabel } from "../obraAndamento";

// Quarta, 14/10/2026. Próxima semana: 19/10 (seg) a 25/10 (dom).
const TODAY = "2026-10-14";
const NEXT = { from: "2026-10-19", to: "2026-10-25" };

type S = Parameters<typeof buildAndamento>[0][number];
let seq = 0;
function st(p: Partial<S> & Pick<S, "description" | "planned_start" | "planned_end">): S {
  seq += 1;
  return {
    id: p.id ?? `s${seq}`,
    sort_order: p.sort_order ?? seq,
    actual_start: null,
    actual_end: null,
    parent_id: null,
    ...p,
  };
}

describe("buildAndamento", () => {
  it("sem cronograma", () => {
    const a = buildAndamento([], TODAY, NEXT);
    expect(a.fase).toBe("sem_cronograma");
    expect(a.atual).toBeNull();
    expect(a.agora).toEqual([]);
  });

  it("acha a etapa atual, o que está atrasado e o que começa na semana que vem", () => {
    const a = buildAndamento(
      [
        st({ description: "Demolição", planned_start: "2026-09-28", planned_end: "2026-10-02", actual_start: "2026-09-28", actual_end: "2026-10-02" }),
        st({ description: "Hidráulica", planned_start: "2026-10-05", planned_end: "2026-10-09", actual_start: "2026-10-05" }),
        st({ description: "Elétrica", planned_start: "2026-10-13", planned_end: "2026-10-16", actual_start: "2026-10-13" }),
        st({ description: "Gesso", planned_start: "2026-10-14", planned_end: "2026-10-20" }),
        st({ description: "Pintura", planned_start: "2026-10-21", planned_end: "2026-10-30" }),
        st({ description: "Limpeza", planned_start: "2026-11-02", planned_end: "2026-11-03" }),
      ],
      TODAY,
      NEXT,
    );
    expect(a.fase).toBe("andamento");
    expect(a.atual?.name).toBe("Hidráulica");
    expect(a.atual?.state).toBe("atrasada");
    expect(a.posicao).toEqual({ n: 2, total: 6 });
    expect(a.concluidas).toBe(1);
    // Atrasada primeiro, depois sem início, depois em andamento.
    expect(a.agora.map((i) => [i.name, i.state])).toEqual([
      ["Hidráulica", "atrasada"],
      ["Gesso", "sem_inicio"],
      ["Elétrica", "em_andamento"],
    ]);
    // 09/10 (sex) → 14/10 (qua), com 12/10 feriado: 13 e 14 = 2 dias úteis.
    expect(a.agora[0].lateDays).toBe(2);
    expect(a.proximaSemana.map((i) => i.name)).toEqual(["Pintura"]);
    expect(a.inicio).toBe("2026-09-28");
    expect(a.fim).toBe("2026-11-03");
  });

  it("usa micro-etapas em Agora e herda as datas reais nelas", () => {
    const a = buildAndamento(
      [
        st({ id: "e1", description: "Elétrica", planned_start: "2026-10-13", planned_end: "2026-10-23" }),
        st({ parent_id: "e1", description: "Passar fiação", planned_start: "2026-10-13", planned_end: "2026-10-16", actual_start: "2026-10-13" }),
        st({ parent_id: "e1", description: "Quadro", planned_start: "2026-10-19", planned_end: "2026-10-23" }),
      ],
      TODAY,
      NEXT,
    );
    expect(a.etapas).toHaveLength(1);
    expect(a.atual?.name).toBe("Elétrica");
    expect(a.atual?.state).toBe("em_andamento"); // herdou o início real da filha
    expect(a.agora.map((i) => [i.name, i.parentName])).toEqual([["Passar fiação", "Elétrica"]]);
    expect(a.proximaSemana.map((i) => i.name)).toEqual(["Quadro"]);
  });

  it("etapa com todas as micro-etapas terminadas está concluída", () => {
    const a = buildAndamento(
      [
        st({ id: "e1", description: "Piso", planned_start: "2026-10-01", planned_end: "2026-10-09" }),
        st({ parent_id: "e1", description: "Contrapiso", planned_start: "2026-10-01", planned_end: "2026-10-05", actual_start: "2026-10-01", actual_end: "2026-10-05" }),
        st({ parent_id: "e1", description: "Porcelanato", planned_start: "2026-10-06", planned_end: "2026-10-09", actual_start: "2026-10-06", actual_end: "2026-10-08" }),
      ],
      TODAY,
      NEXT,
    );
    expect(a.etapas[0].state).toBe("concluida");
    expect(a.fase).toBe("fim");
    expect(a.agora).toEqual([]);
  });

  it("antes de começar e entre etapas", () => {
    const antes = buildAndamento(
      [st({ description: "Mobilização", planned_start: "2026-10-20", planned_end: "2026-10-22" })],
      TODAY,
      NEXT,
    );
    expect(antes.fase).toBe("antes");
    expect(antes.atual?.name).toBe("Mobilização");
    expect(antes.proximaSemana).toHaveLength(1);

    const intervalo = buildAndamento(
      [
        st({ description: "A", planned_start: "2026-10-01", planned_end: "2026-10-09", actual_start: "2026-10-01", actual_end: "2026-10-09" }),
        st({ description: "B", planned_start: "2026-10-26", planned_end: "2026-10-30" }),
      ],
      TODAY,
      NEXT,
    );
    expect(intervalo.fase).toBe("intervalo");
    expect(intervalo.proximo?.name).toBe("B");
    expect(intervalo.proximaSemana).toEqual([]);
  });

  it("cronograma vencido com etapa aberta", () => {
    const a = buildAndamento(
      [st({ description: "Acabamento", planned_start: "2026-09-21", planned_end: "2026-10-02", actual_start: "2026-09-21" })],
      TODAY,
      NEXT,
    );
    expect(a.fase).toBe("vencido");
    expect(a.agora[0].state).toBe("atrasada");
  });
});

describe("itemStateLabel / axisPosition", () => {
  it("textos", () => {
    const base = { start: "2026-10-05", end: "2026-10-09", actualEnd: null };
    expect(itemStateLabel({ ...base, state: "atrasada", lateDays: 2 })).toBe("atrasada 2 dias (fim 09/10)");
    expect(itemStateLabel({ ...base, state: "em_andamento", lateDays: 0 })).toBe("em andamento até 09/10");
    expect(itemStateLabel({ ...base, state: "sem_inicio", lateDays: 3 })).toBe("sem início registrado (previsto 05/10)");
    expect(itemStateLabel({ ...base, state: "futura", lateDays: 0 })).toBe("começa 05/10");
  });
  it("eixo", () => {
    expect(axisPosition("2026-10-01", "2026-10-01", "2026-10-11")).toBe(0);
    expect(axisPosition("2026-10-06", "2026-10-01", "2026-10-11")).toBeCloseTo(0.5);
    expect(axisPosition("2026-12-01", "2026-10-01", "2026-10-11")).toBe(1);
  });
});
