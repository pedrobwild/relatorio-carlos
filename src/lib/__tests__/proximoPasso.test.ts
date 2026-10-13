import { describe, it, expect } from "vitest";
import { folgaTexto, pendencias, proximoPasso } from "../proximoPasso";
import { buildAndamento } from "../obraAndamento";
import type { ObraRow } from "../obrasPainel";

const TODAY = "2026-10-14";
const NEXT = { from: "2026-10-19", to: "2026-10-25" };

const base: ObraRow = {
  id: "a",
  name: "Obra",
  customer: null,
  responsibleId: null,
  responsible: null,
  deadline: "2026-11-27",
  projectedEnd: "2026-11-20",
  slack: 5,
  penalty: 0,
  progress: 50,
  consumed: 50,
  week: { stages: [], planned: 3, done: 1, notDone: 0, unplanned: false },
  alerts: [],
  risk: "verde",
  cadastro: { etapa: "Execução", relationship: null, paused: false },
  andamento: buildAndamento(
    [{ id: "e1", description: "Pintura", sort_order: 1, planned_start: "2026-10-12", planned_end: "2026-10-30", actual_start: "2026-10-13", actual_end: null, parent_id: null }],
    TODAY,
    NEXT,
  ),
  nextWeekPlanned: 2,
};
const row = (p: Partial<ObraRow>): ObraRow => ({ ...base, ...p });

describe("proximoPasso", () => {
  it("tudo em dia", () => {
    expect(proximoPasso(base)).toEqual({ texto: "Nada pendente", tom: "ok", onde: "semana", outras: 0 });
  });

  it("etapa atrasada vem primeiro e conta as outras pendências", () => {
    const andamento = buildAndamento(
      [
        { id: "e1", description: "Elétrica", sort_order: 1, planned_start: "2026-10-01", planned_end: "2026-10-09", actual_start: "2026-10-01", actual_end: null, parent_id: null },
        { id: "e2", description: "Gesso", sort_order: 2, planned_start: "2026-10-13", planned_end: "2026-10-20", actual_start: null, actual_end: null, parent_id: null },
      ],
      TODAY,
      NEXT,
    );
    const p = proximoPasso(row({ andamento, week: { ...base.week, unplanned: true, planned: 0 } }));
    expect(p.texto).toBe("Cobrar Elétrica (2 dias atrasada)");
    expect(p.tom).toBe("vermelho");
    // + confirmar se Gesso começou + planejar esta semana
    expect(p.outras).toBe(2);
  });

  it("deveria ter começado e não tem início lançado", () => {
    const andamento = buildAndamento(
      [{ id: "e1", description: "Gesso", sort_order: 1, planned_start: "2026-10-13", planned_end: "2026-10-20", actual_start: null, actual_end: null, parent_id: null }],
      TODAY,
      NEXT,
    );
    expect(proximoPasso(row({ andamento })).texto).toBe("Confirmar se Gesso começou");
  });

  it("material, semana, semana passada e semana que vem", () => {
    const textos = pendencias(
      row({
        alerts: [{ kind: "material", tone: "warning", text: "Falta material: Porcelanato (sex) +1" }],
        week: { ...base.week, unplanned: true, planned: 0, previous: { ppc: null, pending: true } },
        nextWeekPlanned: 0,
      }),
    ).map((x) => x.texto);
    expect(textos).toEqual([
      "Comprar Porcelanato (até sex) +1",
      "Planejar esta semana (nenhum dia marcado)",
      "Fechar a semana passada",
      "Planejar a semana que vem",
    ]);
  });

  it("obra paralisada não é cobrada por planejamento", () => {
    const p = proximoPasso(
      row({ cadastro: { etapa: "Execução", relationship: null, paused: true }, week: { ...base.week, unplanned: true }, nextWeekPlanned: 0 }),
    );
    expect(p.texto).toBe("Obra paralisada");
  });

  it("cadastro faltando", () => {
    const textos = pendencias(row({ andamento: undefined, deadline: null })).map((x) => x.texto);
    expect(textos).toEqual(["Montar o cronograma da obra", "Cadastrar o prazo do contrato"]);
  });
});

describe("folgaTexto", () => {
  it("em palavras", () => {
    expect(folgaTexto(3)).toBe("sobram 3 dias");
    expect(folgaTexto(1)).toBe("sobram 1 dia");
    expect(folgaTexto(0)).toBe("no limite");
    expect(folgaTexto(-4)).toBe("atrasa 4 dias");
    expect(folgaTexto(null)).toBeNull();
  });
});
