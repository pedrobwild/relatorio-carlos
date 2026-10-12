import { describe, it, expect } from "vitest";
import {
  aprovacaoRegistrada,
  buildConcluidaRow,
  buildProjetoRow,
  cadastroOf,
  FASE_DESCONHECIDA,
  FASE_PRONTA,
  FASE_SEM_REGISTRO,
  faseKeyOf,
  groupByEtapa,
  groupByFase,
  isObraConcluida,
  isPhaseStepKey,
  KANBAN_ETAPAS,
  listaFromParams,
  moveStepsLocally,
  projetoEtapaInfo,
  projetoResponsavel,
  projetosResumoText,
  relationshipFlag,
  resultadoLabel,
  searchConcluidas,
  searchObraRows,
  searchProjetos,
  SEM_ETAPA,
  sortConcluidas,
  sortProjetos,
  staleHint,
  staleLabel,
  stepVerdict,
  summarizeProjetos,
  visaoFromParams,
} from "../painelNovo";
import { PHASE_STEPS, phaseState, type PhaseStepKey, type PhaseStepRow } from "../faseProjeto";
import type { ObraRow } from "../obrasPainel";
import type { PainelObra } from "@/hooks/usePainelObras";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";

const TODAY = "2026-10-14";

function obra(p: Partial<PainelObra> = {}): PainelObra {
  return {
    id: "p1",
    nome: "Ap. 1204 Vila Mariana",
    customer_name: "Mariana Costa",
    engineer_name: null,
    inicio_oficial: null,
    entrega_oficial: null,
    inicio_real: null,
    entrega_real: null,
    prazo: null,
    etapa: null,
    inicio_etapa: null,
    previsao_avanco: null,
    status: null,
    relacionamento: null,
    external_budget_id: null,
    responsavel_id: null,
    responsavel_nome: null,
    // Meio-dia UTC: mesmo dia de calendário em São Paulo e em UTC.
    ultima_atualizacao: "2026-10-14T12:00:00Z",
    is_project_phase: false,
    progress_percentage: null,
    pending_count: 0,
    overdue_count: 0,
    ...p,
  };
}

function deadline(p: Partial<ProjectDeadline> = {}): ProjectDeadline {
  return {
    project_id: "p1",
    project_name: "Apto 142",
    status: "active",
    is_project_phase: false,
    current_deadline: "2026-09-30",
    actual_end_date: null,
    business_days_late: 0,
    penalty_accrued_value: null,
    ...p,
  } as ProjectDeadline;
}

/** Linha de `project_phase_steps`. */
const etapa = (step: PhaseStepKey, p: Partial<PhaseStepRow> = {}): PhaseStepRow => ({
  step,
  done_at: null,
  due_date: null,
  responsible_user_id: null,
  notes: null,
  ...p,
});

/** As `n` primeiras etapas concluídas (em 01/10) e, se pedido, a seguinte com prazo/responsável. */
function etapas(n: number, atual: Partial<PhaseStepRow> | null = null): PhaseStepRow[] {
  const rows = PHASE_STEPS.slice(0, n).map((s) => etapa(s.key, { done_at: "2026-10-01" }));
  if (atual && n < PHASE_STEPS.length) rows.push(etapa(PHASE_STEPS[n].key, atual));
  return rows;
}

/** Linha de projeto com as etapas dadas (undefined = etapas desconhecidas). */
const projeto = (p: Partial<PainelObra>, steps?: PhaseStepRow[], staffNames?: Map<string, string>) =>
  buildProjetoRow(obra({ is_project_phase: true, ...p }), TODAY, steps ? { steps, staffNames } : undefined);

const linha = (p: Partial<ObraRow>): ObraRow =>
  ({ id: "x", name: "Obra", customer: null, responsible: null, responsibleId: null, ...p }) as ObraRow;

describe("endereço do painel", () => {
  it("lista: em execução por padrão; aceita os parâmetros do painel antigo", () => {
    expect(listaFromParams(new URLSearchParams(""))).toBe("execucao");
    expect(listaFromParams(new URLSearchParams("fase=projetos"))).toBe("projetos");
    expect(listaFromParams(new URLSearchParams("aba=concluidas"))).toBe("concluidas");
    expect(listaFromParams(new URLSearchParams("fase=qualquer"))).toBe("execucao");
  });

  it("visão: lista por padrão; ignora valor desconhecido", () => {
    expect(visaoFromParams(new URLSearchParams(""))).toBe("lista");
    expect(visaoFromParams(new URLSearchParams("view=board"))).toBe("board");
    expect(visaoFromParams(new URLSearchParams("view=kanban"))).toBe("kanban");
    expect(visaoFromParams(new URLSearchParams("view=tabela"))).toBe("lista");
  });
});

describe("cadastro digitado", () => {
  it("só 'Paralisada' vira marcação; os outros status digitados são ignorados", () => {
    expect(cadastroOf(obra({ status: "Paralisada" })).paused).toBe(true);
    expect(cadastroOf(obra({ status: "Em dia" })).paused).toBe(false);
    expect(cadastroOf(obra({ status: "Atrasado" })).paused).toBe(false);
    expect(cadastroOf(undefined)).toEqual({ etapa: null, relationship: null, paused: false });
  });

  it("relacionamento normal não aparece na linha", () => {
    expect(relationshipFlag("Normal")).toBeNull();
    expect(relationshipFlag(null)).toBeNull();
    expect(relationshipFlag("Crítico")).toBe("Crítico");
  });
});

describe("busca", () => {
  it("acha por obra, cliente, responsável e etapa, sem ligar para acento", () => {
    const rows = [
      linha({ id: "a", name: "Ap. 1204 Vila Mariana", customer: "João Pedro", responsible: "Bruna" }),
      linha({ id: "b", name: "Studio Pinheiros", cadastro: { etapa: "Mobilização", relationship: null, paused: false } }),
    ];
    expect(searchObraRows(rows, "joao").map((r) => r.id)).toEqual(["a"]);
    expect(searchObraRows(rows, "bruna").map((r) => r.id)).toEqual(["a"]);
    expect(searchObraRows(rows, "mobilizacao").map((r) => r.id)).toEqual(["b"]);
    expect(searchObraRows(rows, "  ").map((r) => r.id)).toEqual(["a", "b"]);
    expect(searchObraRows(rows, "nada disso")).toEqual([]);
  });

  it("projetos e concluídas", () => {
    const projetos = [buildProjetoRow(obra({ id: "a", nome: "Loft Itaim", etapa: "Projeto 3D" }), TODAY)];
    expect(searchProjetos(projetos, "projeto 3d")).toHaveLength(1);
    expect(searchProjetos(projetos, "pinheiros")).toHaveLength(0);

    const concluidas = [buildConcluidaRow(deadline({ actual_end_date: "2026-09-28" }), obra({ customer_name: "Carla" }))];
    expect(searchConcluidas(concluidas, "carla")).toHaveLength(1);
    expect(searchConcluidas(concluidas, "outra")).toHaveLength(0);
  });
});

describe("projetos", () => {
  it("dias sem atualização e dias na etapa", () => {
    const r = buildProjetoRow(
      obra({ ultima_atualizacao: "2026-10-04T12:00:00Z", inicio_etapa: "2026-10-09", etapa: "Medição", status: "Paralisada" }),
      TODAY,
    );
    expect(r.staleDays).toBe(10);
    expect(r.daysInEtapa).toBe(5);
    expect(r.etapa).toBe("Medição");
    expect(r.paused).toBe(true);
  });

  it("sem data válida de atualização fica desconhecido, nunca negativo", () => {
    expect(buildProjetoRow(obra({ ultima_atualizacao: "" }), TODAY).staleDays).toBeNull();
    expect(buildProjetoRow(obra({ ultima_atualizacao: "1970-01-01T00:00:00Z" }), TODAY).staleDays).toBeNull();
    expect(buildProjetoRow(obra({ ultima_atualizacao: "2026-10-20T12:00:00Z" }), TODAY).staleDays).toBe(0);
  });

  it("responsável: o do painel; na falta, o engenheiro", () => {
    expect(buildProjetoRow(obra({ responsavel_nome: "Bruna", engineer_name: "Lucas" }), TODAY).responsible).toBe("Bruna");
    expect(buildProjetoRow(obra({ engineer_name: "Lucas" }), TODAY).responsible).toBe("Lucas");
  });

  it("sem etapas conhecidas: o mais parado primeiro; sem registro no topo (como antes)", () => {
    const p = (nome: string, atualizada: string) => projeto({ nome, ultima_atualizacao: atualizada });
    const rows = [
      p("B", "2026-10-11T12:00:00Z"),
      p("A", "2026-09-14T12:00:00Z"),
      p("D", ""),
      p("E", ""),
      p("C", "2026-10-11T12:00:00Z"),
    ];
    expect(sortProjetos(rows).map((r) => r.name)).toEqual(["D", "E", "A", "B", "C"]);
  });

  it("texto de há quanto tempo", () => {
    expect(staleLabel(null)).toBe("Sem registro");
    expect(staleLabel(0)).toBe("Hoje");
    expect(staleLabel(1)).toBe("Ontem");
    expect(staleLabel(12)).toBe("Há 12 dias");
    expect(staleHint(null)).toBe("Sem registro de atualização");
    expect(staleHint(0)).toBe("Atualizada hoje");
    expect(staleHint(1)).toBe("Atualizada ontem");
    expect(staleHint(20)).toBe("Há 20 dias sem atualização");
  });
});

describe("projetos: fase de projeto", () => {
  const equipe = new Map([["u1", "Bruna"]]);

  it("etapa atual, veredito, prazo e responsável da etapa", () => {
    const r = projeto(
      { responsavel_nome: "Carla", inicio_apos_aprovacao: null },
      etapas(2, { due_date: "2026-10-10", responsible_user_id: "u1" }),
      equipe,
    );
    expect(r.phase?.current?.key).toBe("medicao_fina");
    expect(r.phase?.doneCount).toBe(2);
    expect(r.verdict).toEqual({ verdict: "atrasada", text: "Atrasada há 4 dias" });
    expect(r.dueDate).toBe("2026-10-10");
    expect(r.stepResponsibleId).toBe("u1");
    expect(r.stepResponsible).toBe("Bruna");
    // O responsável da linha é o da etapa; o da obra continua guardado.
    expect(projetoResponsavel(r)).toBe("Bruna");
    expect(r.responsible).toBe("Carla");
    expect(projetoEtapaInfo(r)).toEqual({ title: "Medição fina in loco", progress: "2 de 6 concluídas", registered: true });
  });

  it("etapa sem responsável próprio usa o da obra; responsável que saiu da equipe não vira o da obra", () => {
    const semDono = projeto({ responsavel_nome: "Carla" }, etapas(1, { due_date: "2026-10-15" }), equipe);
    expect(semDono.stepResponsible).toBeNull();
    expect(projetoResponsavel(semDono)).toBe("Carla");
    expect(semDono.verdict).toEqual({ verdict: "vence_logo", text: "Vence amanhã" });

    const saiu = projeto({ responsavel_nome: "Carla" }, etapas(1, { responsible_user_id: "u9" }), equipe);
    expect(projetoResponsavel(saiu)).toBe("Fora da equipe ativa");
  });

  it("as seis concluídas: pronta para iniciar, com o início oficial da obra", () => {
    const r = projeto({ inicio_apos_aprovacao: "2026-10-21" }, etapas(6));
    expect(r.phase?.current).toBeNull();
    expect(r.verdict).toEqual({ verdict: "pronta", text: "Pronta para iniciar" });
    expect(r.officialStart).toBe("2026-10-21");
    expect(r.dueDate).toBeNull();
    expect(projetoEtapaInfo(r)).toEqual({ title: "Todas as etapas concluídas", progress: "6 de 6 concluídas", registered: true });
  });

  it("nada registrado: mostra a etapa antiga do Painel; sem ela, 'Etapas não registradas'", () => {
    const comAntiga = projeto({ etapa: "Medição" }, []);
    expect(comAntiga.phase?.registered).toBe(false);
    expect(comAntiga.verdict).toEqual({ verdict: "sem_prazo", text: "Sem prazo" });
    expect(projetoEtapaInfo(comAntiga)).toEqual({ title: "Medição", progress: null, registered: false });
    expect(projetoEtapaInfo(projeto({}, []))).toEqual({ title: "Etapas não registradas", progress: null, registered: false });
  });

  it("etapas desconhecidas (carregando ou falhou): estado neutro, sem 'sem prazo' nem 'não registradas'", () => {
    const r = buildProjetoRow(obra({ etapa: "Medição", is_project_phase: true }), TODAY);
    expect(r.phase).toBeNull();
    expect(r.verdict).toBeNull();
    expect(r.dueDate).toBeNull();
    expect(r.stepResponsible).toBeNull();
    expect(projetoEtapaInfo(r)).toEqual({ title: "Medição", progress: null, registered: false });
    expect(projetoEtapaInfo(buildProjetoRow(obra(), TODAY, { steps: undefined }))).toEqual({
      title: null,
      progress: null,
      registered: false,
    });
    // O que vem do cadastro da obra continua lá.
    expect(r.staleDays).toBe(0);
    expect(faseKeyOf(r)).toBe(FASE_DESCONHECIDA);
    expect(summarizeProjetos([r])).toBeNull();
    expect(projetosResumoText([r])).toBeNull();
  });

  it("ordem: atrasada (mais dias primeiro), vence logo, sem registro/sem prazo (mais parada), no prazo, pronta", () => {
    const rows = [
      projeto({ nome: "Pronta" }, etapas(6)),
      projeto({ nome: "No prazo longe" }, etapas(1, { due_date: "2026-11-20" })),
      projeto({ nome: "No prazo perto" }, etapas(1, { due_date: "2026-10-30" })),
      projeto({ nome: "Sem prazo recente", ultima_atualizacao: "2026-10-13T12:00:00Z" }, etapas(1)),
      projeto({ nome: "Sem registro parada", ultima_atualizacao: "2026-09-01T12:00:00Z" }, []),
      projeto({ nome: "Desconhecida", ultima_atualizacao: "2026-10-01T12:00:00Z" }),
      projeto({ nome: "Vence em 3" }, etapas(1, { due_date: "2026-10-17" })),
      projeto({ nome: "Vence hoje" }, etapas(1, { due_date: "2026-10-14" })),
      projeto({ nome: "Atrasada 2" }, etapas(1, { due_date: "2026-10-12" })),
      projeto({ nome: "Atrasada 10" }, etapas(1, { due_date: "2026-10-04" })),
    ];
    expect(sortProjetos(rows).map((r) => r.name)).toEqual([
      "Atrasada 10",
      "Atrasada 2",
      "Vence hoje",
      "Vence em 3",
      "Sem registro parada",
      "Desconhecida",
      "Sem prazo recente",
      "No prazo perto",
      "No prazo longe",
      "Pronta",
    ]);
  });

  it("empate na faixa: ordem alfabética", () => {
    const rows = [
      projeto({ nome: "B" }, etapas(1, { due_date: "2026-10-10" })),
      projeto({ nome: "A" }, etapas(2, { due_date: "2026-10-10" })),
      projeto({ nome: "D" }, etapas(6)),
      projeto({ nome: "C" }, etapas(6)),
    ];
    expect(sortProjetos(rows).map((r) => r.name)).toEqual(["A", "B", "C", "D"]);
  });

  it("busca acha pela etapa atual e pelo responsável da etapa", () => {
    const rows = [
      projeto({ id: "a", nome: "Loft Itaim", etapa: "Projeto 3D" }, etapas(3, { responsible_user_id: "u1" }), equipe),
      projeto({ id: "b", nome: "Studio Pinheiros", etapa: "Condomínio" }, []),
      projeto({ id: "c", nome: "Casa Perdizes" }, etapas(6)),
    ];
    const ids = (q: string) => searchProjetos(rows, q).map((r) => r.id);
    expect(ids("art/rrt")).toEqual(["a"]); // nome completo da etapa atual
    expect(ids("emissao")).toEqual(["a"]);
    expect(ids("bruna")).toEqual(["a"]);
    // Com etapas registradas, a etapa antiga do Painel não aparece na linha nem é achada.
    expect(ids("projeto 3d")).toEqual([]);
    // Sem etapa registrada, vale a etapa antiga.
    expect(ids("condominio")).toEqual(["b"]);
    expect(ids("pronta")).toEqual(["c"]);
    expect(ids(" ")).toEqual(["a", "b", "c"]);
  });

  it("resumo acima da lista: só as partes que não são zero", () => {
    const rows = [
      projeto({}, etapas(1, { due_date: "2026-10-10" })),
      projeto({}, etapas(1, { due_date: "2026-10-01" })),
      projeto({}, etapas(1, { due_date: "2026-10-15" })),
      projeto({}, etapas(2)),
      projeto({}, []),
      projeto({}, etapas(1, { due_date: "2026-12-01" })),
      projeto({}, etapas(6)),
    ];
    expect(summarizeProjetos(rows)).toEqual({ late: 2, dueSoon: 1, noDeadline: 2 });
    expect(projetosResumoText(rows)).toBe("2 com etapa atrasada · 1 vence em até 3 dias · 2 sem prazo");
    expect(projetosResumoText(rows.slice(2, 4))).toBe("1 vence em até 3 dias · 1 sem prazo");
    expect(
      projetosResumoText([projeto({}, etapas(1, { due_date: "2026-10-15" })), projeto({}, etapas(1, { due_date: "2026-10-16" }))]),
    ).toBe("2 vencem em até 3 dias");
    // Tudo no prazo ou pronto: não há o que avisar.
    expect(projetosResumoText(rows.slice(5))).toBeNull();
    expect(projetosResumoText([])).toBeNull();
  });

  it("situação de uma etapa em aberto (lista da gaveta)", () => {
    const state = phaseState(
      [etapa("projeto_3d", { done_at: "2026-10-01", due_date: "2026-09-20" }), etapa("emissao_art", { due_date: "2026-10-12" })],
      TODAY,
    );
    const de = (key: PhaseStepKey) => {
      const step = state.steps.find((s) => s.key === key);
      return step ? stepVerdict(step) : undefined;
    };
    expect(de("projeto_3d")).toBeNull(); // concluída
    // Etapa futura com prazo vencido aparece atrasada na lista, mesmo sem ser a atual.
    expect(de("emissao_art")).toEqual({ verdict: "atrasada", text: "Atrasada há 2 dias" });
    expect(de("projeto_executivo")).toEqual({ verdict: "sem_prazo", text: "Sem prazo" });
  });
});

describe("concluídas", () => {
  it("entregue ou encerrada conta como concluída", () => {
    expect(isObraConcluida(deadline())).toBe(false);
    expect(isObraConcluida(deadline({ actual_end_date: "2026-09-28" }))).toBe(true);
    expect(isObraConcluida(deadline({ status: "completed" }))).toBe(true);
    expect(isObraConcluida(deadline({ project_id: null, status: "completed" }))).toBe(false);
  });

  it("no prazo", () => {
    const r = buildConcluidaRow(deadline({ actual_end_date: "2026-09-28" }), obra());
    expect(r).toMatchObject({ resultado: "no_prazo", lateDays: 0, penalty: null, name: "Ap. 1204 Vila Mariana" });
    expect(resultadoLabel(r)).toBe("No prazo");
  });

  it("atrasada, com a multa apurada", () => {
    const r = buildConcluidaRow(
      deadline({ actual_end_date: "2026-10-07", business_days_late: 5, penalty_accrued_value: 2500 }),
      undefined,
    );
    expect(r).toMatchObject({ resultado: "atrasada", lateDays: 5, penalty: 2500, name: "Apto 142" });
    expect(resultadoLabel(r)).toBe("5 dias úteis de atraso");
    expect(resultadoLabel({ resultado: "atrasada", lateDays: 1 })).toBe("1 dia útil de atraso");
  });

  it("sem prazo no contrato ou sem data de entrega: não dá veredito", () => {
    const semPrazo = buildConcluidaRow(deadline({ current_deadline: null, actual_end_date: "2026-10-07", business_days_late: 5 }), obra());
    expect(semPrazo).toMatchObject({ resultado: "sem_prazo", lateDays: 0, penalty: null });
    expect(resultadoLabel(semPrazo)).toBe("Sem prazo cadastrado");
    const semEntrega = buildConcluidaRow(deadline({ status: "completed" }), obra());
    expect(semEntrega).toMatchObject({ resultado: "sem_entrega", lateDays: 0, penalty: null });
    expect(resultadoLabel(semEntrega)).toBe("Sem data de entrega");
  });

  it("a mais recente primeiro; sem data de entrega no fim", () => {
    const c = (name: string, deliveredOn: string | null) => ({ name, deliveredOn }) as ReturnType<typeof buildConcluidaRow>;
    expect(sortConcluidas([c("A", "2026-08-01"), c("B", null), c("C", "2026-10-01")]).map((r) => r.name)).toEqual(["C", "A", "B"]);
  });
});

describe("agrupar por etapa", () => {
  const items = [
    { id: "1", etapa: "Execução" as const },
    { id: "2", etapa: null },
    { id: "3", etapa: "Planejamento" as const },
    { id: "4", etapa: "Execução" as const },
  ];

  it("ordem do ciclo da obra, com 'Sem etapa' primeiro e sem grupos vazios", () => {
    const g = groupByEtapa(items, (i) => i.etapa);
    expect(g.map((x) => [x.label, x.items.map((i) => i.id)])).toEqual([
      ["Sem etapa", ["2"]],
      ["Planejamento", ["3"]],
      ["Execução", ["1", "4"]],
    ]);
    expect(g[0].key).toBe(SEM_ETAPA);
  });

  it("kanban: as etapas da lista aparecem mesmo vazias; 'Sem etapa' some quando vazia", () => {
    const g = groupByEtapa(items.filter((i) => i.etapa), (i) => i.etapa, KANBAN_ETAPAS.execucao);
    expect(g.map((x) => x.label)).toEqual(["Planejamento", "Mobilização", "Execução", "Vistoria", "Vistoria reprovada", "Finalizada"]);
    expect(g.find((x) => x.label === "Vistoria")?.items).toEqual([]);
  });

  it("obra numa etapa fora da lista ganha a própria coluna", () => {
    const g = groupByEtapa([{ etapa: "Medição" as const }], (i) => i.etapa, KANBAN_ETAPAS.execucao);
    expect(g.map((x) => x.label)).toContain("Medição");
  });
});

describe("agrupar pela fase de projeto (board e kanban de Projetos)", () => {
  const rows = [
    projeto({ id: "medicao" }, etapas(2)),
    projeto({ id: "sem-registro" }, []),
    projeto({ id: "pronta" }, etapas(6)),
    projeto({ id: "3d" }, [etapa("projeto_3d", { due_date: "2026-10-20" })]),
    projeto({ id: "medicao-2" }, etapas(2, { due_date: "2026-10-20" })),
  ];

  it("chave de cada obra", () => {
    expect(rows.map(faseKeyOf)).toEqual(["medicao_fina", FASE_SEM_REGISTRO, FASE_PRONTA, "projeto_3d", "medicao_fina"]);
    expect(isPhaseStepKey("medicao_fina")).toBe(true);
    expect(isPhaseStepKey(FASE_PRONTA)).toBe(false);
    expect(isPhaseStepKey(FASE_SEM_REGISTRO)).toBe(false);
  });

  it("board: 'Sem etapa registrada' primeiro, depois a ordem do fluxo, sem grupos vazios", () => {
    const g = groupByFase(rows);
    expect(g.map((x) => [x.label, x.items.map((i) => i.id)])).toEqual([
      ["Sem etapa registrada", ["sem-registro"]],
      ["Projeto 3D", ["3d"]],
      ["Medição fina in loco", ["medicao", "medicao-2"]],
      ["Pronta para iniciar", ["pronta"]],
    ]);
  });

  it("kanban: as seis etapas e 'Pronta para iniciar' sempre; 'Sem etapa registrada' só com itens", () => {
    const g = groupByFase(rows.filter((r) => r.id !== "sem-registro"), { always: true });
    expect(g.map((x) => x.label)).toEqual([...PHASE_STEPS.map((s) => s.label), "Pronta para iniciar"]);
    expect(g.find((x) => x.key === "emissao_art")?.items).toEqual([]);
    expect(groupByFase(rows, { always: true })[0].key).toBe(FASE_SEM_REGISTRO);
    expect(groupByFase([], { always: true })).toHaveLength(7);
  });

  it("etapas desconhecidas ficam num grupo à parte, nunca em 'Sem etapa registrada'", () => {
    const g = groupByFase([buildProjetoRow(obra({ id: "x", is_project_phase: true }), TODAY), ...rows]);
    expect(g[0]).toMatchObject({ key: FASE_DESCONHECIDA, label: "Etapas não carregadas" });
    expect(g[0].items.map((i) => i.id)).toEqual(["x"]);
    expect(g[1].items.map((i) => i.id)).toEqual(["sem-registro"]);
  });

  it("aprovação do condomínio registrada (mesmo fora de ordem) trava o arrasto", () => {
    expect(aprovacaoRegistrada(projeto({}, etapas(6)))).toBe(true);
    expect(aprovacaoRegistrada(projeto({}, [etapa("aprovacao_condominio", { done_at: "2026-10-09" })]))).toBe(true);
    expect(aprovacaoRegistrada(projeto({}, etapas(5)))).toBe(false);
    expect(aprovacaoRegistrada(buildProjetoRow(obra(), TODAY))).toBe(false);
  });
});

describe("mover de etapa na tela (o que a RPC faz, antes de o banco responder)", () => {
  const nova = (step: PhaseStepKey) => etapa(step);
  const resumo = (rows: PhaseStepRow[]) => rows.map((r) => [r.step, r.done_at]);

  it("conclui as anteriores hoje (sem mexer em quem já tinha data) e reabre a etapa e as seguintes", () => {
    const antes = [
      etapa("projeto_3d", { done_at: "2026-09-20" }),
      etapa("medicao_fina", { done_at: "2026-10-02", due_date: "2026-10-01", responsible_user_id: "u1" }),
      etapa("solicitacao_aprovacao", { done_at: "2026-10-05" }),
      etapa("aprovacao_condominio", { due_date: "2026-11-01" }),
    ];
    const depois = moveStepsLocally(antes, "medicao_fina", TODAY, nova);
    expect(resumo(depois)).toEqual([
      ["projeto_3d", "2026-09-20"],
      ["projeto_executivo", TODAY],
      ["medicao_fina", null],
      ["solicitacao_aprovacao", null],
      ["aprovacao_condominio", null],
    ]);
    // Prazo e responsável das etapas não mudam.
    expect(depois.find((r) => r.step === "medicao_fina")).toMatchObject({ due_date: "2026-10-01", responsible_user_id: "u1" });
    expect(phaseState(depois, TODAY).current?.key).toBe("medicao_fina");
    // As linhas de entrada não são alteradas.
    expect(antes[1].done_at).toBe("2026-10-02");
  });

  it("obra nunca registrada posicionada na primeira etapa passa a ter etapa registrada", () => {
    const depois = moveStepsLocally([], "projeto_3d", TODAY, nova);
    expect(resumo(depois)).toEqual([["projeto_3d", null]]);
    expect(phaseState(depois, TODAY)).toMatchObject({ registered: true, doneCount: 0 });
  });

  it("obra nunca registrada posicionada mais adiante", () => {
    const depois = moveStepsLocally([], "emissao_art", TODAY, nova);
    expect(resumo(depois)).toEqual([
      ["projeto_3d", TODAY],
      ["projeto_executivo", TODAY],
      ["medicao_fina", TODAY],
      ["emissao_art", null],
    ]);
    expect(phaseState(depois, TODAY).current?.key).toBe("emissao_art");
  });
});
