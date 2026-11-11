import { describe, it, expect } from "vitest";
import {
  agruparEtapas,
  atalhosDeData,
  patchDatasReais,
  patchDoRascunho,
  patchParaDesfazer,
  validarDataReal,
  validarRascunho,
  type EtapaDatas,
} from "@/lib/datasReais";

// Terça-feira, 10/11/2026.
const HOJE = "2026-11-10";

const etapa = (p: Partial<EtapaDatas>): EtapaDatas => ({
  id: "e1",
  parent_id: null,
  description: "Pintura",
  planned_start: "2026-11-06",
  planned_end: "2026-11-12",
  actual_start: null,
  actual_end: null,
  sort_order: 0,
  ...p,
});

describe("validarDataReal", () => {
  it("bloqueia data futura no início e no término", () => {
    expect(validarDataReal({ campo: "inicio", data: "2026-11-11", hoje: HOJE, inicio: null, termino: null })).toEqual({
      ok: false,
      motivo: "futuro",
    });
    expect(
      validarDataReal({ campo: "termino", data: "2026-11-11", hoje: HOJE, inicio: "2026-11-04", termino: null }),
    ).toEqual({ ok: false, motivo: "futuro" });
  });

  it("aceita hoje e dias passados", () => {
    expect(validarDataReal({ campo: "inicio", data: HOJE, hoje: HOJE, inicio: null, termino: null })).toEqual({ ok: true });
    expect(
      validarDataReal({ campo: "termino", data: "2026-11-09", hoje: HOJE, inicio: "2026-11-04", termino: null }),
    ).toEqual({ ok: true });
  });

  it("término não pode ser antes do início", () => {
    expect(
      validarDataReal({ campo: "termino", data: "2026-11-03", hoje: HOJE, inicio: "2026-11-04", termino: null }),
    ).toEqual({ ok: false, motivo: "termino_antes_do_inicio" });
  });

  it("término no mesmo dia do início é aceito", () => {
    expect(
      validarDataReal({ campo: "termino", data: "2026-11-04", hoje: HOJE, inicio: "2026-11-04", termino: null }),
    ).toEqual({ ok: true });
  });

  it("início não pode passar de um término já lançado", () => {
    expect(
      validarDataReal({ campo: "inicio", data: "2026-11-09", hoje: HOJE, inicio: "2026-11-04", termino: "2026-11-06" }),
    ).toEqual({ ok: false, motivo: "inicio_depois_do_termino" });
  });

  it("limpar: o término sempre pode; o início só sem término", () => {
    expect(
      validarDataReal({ campo: "termino", data: null, hoje: HOJE, inicio: "2026-11-04", termino: "2026-11-06" }),
    ).toEqual({ ok: true });
    expect(validarDataReal({ campo: "inicio", data: null, hoje: HOJE, inicio: "2026-11-04", termino: null })).toEqual({
      ok: true,
    });
    expect(
      validarDataReal({ campo: "inicio", data: null, hoje: HOJE, inicio: "2026-11-04", termino: "2026-11-06" }),
    ).toEqual({ ok: false, motivo: "inicio_obrigatorio" });
  });
});

describe("validarRascunho", () => {
  it("aponta futuro e término antes do início", () => {
    expect(validarRascunho({ inicio: "2026-11-12", termino: null }, HOJE)).toBe("futuro");
    expect(validarRascunho({ inicio: "2026-11-06", termino: "2026-11-05" }, HOJE)).toBe("termino_antes_do_inicio");
  });

  it("aceita rascunho válido, vazio e término sem início", () => {
    expect(validarRascunho({ inicio: "2026-11-06", termino: HOJE }, HOJE)).toBeNull();
    expect(validarRascunho({ inicio: null, termino: null }, HOJE)).toBeNull();
    expect(validarRascunho({ inicio: null, termino: "2026-11-09" }, HOJE)).toBeNull();
  });
});

describe("patchDatasReais / patchDoRascunho", () => {
  it("início grava só o início", () => {
    expect(patchDatasReais(etapa({}), "inicio", HOJE)).toEqual({ actual_start: HOJE });
  });

  it("término com início já lançado grava só o término", () => {
    expect(patchDatasReais(etapa({ actual_start: "2026-11-06" }), "termino", HOJE)).toEqual({ actual_end: HOJE });
  });

  it("término sem início usa o início previsto", () => {
    expect(patchDatasReais(etapa({}), "termino", HOJE)).toEqual({ actual_start: "2026-11-06", actual_end: HOJE });
  });

  it("término antes do início previsto: o início vira o dia do término", () => {
    expect(patchDatasReais(etapa({}), "termino", "2026-11-05")).toEqual({
      actual_start: "2026-11-05",
      actual_end: "2026-11-05",
    });
  });

  it("rascunho igual ao que está gravado não gera patch", () => {
    const e = etapa({ actual_start: "2026-11-06" });
    expect(patchDoRascunho(e, { inicio: "2026-11-06", termino: null })).toEqual({});
  });

  it("rascunho só mexe nos campos que mudaram", () => {
    const e = etapa({ actual_start: "2026-11-06" });
    expect(patchDoRascunho(e, { inicio: "2026-11-06", termino: "2026-11-09" })).toEqual({ actual_end: "2026-11-09" });
    expect(patchDoRascunho(e, { inicio: "2026-11-05", termino: null })).toEqual({ actual_start: "2026-11-05" });
  });

  it("rascunho com término e sem início preenche o início", () => {
    expect(patchDoRascunho(etapa({}), { inicio: null, termino: "2026-11-09" })).toEqual({
      actual_start: "2026-11-06",
      actual_end: "2026-11-09",
    });
  });

  it("desfazer repõe só os campos tocados", () => {
    const e = etapa({ actual_start: "2026-11-06" });
    expect(patchParaDesfazer(e, { actual_end: HOJE })).toEqual({ actual_end: null });
    expect(patchParaDesfazer(etapa({}), { actual_start: "2026-11-06", actual_end: HOJE })).toEqual({
      actual_start: null,
      actual_end: null,
    });
  });
});

describe("atalhosDeData", () => {
  it("numa terça: hoje, ontem (segunda) e a sexta anterior", () => {
    expect(atalhosDeData(HOJE)).toEqual([
      { id: "hoje", date: "2026-11-10" },
      { id: "ontem", date: "2026-11-09" },
      { id: "ultimo_dia_util", date: "2026-11-06" },
    ]);
  });

  it("numa segunda: ontem é domingo e o último dia útil é a sexta", () => {
    expect(atalhosDeData("2026-11-09").map((a) => a.date)).toEqual(["2026-11-09", "2026-11-08", "2026-11-06"]);
  });

  it("nenhum atalho é futuro", () => {
    for (const a of atalhosDeData(HOJE)) expect(a.date <= HOJE).toBe(true);
  });
});

describe("agruparEtapas", () => {
  const itens = [
    etapa({ id: "atrasada", description: "Revestimento", planned_start: "2026-11-03", planned_end: "2026-11-05", actual_start: "2026-11-04", sort_order: 1 }),
    etapa({ id: "comeca", description: "Marcenaria", planned_start: HOJE, planned_end: "2026-11-14", sort_order: 2 }),
    etapa({ id: "andamento", description: "Pintura", planned_start: "2026-11-06", planned_end: "2026-11-12", actual_start: "2026-11-06", sort_order: 3 }),
    etapa({ id: "sem-inicio", description: "Louças", planned_start: "2026-11-09", planned_end: "2026-11-11", sort_order: 4 }),
    etapa({ id: "futura", description: "Limpeza", planned_start: "2026-11-16", planned_end: "2026-11-17", sort_order: 5 }),
    etapa({ id: "feita", description: "Demolição", planned_start: "2026-10-20", planned_end: "2026-10-23", actual_start: "2026-10-20", actual_end: "2026-10-23", sort_order: 0 }),
  ];

  it("separa em para hoje, próximas e concluídas", () => {
    const g = agruparEtapas(itens, HOJE);
    expect(g.paraHoje.map((e) => e.item.id)).toEqual(["atrasada", "sem-inicio", "comeca", "andamento"]);
    expect(g.proximas.map((e) => e.item.id)).toEqual(["futura"]);
    expect(g.concluidas.map((e) => e.item.id)).toEqual(["feita"]);
  });

  it("situação, atraso em dias úteis e próximo lançamento", () => {
    const g = agruparEtapas(itens, HOJE);
    const by = Object.fromEntries(g.paraHoje.map((e) => [e.item.id, e]));
    // Fim previsto qui 05/11; hoje ter 10/11 = sex, seg, ter.
    expect(by.atrasada).toMatchObject({ situacao: "atrasada", lateDays: 3, proximo: "termino" });
    expect(by["sem-inicio"]).toMatchObject({ situacao: "sem_inicio", lateDays: 1, proximo: "inicio" });
    expect(by.comeca).toMatchObject({ situacao: "comeca_hoje", lateDays: 0, proximo: "inicio" });
    expect(by.andamento).toMatchObject({ situacao: "em_andamento", lateDays: 0, proximo: "termino" });
  });

  it("conta como esperando data real só o que está devendo (não o que segue no prazo)", () => {
    expect(agruparEtapas(itens, HOJE).esperando).toBe(3);
  });

  it("etapa com micro-etapas não aparece; a micro-etapa leva o nome da mãe", () => {
    const g = agruparEtapas(
      [
        etapa({ id: "mae", description: "Banheiro", planned_start: "2026-11-03", planned_end: "2026-11-12" }),
        etapa({ id: "filha", parent_id: "mae", description: "Impermeabilização", planned_start: "2026-11-03", planned_end: "2026-11-04" }),
      ],
      HOJE,
    );
    expect(g.paraHoje.map((e) => e.item.id)).toEqual(["filha"]);
    expect(g.paraHoje[0].parentName).toBe("Banheiro");
  });
});
