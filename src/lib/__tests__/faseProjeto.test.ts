/**
 * Regras da fase de projeto: etapa atual, atraso por etapa e veredito da obra.
 * As datas são "yyyy-mm-dd" locais — os mesmos resultados valem em São Paulo
 * e no CI (UTC).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OFFICIAL_START_BUSINESS_DAYS,
  PHASE_DUE_SOON_DAYS,
  PHASE_STEPS,
  officialStartText,
  phaseState,
  phaseStepLabel,
  phaseVerdict,
  type PhaseStepKey,
  type PhaseStepRow,
} from "../faseProjeto";
import { Constants } from "@/integrations/supabase/types";

const TODAY = "2026-10-14"; // quarta

const row = (step: PhaseStepKey, patch: Partial<PhaseStepRow> = {}): PhaseStepRow => ({
  step,
  done_at: null,
  due_date: null,
  responsible_user_id: null,
  notes: null,
  ...patch,
});

const done = (step: PhaseStepKey, on = "2026-10-01") => row(step, { done_at: on });

describe("PHASE_STEPS", () => {
  it("são as seis etapas, na ordem do fluxo, com os nomes combinados", () => {
    expect(PHASE_STEPS.map((s) => [s.key, s.label])).toEqual([
      ["projeto_3d", "Projeto 3D"],
      ["projeto_executivo", "Projeto executivo"],
      ["medicao_fina", "Medição fina in loco"],
      ["emissao_art", "Emissão da ART/RRT"],
      ["solicitacao_aprovacao", "Pedido de aprovação ao condomínio"],
      ["aprovacao_condominio", "Aprovação do condomínio recebida"],
    ]);
  });

  it("mesma ordem do enum do banco (o gatilho e a RPC comparam etapas por ela)", () => {
    expect(PHASE_STEPS.map((s) => s.key)).toEqual([...Constants.public.Enums.project_phase_step]);
  });

  it("toda etapa tem nome curto, e os nomes curtos não se repetem", () => {
    const shorts = PHASE_STEPS.map((s) => s.shortLabel);
    expect(shorts.every((s) => s.trim().length > 0)).toBe(true);
    expect(new Set(shorts).size).toBe(PHASE_STEPS.length);
  });

  it("phaseStepLabel devolve o nome completo", () => {
    expect(phaseStepLabel("emissao_art")).toBe("Emissão da ART/RRT");
  });
});

describe("phaseState", () => {
  it("obra sem nada registrado: seis etapas em aberto, a primeira é a atual", () => {
    for (const rows of [[], null, undefined]) {
      const s = phaseState(rows, TODAY);
      expect(s.registered).toBe(false);
      expect(s.doneCount).toBe(0);
      expect(s.steps).toHaveLength(6);
      expect(s.steps.every((x) => !x.done && !x.registered && !x.late && x.daysToDue === null)).toBe(true);
      expect(s.current?.key).toBe("projeto_3d");
      expect(s.steps.map((x) => x.isCurrent)).toEqual([true, false, false, false, false, false]);
    }
  });

  it("a etapa atual é a primeira sem conclusão, mesmo que as linhas venham fora de ordem", () => {
    const s = phaseState(
      [row("emissao_art", { due_date: "2026-10-20" }), done("projeto_executivo", "2026-10-02"), done("projeto_3d")],
      TODAY,
    );
    expect(s.registered).toBe(true);
    expect(s.doneCount).toBe(2);
    expect(s.current?.key).toBe("medicao_fina");
    expect(s.current?.registered).toBe(false); // etapa atual ainda sem linha
    expect(s.steps.find((x) => x.key === "projeto_executivo")).toMatchObject({ done: true, doneAt: "2026-10-02" });
  });

  it("etapa concluída fora de ordem não pula a anterior em aberto", () => {
    const s = phaseState([done("projeto_executivo"), done("medicao_fina")], TODAY);
    expect(s.current?.key).toBe("projeto_3d");
    expect(s.doneCount).toBe(2);
  });

  it("as seis concluídas: não há etapa atual", () => {
    const s = phaseState(PHASE_STEPS.map((d) => done(d.key)), TODAY);
    expect(s.current).toBeNull();
    expect(s.doneCount).toBe(6);
    expect(s.steps.some((x) => x.isCurrent)).toBe(false);
  });

  it("leva responsável, prazo e observação de cada linha", () => {
    const s = phaseState(
      [row("projeto_3d", { due_date: "2026-10-20", responsible_user_id: "u1", notes: "aguardando planta" })],
      TODAY,
    );
    expect(s.steps[0]).toMatchObject({
      key: "projeto_3d",
      label: "Projeto 3D",
      registered: true,
      done: false,
      doneAt: null,
      dueDate: "2026-10-20",
      responsibleUserId: "u1",
      notes: "aguardando planta",
      late: false,
      daysLate: 0,
      daysToDue: 6,
    });
  });

  it("atraso: em aberto com prazo anterior a hoje; vencer hoje não é atraso", () => {
    const s = phaseState(
      [
        row("projeto_3d", { due_date: "2026-10-10" }),
        row("projeto_executivo", { due_date: TODAY }),
        row("medicao_fina", { due_date: "2026-10-13" }),
      ],
      TODAY,
    );
    expect(s.steps[0]).toMatchObject({ late: true, daysLate: 4, daysToDue: -4 });
    expect(s.steps[1]).toMatchObject({ late: false, daysLate: 0, daysToDue: 0 });
    // Cada etapa em aberto informa o próprio atraso, mesmo não sendo a atual.
    expect(s.steps[2]).toMatchObject({ late: true, daysLate: 1, daysToDue: -1, isCurrent: false });
  });

  it("etapa concluída nunca está atrasada, mesmo concluída depois do prazo", () => {
    const s = phaseState([row("projeto_3d", { due_date: "2026-09-01", done_at: "2026-10-01" })], TODAY);
    expect(s.steps[0]).toMatchObject({ done: true, late: false, daysLate: 0, daysToDue: null });
  });

  it("conta dias corridos atravessando mês e ano", () => {
    expect(phaseState([row("projeto_3d", { due_date: "2026-11-02" })], "2026-10-30").steps[0].daysToDue).toBe(3);
    expect(phaseState([row("projeto_3d", { due_date: "2026-12-30" })], "2027-01-02").steps[0]).toMatchObject({
      late: true,
      daysLate: 3,
    });
    // fevereiro de ano bissexto
    expect(phaseState([row("projeto_3d", { due_date: "2028-03-01" })], "2028-02-28").steps[0].daysToDue).toBe(2);
  });

  it("data inválida é tratada como ausente (não gera NaN na tela)", () => {
    const s = phaseState([row("projeto_3d", { due_date: "", done_at: "não é data" })], TODAY);
    expect(s.steps[0]).toMatchObject({ done: false, doneAt: null, dueDate: null, daysToDue: null, late: false });
  });

  describe("hoje padrão = dia local do aparelho", () => {
    afterEach(() => vi.useRealTimers());

    it("23h30 de 14/10 ainda é dia 14 (não vira dia 15 por causa do UTC)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 14, 23, 30));
      const s = phaseState([row("projeto_3d", { due_date: "2026-10-14" })]);
      expect(s.steps[0]).toMatchObject({ late: false, daysToDue: 0 });
    });

    it("00h10 de 15/10 já é dia 15: o prazo de 14/10 venceu ontem", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 15, 0, 10));
      const s = phaseState([row("projeto_3d", { due_date: "2026-10-14" })]);
      expect(s.steps[0]).toMatchObject({ late: true, daysLate: 1 });
    });
  });
});

describe("phaseVerdict", () => {
  const verdictFor = (rows: PhaseStepRow[]) => phaseVerdict(phaseState(rows, TODAY));

  it("atrasada, com o número de dias (singular e plural)", () => {
    expect(verdictFor([row("projeto_3d", { due_date: "2026-10-10" })])).toEqual({
      verdict: "atrasada",
      text: "Atrasada há 4 dias",
    });
    expect(verdictFor([row("projeto_3d", { due_date: "2026-10-13" })])).toEqual({
      verdict: "atrasada",
      text: "Atrasada há 1 dia",
    });
  });

  it("vence logo: hoje e os próximos 3 dias corridos", () => {
    expect(PHASE_DUE_SOON_DAYS).toBe(3);
    expect(verdictFor([row("projeto_3d", { due_date: "2026-10-14" })])).toEqual({ verdict: "vence_logo", text: "Vence hoje" });
    expect(verdictFor([row("projeto_3d", { due_date: "2026-10-15" })])).toEqual({ verdict: "vence_logo", text: "Vence amanhã" });
    expect(verdictFor([row("projeto_3d", { due_date: "2026-10-16" })])).toEqual({ verdict: "vence_logo", text: "Vence em 2 dias" });
    expect(verdictFor([row("projeto_3d", { due_date: "2026-10-17" })])).toEqual({ verdict: "vence_logo", text: "Vence em 3 dias" });
  });

  it("no prazo: vence daqui a mais de 3 dias", () => {
    expect(verdictFor([row("projeto_3d", { due_date: "2026-10-18" })])).toEqual({ verdict: "no_prazo", text: "No prazo" });
  });

  it("sem prazo: etapa atual sem data (inclusive obra sem nada registrado)", () => {
    expect(verdictFor([])).toEqual({ verdict: "sem_prazo", text: "Sem prazo" });
    expect(verdictFor([done("projeto_3d"), row("projeto_executivo", { notes: "x" })])).toEqual({
      verdict: "sem_prazo",
      text: "Sem prazo",
    });
  });

  it("pronta: as seis concluídas", () => {
    expect(verdictFor(PHASE_STEPS.map((d) => done(d.key)))).toEqual({ verdict: "pronta", text: "Pronta para iniciar" });
  });

  it("só a etapa ATUAL decide: etapa futura vencida não torna a obra atrasada", () => {
    const state = phaseState(
      [row("projeto_3d", { due_date: "2026-10-30" }), row("emissao_art", { due_date: "2026-10-01" })],
      TODAY,
    );
    expect(state.steps.find((s) => s.key === "emissao_art")?.late).toBe(true);
    expect(phaseVerdict(state).verdict).toBe("no_prazo");
  });

  it("etapa anterior concluída com atraso não pesa: vale o prazo da atual", () => {
    expect(
      verdictFor([
        row("projeto_3d", { due_date: "2026-09-01", done_at: "2026-10-01" }),
        row("projeto_executivo", { due_date: "2026-10-12" }),
      ]),
    ).toEqual({ verdict: "atrasada", text: "Atrasada há 2 dias" });
  });
});

describe("officialStartText", () => {
  it("formata a data do banco em dd/mm/aaaa com a regra dos 5 dias úteis", () => {
    expect(OFFICIAL_START_BUSINESS_DAYS).toBe(5);
    expect(officialStartText("2026-10-16")).toBe("Início oficial: 16/10/2026 (5 dias úteis após a aprovação)");
  });

  it("não troca o dia por causa do fuso (primeiro dia do ano)", () => {
    expect(officialStartText("2027-01-01")).toBe("Início oficial: 01/01/2027 (5 dias úteis após a aprovação)");
  });

  it("sem data (ou data inválida) não há texto", () => {
    expect(officialStartText(null)).toBeNull();
    expect(officialStartText(undefined)).toBeNull();
    expect(officialStartText("")).toBeNull();
    expect(officialStartText("16/10/2026")).toBeNull();
  });
});
