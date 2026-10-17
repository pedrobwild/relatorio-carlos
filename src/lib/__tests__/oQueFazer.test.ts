import { describe, it, expect } from "vitest";
import { hrefDoPasso, montarOQueFazer, tarefaDoProjeto } from "../oQueFazer";
import { buildProjetoRow } from "../painelNovo";
import { PHASE_STEPS, type PhaseStepRow } from "../faseProjeto";
import type { ObraRow } from "../obrasPainel";
import type { PainelObra } from "@/hooks/usePainelObras";

const MONDAY = "2026-10-12";
const HOJE = "2026-10-14";

const row = (p: Partial<ObraRow>): ObraRow => ({
  id: "a",
  name: "Obra A",
  customer: null,
  responsibleId: "eu",
  responsible: "Eu",
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
  andamento: undefined,
  nextWeekPlanned: 2,
  ...p,
});

const projeto = (steps: PhaseStepRow[] | null, p: Partial<PainelObra> = {}) =>
  buildProjetoRow(
    {
      id: "p",
      nome: "Loft",
      customer_name: null,
      engineer_name: null,
      etapa: "Projeto 3D",
      status: null,
      relacionamento: null,
      responsavel_id: "eu",
      responsavel_nome: "Eu",
      ultima_atualizacao: "2026-10-10T12:00:00Z",
      is_project_phase: true,
      ...p,
    } as PainelObra,
    HOJE,
    { steps, staffNames: new Map() },
  );
const etapa = (over: Partial<PhaseStepRow>): PhaseStepRow[] => [
  { step: PHASE_STEPS[0].key, done_at: "2026-10-01", due_date: null, responsible_user_id: null, notes: null },
  { step: PHASE_STEPS[1].key, done_at: null, due_date: null, responsible_user_id: null, notes: null, ...over },
];

describe("hrefDoPasso", () => {
  it("leva aonde se resolve", () => {
    expect(hrefDoPasso("x", { onde: "hoje" }, MONDAY)).toEqual({ href: "/gestao/hoje?obra=x", acao: "Abrir o Hoje" });
    expect(hrefDoPasso("x", { onde: "semana", semana: "proxima" }, MONDAY).href).toBe("/gestao/semana?obra=x&semana=2026-10-19");
    expect(hrefDoPasso("x", { onde: "semana", semana: "anterior" }, MONDAY)).toEqual({
      href: "/gestao/semana?obra=x&semana=2026-10-05",
      acao: "Fechar a semana",
    });
    expect(hrefDoPasso("x", { onde: "cronograma" }, MONDAY).href).toBe("/obra/x/cronograma-interno");
  });
});

describe("tarefaDoProjeto", () => {
  it("etapa atrasada, vencendo e sem prazo", () => {
    expect(tarefaDoProjeto(projeto(etapa({ due_date: "2026-10-10" })))?.texto).toBe(
      "Cobrar Projeto executivo (etapa atrasada há 4 dias)",
    );
    expect(tarefaDoProjeto(projeto(etapa({ due_date: "2026-10-15" })))).toMatchObject({
      texto: "Projeto executivo: vence amanhã (15/10)",
      tom: "amarelo",
    });
    expect(tarefaDoProjeto(projeto(etapa({}))))?.toMatchObject({ texto: "Combinar prazo para Projeto executivo", tom: "neutro" });
    expect(tarefaDoProjeto(projeto(etapa({ due_date: "2026-12-01" })))).toBeNull();
  });
  it("sem etapa registrada; não se sabe = nada", () => {
    expect(tarefaDoProjeto(projeto([]))?.texto).toBe("Registrar em que etapa do projeto está");
    expect(tarefaDoProjeto(projeto(null))).toBeNull();
  });
});

describe("montarOQueFazer", () => {
  it("só as minhas, mais grave primeiro, e as obras em dia à parte", () => {
    const r = montarOQueFazer({
      rows: [
        row({ id: "a", name: "A", week: { stages: [], planned: 0, done: 0, notDone: 0, unplanned: true } }),
        row({ id: "b", name: "B" }),
        row({ id: "c", name: "C", responsibleId: "outra", deadline: null }),
      ],
      projetos: [projeto(etapa({ due_date: "2026-10-10" }))],
      userId: "eu",
      monday: MONDAY,
      escopo: null,
    });
    expect(r.escopo).toBe("minhas");
    expect(r.tarefas.map((t) => [t.obraNome, t.texto, t.tom])).toEqual([
      ["Loft", "Cobrar Projeto executivo (etapa atrasada há 4 dias)", "vermelho"],
      ["A", "Planejar esta semana (nenhum dia marcado)", "amarelo"],
      ["A", "Montar o cronograma da obra", "amarelo"],
      ["B", "Montar o cronograma da obra", "amarelo"],
    ]);
    expect(r.obrasComPendencia).toBe(3);
  });

  it("sem obra da pessoa, mostra todas; a escolha manda", () => {
    const rows = [row({ id: "c", name: "C", responsibleId: "outra" })];
    expect(montarOQueFazer({ rows, projetos: [], userId: "eu", monday: MONDAY, escopo: null }).escopo).toBe("todas");
    expect(montarOQueFazer({ rows, projetos: [], userId: "eu", monday: MONDAY, escopo: "minhas" }).tarefas).toEqual([]);
  });
});
