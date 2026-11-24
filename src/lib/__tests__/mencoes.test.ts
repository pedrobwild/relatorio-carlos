import { describe, expect, it } from "vitest";
import {
  agruparMencoes,
  gatilhoDeMencao,
  haQuantoTempo,
  horasUteisEntre,
  inserirMencao,
  mencaoAtrasada,
  semAcento,
  type MencaoBase,
} from "../mencoes";

// Novembro de 2026: 16 é segunda; 20 é sexta e feriado (Consciência Negra); 21 e 22, fim de semana.
const d = (iso: string) => new Date(iso);
const m = (over: Partial<MencaoBase> = {}): MencaoBase => ({
  id: "m1",
  mentioned_user_id: "marcado",
  requested_by: "pediu",
  created_at: "2026-11-16T10:00:00",
  resolved_at: null,
  archived_at: null,
  responsavel_obra_id: "resp",
  ...over,
});

describe("horas úteis", () => {
  it("conta as horas corridas dentro de dias úteis", () => {
    expect(horasUteisEntre(d("2026-11-16T10:00:00"), d("2026-11-16T15:30:00"))).toBe(5.5);
    expect(horasUteisEntre(d("2026-11-16T10:00:00"), d("2026-11-17T10:00:00"))).toBe(24);
  });

  it("pula fim de semana e feriado", () => {
    // quinta 19, 18h → segunda 23, 12h: 6 h na quinta + 12 h na segunda (sexta 20 é feriado).
    expect(horasUteisEntre(d("2026-11-19T18:00:00"), d("2026-11-23T12:00:00"))).toBe(18);
    expect(horasUteisEntre(d("2026-11-21T09:00:00"), d("2026-11-22T20:00:00"))).toBe(0);
  });

  it("intervalo invertido ou vazio dá zero", () => {
    expect(horasUteisEntre(d("2026-11-17T10:00:00"), d("2026-11-16T10:00:00"))).toBe(0);
  });
});

describe("menção atrasada", () => {
  it("só depois de 24 horas úteis em aberto", () => {
    const criada = m({ created_at: "2026-11-16T10:00:00" });
    expect(mencaoAtrasada(criada, d("2026-11-17T10:00:00"))).toBe(false);
    expect(mencaoAtrasada(criada, d("2026-11-17T10:01:00"))).toBe(true);
  });

  it("fim de semana não atrasa ninguém", () => {
    const quinta = m({ created_at: "2026-11-19T18:00:00" });
    expect(mencaoAtrasada(quinta, d("2026-11-23T12:00:00"))).toBe(false);
    expect(mencaoAtrasada(quinta, d("2026-11-23T18:01:00"))).toBe(true);
  });

  it("resolvida ou arquivada nunca está atrasada", () => {
    const agora = d("2026-11-30T10:00:00");
    expect(mencaoAtrasada(m({ resolved_at: "2026-11-17T09:00:00" }), agora)).toBe(false);
    expect(mencaoAtrasada(m({ archived_at: "2026-11-17T09:00:00" }), agora)).toBe(false);
  });
});

describe("listas de quem está logado", () => {
  const agora = d("2026-11-18T12:00:00");
  const lista = [
    m({ id: "comigo-nova", mentioned_user_id: "eu", created_at: "2026-11-18T09:00:00" }),
    m({ id: "comigo-velha", mentioned_user_id: "eu", created_at: "2026-11-16T09:00:00" }),
    m({ id: "pedi", requested_by: "eu" }),
    m({ id: "minha-obra-atrasada", responsavel_obra_id: "eu" }),
    m({ id: "minha-obra-em-dia", responsavel_obra_id: "eu", created_at: "2026-11-18T09:00:00" }),
    m({ id: "resolvida", mentioned_user_id: "eu", resolved_at: "2026-11-17T09:00:00" }),
    m({ id: "arquivada", mentioned_user_id: "eu", archived_at: "2026-11-17T09:00:00" }),
    m({ id: "de-outros" }),
  ];

  it("separa o que é comigo, o que pedi e o atrasado nas minhas obras", () => {
    const g = agruparMencoes(lista, "eu", agora);
    expect(g.comigo.map((x) => x.id)).toEqual(["comigo-velha", "comigo-nova"]);
    expect(g.pediEmAberto.map((x) => x.id)).toEqual(["pedi"]);
    expect(g.atrasadasNasMinhasObras.map((x) => x.id)).toEqual(["minha-obra-atrasada"]);
  });

  it("sem usuário, nada", () => {
    expect(agruparMencoes(lista, null, agora)).toEqual({ comigo: [], pediEmAberto: [], atrasadasNasMinhasObras: [] });
  });
});

describe("textos", () => {
  it("há quanto tempo", () => {
    const agora = d("2026-11-18T12:00:00");
    expect(haQuantoTempo("2026-11-18T11:59:40", agora)).toBe("agora");
    expect(haQuantoTempo("2026-11-18T11:20:00", agora)).toBe("há 40 min");
    expect(haQuantoTempo("2026-11-18T07:00:00", agora)).toBe("há 5 h");
    expect(haQuantoTempo("2026-11-17T11:00:00", agora)).toBe("há 1 dia");
    expect(haQuantoTempo("2026-11-15T11:00:00", agora)).toBe("há 3 dias");
  });

  it("busca sem acento", () => {
    expect(semAcento("Sérgio Conceição")).toBe("sergio conceicao");
  });
});

describe("@ no texto", () => {
  it("abre a lista ao digitar @ no começo ou depois de espaço", () => {
    expect(gatilhoDeMencao("@", 1)).toBe("");
    expect(gatilhoDeMencao("Falta material @ser", 19)).toBe("ser");
    expect(gatilhoDeMencao("email@dominio", 13)).toBeNull();
    expect(gatilhoDeMencao("Falta @ser material", 19)).toBeNull();
  });

  it("troca o trecho digitado pelo nome", () => {
    expect(inserirMencao("Falta material @ser", 19, "Sérgio Lima")).toEqual({
      texto: "Falta material @Sérgio Lima ",
      cursor: 28,
    });
    expect(inserirMencao("Falta material", 14, "Gabi")).toEqual({ texto: "Falta material @Gabi ", cursor: 21 });
    expect(inserirMencao("", 0, "Gabi")).toEqual({ texto: "@Gabi ", cursor: 6 });
  });
});
