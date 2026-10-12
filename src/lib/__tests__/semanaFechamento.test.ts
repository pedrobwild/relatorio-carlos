import { describe, it, expect } from "vitest";
import {
  closingIsStale,
  ddmmOf,
  doneOfPlannedLabel,
  ppcLabel,
  ppcOf,
  reasonCounts,
  reasonsText,
  shortDayLabel,
  weekClosingState,
  weekHasStarted,
  weekIsOver,
} from "../semanaFechamento";

// Semana de 05/10/2026 (segunda) a 11/10 (domingo). "Hoje" = quinta, 08/10.
const MON = "2026-10-05";
const TODAY = "2026-10-08";

const asg = (id: string, work_date: string, outcome: "feito" | "nao_feito" | null = null, reason: string | null = null) =>
  ({ id, work_date, outcome, not_done_reason: reason }) as Parameters<typeof weekClosingState>[0][number];

describe("PPC", () => {
  it("dias feitos ÷ dias marcados, em % inteiro", () => {
    expect(ppcOf(8, 10)).toBe(80);
    expect(ppcOf(2, 3)).toBe(67);
    expect(ppcOf(0, 4)).toBe(0);
    expect(ppcOf(4, 4)).toBe(100);
  });

  it("sem nada marcado não tem PPC (não é zero)", () => {
    expect(ppcOf(0, 0)).toBeNull();
    expect(ppcLabel(null)).toBe("—");
    expect(ppcLabel(80)).toBe("80%");
  });

  it("nunca passa de 100 nem fica negativo com dado torto", () => {
    expect(ppcOf(12, 10)).toBe(100);
    expect(ppcOf(-1, 10)).toBe(0);
    expect(ppcOf(Number.NaN, 10)).toBeNull();
  });

  it("texto dos dias", () => {
    expect(doneOfPlannedLabel(8, 10)).toBe("8 de 10 dias feitos");
    expect(doneOfPlannedLabel(1, 1)).toBe("1 de 1 dia feito");
  });
});

describe("situação da semana para fechar", () => {
  it("separa o que falta confirmar do que ainda não aconteceu", () => {
    const s = weekClosingState(
      [
        asg("a", "2026-10-05", "feito"),
        asg("b", "2026-10-06", "nao_feito", "material"),
        asg("c", "2026-10-07"), // passou e ninguém confirmou
        asg("d", "2026-10-08"), // hoje: já dá para confirmar
        asg("e", "2026-10-09"), // amanhã: ainda não
      ],
      MON,
      TODAY,
    );
    expect(s).toMatchObject({ planned: 5, done: 1, notDone: 1, ppc: 20, canClose: false });
    expect(s.pending.map((a) => a.id)).toEqual(["c", "d"]);
    expect(s.future.map((a) => a.id)).toEqual(["e"]);
    expect(s.notDoneItems.map((a) => a.id)).toEqual(["b"]);
  });

  it("fecha quando todos os dias estão confirmados", () => {
    const s = weekClosingState(
      [asg("a", "2026-10-05", "feito"), asg("b", "2026-10-06", "feito"), asg("c", "2026-10-07", "nao_feito", "clima")],
      MON,
      TODAY,
    );
    expect(s).toMatchObject({ planned: 3, done: 2, notDone: 1, ppc: 67, canClose: true });
  });

  it("semana sem nada marcado não fecha", () => {
    expect(weekClosingState([], MON, TODAY)).toMatchObject({ planned: 0, ppc: null, canClose: false });
  });

  it("sábado e domingo marcados contam; dias de outras semanas não", () => {
    const s = weekClosingState(
      [
        asg("antes", "2026-10-04", "feito"), // domingo da semana anterior
        asg("sab", "2026-10-10", "feito"),
        asg("dom", "2026-10-11", "feito"),
        asg("depois", "2026-10-12", "feito"), // segunda seguinte
      ],
      MON,
      "2026-10-12",
    );
    expect(s.planned).toBe(2);
    expect(s.canClose).toBe(true);
  });

  it("a semana começa na segunda e termina depois do domingo", () => {
    expect(weekHasStarted(MON, "2026-10-04")).toBe(false);
    expect(weekHasStarted(MON, "2026-10-05")).toBe(true);
    expect(weekIsOver(MON, "2026-10-11")).toBe(false);
    expect(weekIsOver(MON, "2026-10-12")).toBe(true);
  });
});

describe("fechamento desatualizado", () => {
  const live = (over: Partial<ReturnType<typeof weekClosingState>> = {}) => ({
    planned: 5,
    done: 4,
    notDone: 1,
    pending: [],
    future: [],
    ...over,
  });

  it("igual ao retrato: em dia", () => {
    expect(closingIsStale({ planned: 5, done: 4, not_done: 1 }, live())).toBe(false);
  });

  it("alguém mudou um dia ou marcou outro depois de fechar", () => {
    expect(closingIsStale({ planned: 5, done: 4, not_done: 1 }, live({ done: 5, notDone: 0 }))).toBe(true);
    expect(closingIsStale({ planned: 5, done: 4, not_done: 1 }, live({ planned: 6, pending: [asg("x", "2026-10-08")] }))).toBe(true);
  });
});

describe("fechamento desatualizado: motivos", () => {
  const items = [asg("a", "2026-10-06", "nao_feito", "material"), asg("b", "2026-10-07", "nao_feito", "clima")];
  const live = { planned: 5, done: 3, notDone: 2, pending: [], future: [], notDoneItems: items };
  const closing = (reasons: unknown) => ({ planned: 5, done: 3, not_done: 2, reasons });

  it("mesmos motivos: em dia", () => {
    expect(closingIsStale(closing({ material: 1, clima: 1 }), live)).toBe(false);
  });

  it("alguém trocou o motivo depois de fechar", () => {
    expect(closingIsStale(closing({ material: 2 }), live)).toBe(true);
    expect(closingIsStale(closing({ material: 1, equipe: 1 }), live)).toBe(true);
  });

  it("sem motivos conhecidos de um dos lados não acusa", () => {
    expect(closingIsStale(closing(undefined), live)).toBe(false);
    expect(closingIsStale(closing({ material: 9 }), { ...live, notDoneItems: undefined })).toBe(false);
  });
});

describe("motivos e datas", () => {
  it("motivos do mais frequente para o menos", () => {
    const r = reasonCounts([
      { not_done_reason: "clima" },
      { not_done_reason: "material" },
      { not_done_reason: "material" },
      { not_done_reason: null },
    ]);
    expect(r.map((x) => [x.reason, x.count])).toEqual([
      ["material", 2],
      ["clima", 1],
    ]);
    expect(reasonsText(r)).toBe("Faltou material (2) · Clima (1)");
  });

  it("dia curto e dd/mm sem depender do fuso", () => {
    expect(shortDayLabel("2026-10-07")).toBe("qua 07");
    expect(shortDayLabel("2026-10-10")).toBe("sáb 10");
    expect(ddmmOf("2026-10-05")).toBe("05/10");
  });
});
