import { describe, expect, it } from "vitest";
import {
  atalhosDeData,
  avisoPendencia,
  botaoApagado,
  cadeia,
  defineInicioReal,
  diarioReducer,
  efeitoDaEtapa,
  errosComTela,
  estadoInicial,
  gerarTextoCliente,
  linhasDoEnvio,
  marcoDaEtapa,
  montarPayload,
  ordenarEtapas,
  pendenciaTravadaEmSim,
  rotuloBotao,
  semanaDoRelatorio,
  sextaDaSemana,
  validar,
  type DiarioAction,
  type DiarioState,
  type EtapaCronograma,
} from "../regras";

const HOJE = "2026-11-20"; // sexta

const etapa = (id: string, description: string, over: Partial<EtapaCronograma> = {}): EtapaCronograma => ({
  id,
  description,
  plannedStart: "2026-11-23",
  plannedEnd: "2026-11-27",
  actualEnd: null,
  sortOrder: Number(id.slice(1)),
  ...over,
});

const ETAPAS: EtapaCronograma[] = [
  etapa("e1", "Adequações elétricas", { plannedStart: "2026-11-16", plannedEnd: "2026-11-20" }),
  etapa("e2", "Impermeabilização"),
  etapa("e3", "Assentamento de piso", { plannedStart: "2026-11-18", plannedEnd: "2026-11-25" }),
  etapa("e5", "Medição das bancadas", { plannedStart: "2026-11-20", plannedEnd: "2026-11-20" }),
  etapa("e8", "Limpeza final"),
];

const run = (actions: DiarioAction[], from: DiarioState = estadoInicial()) =>
  actions.reduce((s, a) => diarioReducer(s, a), from);
const avancar: DiarioAction = { type: "avancar", etapas: ETAPAS };

describe("marcos pelo nome da etapa", () => {
  it("reconhece medição e adequação elétrica, e só elas", () => {
    expect(marcoDaEtapa("Medição do box")).toBe("medicao");
    expect(marcoDaEtapa("Medição da marcenaria, depois do gesso")).toBe("medicao");
    expect(marcoDaEtapa("Adequação elétrica")).toBe("eletrica");
    expect(marcoDaEtapa("Infraestrutura de ar-condicionado, adequações elétricas e preparação de paredes")).toBe(
      "eletrica",
    );
    expect(marcoDaEtapa("Mobilização, medições, marcações e proteção de piso")).toBeNull();
    expect(marcoDaEtapa("Instalações elétricas")).toBeNull();
  });

  it("marcenaria não conta como início; marmoraria e vidraçaria contam, só concluídas", () => {
    expect(defineInicioReal("eletrica", { status: "concluida", tipo: null })).toBe(true);
    expect(defineInicioReal("eletrica", { status: "andamento", tipo: null })).toBe(false);
    expect(defineInicioReal("medicao", { status: "concluida", tipo: "marmoraria" })).toBe(true);
    expect(defineInicioReal("medicao", { status: "concluida", tipo: "vidracaria" })).toBe(true);
    expect(defineInicioReal("medicao", { status: "concluida", tipo: "marcenaria" })).toBe(false);
    expect(defineInicioReal(null, { status: "concluida", tipo: null })).toBe(false);
  });
});

describe("roteiro 1 — caminho rápido", () => {
  it("obra → etapa em andamento com foto → equipe → conferir, sem telas extras", () => {
    let s = run([avancar]);
    expect(s.tela).toBe("id"); // sem obra não anda
    expect(s.tentou.id).toBe(true);

    s = run([{ type: "obra", id: "o1" }, avancar], s);
    expect(s.tela).toBe("etapas");

    s = run([{ type: "status", id: "e3", status: "andamento" }, avancar], s);
    expect(s.tela).toBe("etapas"); // falta a foto
    expect(validar(s, ETAPAS).etapas).toEqual(["Foto da etapa: Assentamento de piso"]);

    s = run([{ type: "etapa", id: "e3", patch: { fotoId: "f1" } }, avancar], s);
    expect(s.tela).toBe("equipe");

    s = run([avancar], s);
    expect(s.tela).toBe("equipe");
    expect(validar(s, ETAPAS).equipe).toEqual(["Quantas pessoas estiveram na obra", "Nomes de quem esteve na obra"]);

    s = run([{ type: "qtd", delta: 1 }, { type: "qtd", delta: 1 }, { type: "nomes", nomes: "Ana, Beto" }, avancar], s);
    expect(s.tela).toBe("triagem");
    expect(rotuloBotao(s, true)).toBe("Conferir e enviar");
    expect(cadeia(s)).toEqual(["id", "etapas", "equipe", "triagem", "conf"]);

    s = run([avancar], s);
    expect(s.tela).toBe("conf");
    expect(errosComTela(validar(s, ETAPAS))).toEqual([]);
    expect(botaoApagado(s, validar(s, ETAPAS))).toBe(false);
    expect(rotuloBotao(s, true)).toBe("Enviar relatório");
    expect(rotuloBotao(s, false)).toBe("Salvar e enviar quando houver sinal");

    const payload = montarPayload({ state: s, etapas: ETAPAS, clientId: "c1", hoje: HOJE, offline: false });
    expect(payload).toMatchObject({
      project_id: "o1",
      report_date: HOJE,
      no_progress: false,
      team_count: 2,
      pendencias: [],
      materiais: [],
      prazo: null,
    });
    expect(payload.etapas).toHaveLength(1);
    expect(payload.etapas[0].texto_cliente).not.toMatch(/Ana|Beto/);
  });

  it("“Nenhuma etapa avançou hoje” dispensa equipe e some ao marcar uma etapa", () => {
    let s = run([{ type: "obra", id: "o1" }, avancar, { type: "nenhumaEtapa" }, avancar, avancar]);
    expect(s.tela).toBe("triagem");
    s = run([{ type: "ir", tela: "etapas" }, { type: "status", id: "e2", status: "concluida" }], s);
    expect(s.nenhumaEtapa).toBe(false);
  });
});

describe("roteiro 2 — etapa impedida trava em pendência", () => {
  const base = run([
    { type: "obra", id: "o1" },
    { type: "status", id: "e3", status: "impedida" },
    { type: "etapa", id: "e3", patch: { fotoId: "f1" } },
    { type: "qtd", delta: 1 },
    { type: "nomes", nomes: "Ana" },
    { type: "ir", tela: "triagem" },
  ]);

  it("abre pendência ligada e trava “Tem pendência?” em Sim", () => {
    expect(base.pendencias).toHaveLength(1);
    expect(base.pendencias[0].etapaId).toBe("e3");
    expect(pendenciaTravadaEmSim(base)).toBe(true);
    expect(run([{ type: "triagem", chave: "temPendencia", valor: false }], base).pendencias).toHaveLength(1);
    expect(cadeia(base)).toContain("pend");
    expect(rotuloBotao(base, true)).toBe("Continuar");
  });

  it("não deixa voltar nem avançar sem os quatro campos", () => {
    let s = run([avancar], base);
    expect(s.tela).toBe("pend");
    s = run([avancar], s);
    expect(s.tela).toBe("pend");
    expect(validar(s, ETAPAS).pend).toEqual([
      "Pendência 1: descrição",
      "Pendência 1: responsável",
      "Pendência 1: prazo",
      "Pendência 1: trava a obra?",
    ]);

    s = run([{ type: "voltar" }], s);
    expect(s.modal).toBe(true);
    expect(avisoPendencia(s)).toMatchObject({ ligada: true, avulsa: false });

    const ficou = run([{ type: "modalFicar" }], s);
    expect(ficou).toMatchObject({ modal: false, tela: "pend" });

    const mudou = run([{ type: "modalParaAndamento" }], s);
    expect(mudou.tela).toBe("triagem");
    expect(mudou.etapas.e3.status).toBe("andamento");
    expect(mudou.pendencias).toHaveLength(0);
    expect(cadeia(mudou)).not.toContain("pend");
  });

  it("completa a pendência e segue; pendência ligada não pode ser removida", () => {
    const id = base.pendencias[0].id;
    const s = run(
      [
        avancar,
        { type: "removerPendencia", id },
        { type: "pendencia", id, patch: { descricao: "Falta material", responsavel: "Marmoraria", prazo: "2026-11-24", trava: true } },
        avancar,
      ],
      base,
    );
    expect(s.pendencias).toHaveLength(1);
    expect(s.tela).toBe("conf");
    expect(efeitoDaEtapa(ETAPAS[2], s.etapas.e3, HOJE)).toBe("Foto anexada · abriu pendência");
  });

  it("pendência avulsa vazia pode ser descartada", () => {
    let s = run([
      { type: "obra", id: "o1" },
      { type: "nenhumaEtapa" },
      { type: "ir", tela: "triagem" },
      { type: "triagem", chave: "temPendencia", valor: true },
      avancar,
      { type: "voltar" },
    ]);
    expect(avisoPendencia(s)).toMatchObject({ ligada: false, avulsa: true });
    s = run([{ type: "modalDescartar" }], s);
    expect(s).toMatchObject({ tela: "triagem", temPendencia: false, pendencias: [] });
  });

  it("tirar o Impedida apaga a pendência da etapa", () => {
    expect(run([{ type: "status", id: "e3", status: "concluida" }], base).pendencias).toHaveLength(0);
    expect(run([{ type: "status", id: "e3", status: "impedida" }], base).pendencias).toHaveLength(0); // desmarca
  });
});

describe("roteiro 3 — medição", () => {
  const base = run([
    { type: "obra", id: "o1" },
    { type: "status", id: "e5", status: "andamento" },
    { type: "etapa", id: "e5", patch: { fotoId: "f5" } },
  ]);

  it("exige o tipo; agendada exige data e fornecedor", () => {
    expect(validar(base, ETAPAS).etapas).toEqual(["Tipo da medição"]);
    const agendada = run([{ type: "etapa", id: "e5", patch: { tipo: "marcenaria", agendada: true } }], base);
    expect(validar(agendada, ETAPAS).etapas).toEqual(["Data agendada da medição", "Fornecedor da medição"]);
    const ok = run(
      [{ type: "etapa", id: "e5", patch: { dataMedicao: "2026-11-23", fornecedorId: "f1", fornecedorNome: "Pedras SA" } }],
      agendada,
    );
    expect(validar(ok, ETAPAS).etapas).toEqual([]);
    expect(efeitoDaEtapa(ETAPAS[3], ok.etapas.e5, HOJE)).toBe(
      "Foto anexada · medição de marcenaria · agendada 23/11 com Pedras SA",
    );
  });

  it("concluída: marcenaria não define início, marmoraria define; agendamento some", () => {
    const marc = run(
      [
        { type: "etapa", id: "e5", patch: { tipo: "marcenaria", agendada: true, dataMedicao: "2026-11-23" } },
        { type: "status", id: "e5", status: "concluida" },
      ],
      base,
    );
    expect(marc.etapas.e5).toMatchObject({ agendada: false, dataMedicao: null });
    expect(efeitoDaEtapa(ETAPAS[3], marc.etapas.e5, HOJE)).toBe(
      "Foto anexada · vira término real em 20/11 · medição de marcenaria · não define início",
    );
    const marm = run([{ type: "etapa", id: "e5", patch: { tipo: "marmoraria" } }], marc);
    expect(efeitoDaEtapa(ETAPAS[3], marm.etapas.e5, HOJE)).toContain("define INÍCIO REAL da obra");
  });

  it("adequação elétrica concluída define o início real", () => {
    const s = run([{ type: "status", id: "e1", status: "concluida" }, { type: "etapa", id: "e1", patch: { fotoId: "f" } }], base);
    expect(efeitoDaEtapa(ETAPAS[0], s.etapas.e1, HOJE)).toBe(
      "Foto anexada · vira término real em 20/11 · define INÍCIO REAL da obra",
    );
  });
});

describe("roteiro 4 — material divergente", () => {
  const base = run([
    { type: "obra", id: "o1" },
    { type: "nenhumaEtapa" },
    { type: "triagem", chave: "temMaterial", valor: true },
  ]);
  const id = base.materiais[0].id;

  it("Diverge exige foto e descrição", () => {
    let s = run([{ type: "material", id, patch: { item: "Porcelanato" } }, { type: "chegou", id, valor: "sim" }], base);
    expect(validar(s, ETAPAS).mat).toEqual(["Item 1: confere com o executivo?"]);
    s = run([{ type: "confere", id, valor: "div" }], s);
    expect(validar(s, ETAPAS).mat).toEqual(["Item 1: foto da divergência", "Item 1: descrição da divergência"]);
    s = run([{ type: "material", id, patch: { fotoId: "fm", divergencia: "pedido x recebido" } }], s);
    expect(validar(s, ETAPAS).mat).toEqual([]);
    // Voltar para Confere limpa a divergência.
    expect(run([{ type: "confere", id, valor: "ok" }], s).materiais[0]).toMatchObject({ fotoId: null, divergencia: "" });
  });

  it("Não chegou pula a conferência", () => {
    const s = run([{ type: "material", id, patch: { item: "Rejunte" } }, { type: "chegou", id, valor: "nao" }], base);
    expect(s.materiais[0].confere).toBe("nc");
    expect(validar(s, ETAPAS).mat).toEqual([]);
    expect(run([{ type: "chegou", id, valor: "parcial" }], s).materiais[0].confere).toBeNull();
  });

  it("responder Não apaga os itens; o último item não pode ser removido", () => {
    expect(run([{ type: "removerMaterial", id }], base).materiais).toHaveLength(1);
    expect(run([{ type: "triagem", chave: "temMaterial", valor: false }], base).materiais).toHaveLength(0);
  });
});

describe("mudança de prazo e envio", () => {
  it("pede nova data, motivo e aviso ao cliente", () => {
    let s = run([{ type: "obra", id: "o1" }, { type: "nenhumaEtapa" }, { type: "triagem", chave: "temPrazo", valor: true }]);
    expect(validar(s, ETAPAS).prazo).toEqual(["Nova data de entrega", "Motivo", "Cliente já foi avisado?"]);
    s = run([{ type: "prazo", patch: { data: "2027-01-10", motivo: "condominio", avisado: "vai" } }], s);
    expect(validar(s, ETAPAS).prazo).toEqual([]);
    const payload = montarPayload({ state: s, etapas: ETAPAS, clientId: "c", hoje: HOJE, offline: true });
    expect(payload).toMatchObject({
      no_progress: true,
      sent_offline: true,
      prazo: { data: "2027-01-10", motivo: "condominio", avisado: "vai" },
    });
  });

  it("“Relatar outra obra” guarda a data e a função", () => {
    const s = run([
      { type: "data", escolha: "ontem" },
      { type: "funcao", funcao: "coordenador" },
      { type: "obra", id: "o1" },
      { type: "nenhumaEtapa" },
      { type: "enviado", offline: true },
    ]);
    expect(s).toMatchObject({ tela: "ok", enviadoOffline: true });
    expect(run([{ type: "novoRelato" }], s)).toMatchObject({
      tela: "id",
      dataEscolha: "ontem",
      funcao: "coordenador",
      obraId: null,
      nenhumaEtapa: false,
    });
  });

  it("resume o que foi registrado, com a entrada no portal", () => {
    const s = run([
      { type: "obra", id: "o1" },
      { type: "status", id: "e1", status: "concluida" },
      { type: "status", id: "e3", status: "andamento" },
      { type: "qtd", delta: 1 },
    ]);
    expect(linhasDoEnvio(s, ETAPAS)).toEqual([
      "2 etapa(s) tocada(s) · 1 com término real",
      "Equipe: 1 pessoa(s)",
      "Portal do cliente: texto e foto de 2 etapa(s), liberados na sexta às 18h",
    ]);
  });
});

describe("texto do cliente", () => {
  const base = { etapa: "Adequações elétricas", dia: HOJE, proximaEtapa: "Impermeabilização" };

  it("leva só a etapa, a situação e a próxima etapa", () => {
    expect(gerarTextoCliente({ ...base, status: "concluida" })).toBe(
      "Adequações elétricas concluída em sex 20/11.\nPróxima etapa: Impermeabilização.",
    );
    expect(gerarTextoCliente({ ...base, status: "andamento", proximaEtapa: null })).toBe(
      "Adequações elétricas em andamento, com serviço executado em sex 20/11.",
    );
  });

  it("etapa impedida não gera texto nem entra na conta do portal", () => {
    expect(gerarTextoCliente({ ...base, status: "impedida" })).toBe("");
    const s = run([
      { type: "obra", id: "o1" },
      { type: "status", id: "e3", status: "impedida" },
      { type: "etapa", id: "e3", patch: { fotoId: "f" } },
      { type: "qtd", delta: 1 },
      { type: "nomes", nomes: "Ana" },
    ]);
    const p = s.pendencias[0].id;
    const pronto = run(
      [{ type: "pendencia", id: p, patch: { descricao: "Falta material", responsavel: "Marmoraria", prazo: "2026-11-24", trava: true } }],
      s,
    );
    const payload = montarPayload({ state: pronto, etapas: ETAPAS, clientId: "c", hoje: HOJE, offline: false });
    expect(payload.etapas[0]).toMatchObject({ status: "impedida", texto_cliente: "" });
    expect(linhasDoEnvio(pronto, ETAPAS).some((l) => l.startsWith("Portal do cliente"))).toBe(false);
  });

  it("nada interno vaza: equipe, pendência, material e prazo ficam fora", () => {
    const s = run([
      { type: "obra", id: "o1" },
      { type: "status", id: "e1", status: "concluida" },
      { type: "etapa", id: "e1", patch: { fotoId: "f" } },
      { type: "qtd", delta: 1 },
      { type: "nomes", nomes: "Zuleica Prestadora" },
      { type: "triagem", chave: "temPendencia", valor: true },
      { type: "triagem", chave: "temPrazo", valor: true },
      { type: "prazo", patch: { data: "2027-01-10", motivo: "condominio", avisado: "nao" } },
    ]);
    const texto = montarPayload({ state: s, etapas: ETAPAS, clientId: "c", hoje: HOJE, offline: false }).etapas[0].texto_cliente;
    expect(texto).toBe("Adequações elétricas concluída em sex 20/11.\nPróxima etapa: Impermeabilização.");
    expect(texto).not.toMatch(/Zuleica|pessoa|pend|prazo|entrega|início real|10\/01/i);
  });
});

describe("datas", () => {
  it("previstas para o dia vêm primeiro", () => {
    expect(ordenarEtapas(ETAPAS, HOJE).map((e) => e.id)).toEqual(["e1", "e3", "e5", "e2", "e8"]);
  });

  it("atalhos: amanhã, +2, +3 e +7", () => {
    expect(atalhosDeData(HOJE).map((a) => a.label)).toEqual(["Amanhã · 21/11", "Dom · 22/11", "Seg · 23/11", "Sex · 27/11"]);
  });

  it("semana do relatório semanal igual à do portal (e à do banco)", () => {
    const inicio = "2026-11-02"; // segunda
    expect(semanaDoRelatorio(inicio, "2026-11-06")).toEqual({ weekNumber: 1, weekStart: "2026-11-02", weekEnd: "2026-11-06" });
    expect(semanaDoRelatorio(inicio, "2026-11-07")).toEqual({ weekNumber: 2, weekStart: "2026-11-09", weekEnd: "2026-11-13" });
    expect(semanaDoRelatorio(inicio, "2026-11-20")).toEqual({ weekNumber: 3, weekStart: "2026-11-16", weekEnd: "2026-11-20" });
    expect(semanaDoRelatorio(inicio, "2026-11-21")?.weekNumber).toBe(4);
    expect(semanaDoRelatorio(inicio, "2026-10-01")?.weekNumber).toBe(1);
    expect(semanaDoRelatorio("2026-11-04", "2026-11-10")).toEqual({ weekNumber: 2, weekStart: "2026-11-09", weekEnd: "2026-11-13" });
    expect(semanaDoRelatorio("2026-11-07", "2026-11-16")).toEqual({ weekNumber: 2, weekStart: "2026-11-16", weekEnd: "2026-11-20" });
    expect(semanaDoRelatorio(null, HOJE)).toBeNull();
  });

  it("sexta que fecha a semana do relato", () => {
    expect(sextaDaSemana("2026-11-18")).toBe("2026-11-20");
    expect(sextaDaSemana("2026-11-20")).toBe("2026-11-20");
    expect(sextaDaSemana("2026-11-21")).toBe("2026-11-27");
  });
});
