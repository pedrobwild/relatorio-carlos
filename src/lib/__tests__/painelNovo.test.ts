import { describe, it, expect } from "vitest";
import {
  buildConcluidaRow,
  buildProjetoRow,
  cadastroOf,
  groupByEtapa,
  isObraConcluida,
  KANBAN_ETAPAS,
  listaFromParams,
  relationshipFlag,
  resultadoLabel,
  searchConcluidas,
  searchObraRows,
  searchProjetos,
  SEM_ETAPA,
  sortConcluidas,
  sortProjetos,
  staleLabel,
  visaoFromParams,
  type ProjetoRow,
} from "../painelNovo";
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

  it("o mais parado primeiro; sem registro no topo", () => {
    const p = (name: string, staleDays: number | null) => ({ name, staleDays }) as ProjetoRow;
    expect(sortProjetos([p("B", 3), p("A", 30), p("D", null), p("C", 3)]).map((r) => r.name)).toEqual(["D", "A", "B", "C"]);
  });

  it("texto de há quanto tempo", () => {
    expect(staleLabel(null)).toBe("Sem registro");
    expect(staleLabel(0)).toBe("Hoje");
    expect(staleLabel(1)).toBe("Ontem");
    expect(staleLabel(12)).toBe("Há 12 dias");
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
