import { describe, it, expect } from "vitest";
import { datasDaResposta, etapasParaConfirmar, type EtapaHojeInput } from "../etapasHoje";

// Quarta, 14/10/2026 (segunda 12/10 é feriado).
const TODAY = "2026-10-14";
let n = 0;
const it_ = (p: Partial<EtapaHojeInput>): EtapaHojeInput => ({
  id: `i${++n}`,
  project_id: "p1",
  parent_id: null,
  client_activity_id: null,
  description: "Etapa",
  planned_start: "2026-10-13",
  planned_end: "2026-10-20",
  actual_start: null,
  actual_end: null,
  responsible_user_id: null,
  sort_order: n,
  project: { name: "Apto 82", status: "active" },
  ...p,
});

describe("etapasParaConfirmar", () => {
  it("pergunta 'começou?' e 'terminou?' e ignora o que já terminou ou ainda vai começar", () => {
    const g = etapasParaConfirmar(
      [
        it_({ description: "Gesso" }),
        it_({ description: "Elétrica", planned_start: "2026-10-01", planned_end: "2026-10-09", actual_start: "2026-10-01" }),
        it_({ description: "Pintura", planned_start: "2026-10-20" }),
        it_({ description: "Demolição", actual_start: "2026-10-01", actual_end: "2026-10-05" }),
      ],
      TODAY,
    );
    expect(g).toHaveLength(1);
    expect(g[0].etapas.map((e) => [e.item.description, e.pergunta, e.lateDays])).toEqual([
      ["Elétrica", "terminou", 2],
      ["Gesso", "comecou", 1],
    ]);
  });

  it("etapa com micro-etapas: pergunta só das micro-etapas, com o nome da mãe", () => {
    const g = etapasParaConfirmar(
      [
        it_({ id: "m", description: "Piso" }),
        it_({ parent_id: "m", description: "Contrapiso" }),
      ],
      TODAY,
    );
    expect(g[0].etapas.map((e) => [e.item.description, e.parentName])).toEqual([["Contrapiso", "Piso"]]);
  });

  it("só obras ativas; a obra com mais atraso vem primeiro", () => {
    const g = etapasParaConfirmar(
      [
        it_({ project_id: "a", project: { name: "Obra A", status: "active" } }),
        it_({ project_id: "b", project: { name: "Obra B", status: "active" }, planned_start: "2026-10-01" }),
        it_({ project_id: "c", project: { name: "Obra C", status: "paused" } }),
      ],
      TODAY,
    );
    expect(g.map((x) => x.projectName)).toEqual(["Obra B", "Obra A"]);
  });
});

describe("datasDaResposta", () => {
  const e = { item: it_({ planned_start: "2026-10-09" }) };
  it("começou hoje / na data prevista / terminou", () => {
    expect(datasDaResposta(e, "comecou_hoje", TODAY)).toEqual({ actual_start: TODAY });
    expect(datasDaResposta(e, "comecou_no_previsto", TODAY)).toEqual({ actual_start: "2026-10-09" });
    // Sem início real, terminar grava o início previsto também.
    expect(datasDaResposta(e, "terminou_hoje", TODAY)).toEqual({ actual_start: "2026-10-09", actual_end: TODAY });
    const iniciada = { item: it_({ actual_start: "2026-10-10" }) };
    expect(datasDaResposta(iniciada, "terminou_hoje", TODAY)).toEqual({ actual_end: TODAY });
  });
});
