import { describe, it, expect } from "vitest";
import { CLIENT_NAV, STAFF_NAV } from "@/config/mobileNav";

/**
 * Estes testes blindam a regressão em que ao sair da rota /obra/:projectId
 * (clicando em Início/Atividades) o projectId virava undefined e o ícone
 * "Obra/Obras" voltava ao painel global em vez de retornar para a obra.
 *
 * A correção introduziu o fallback `lastProjectId` (persistido em
 * localStorage). Os slots devem priorizar `projectId` (URL) e, na ausência
 * dele, usar `lastProjectId` (memória).
 */

// Paths "vazios" — quando hasProject=false useProjectNavigation devolve
// rotas sem o prefixo /obra/:id. Os testes que validam o fallback usam
// hasProject=false para simular esse cenário (usuário fora da rota da obra).
const emptyPaths = {
  relatorio: "/relatorio",
  contrato: "/contrato",
  projeto3D: "/projeto-3d",
  executivo: "/executivo",
  financeiro: "/financeiro",
  pendencias: "/pendencias",
  documentos: "/documentos",
  formalizacoes: "/formalizacoes",
  formalizacoesNova: "/formalizacoes/nova",
  cronograma: "/cronograma",
  cronogramaInterno: "/cronograma-interno",
  compras: "/compras",
  comprasProdutos: "/compras/produtos",
  comprasPrestadores: "/compras/prestadores",
  vistorias: "/vistorias",
  jornada: "/jornada",
  dadosCliente: "/dados-cliente",
  atividades: "/atividades",
  naoConformidades: "/nao-conformidades",
  orcamento: "/orcamento",
  assessor: "/assessor",
} as const;

// Paths "completos" — simulam o estado em que o usuário está dentro de
// /obra/:id (projectId presente na URL).
const projectPaths = (id: string) => ({
  ...emptyPaths,
  relatorio: `/obra/${id}/relatorio`,
  financeiro: `/obra/${id}/financeiro`,
  pendencias: `/obra/${id}/pendencias`,
  documentos: `/obra/${id}/documentos`,
  formalizacoes: `/obra/${id}/formalizacoes`,
  cronograma: `/obra/${id}/cronograma`,
  cronogramaInterno: `/obra/${id}/cronograma-interno`,
  atividades: `/obra/${id}/atividades`,
});

const findSlot = (nav: typeof CLIENT_NAV, id: string) => {
  const slot = nav.find((s) => s.id === id);
  if (!slot) throw new Error(`slot "${id}" não encontrado`);
  return slot;
};

describe("CLIENT_NAV — fallback projectId", () => {
  const PROJECT_ID = "proj-1";
  const LAST_ID = "proj-last";

  it("Obra: usa projectId da URL quando disponível", () => {
    const slot = findSlot(CLIENT_NAV, "obra");
    expect(
      slot.to({
        paths: projectPaths(PROJECT_ID),
        hasProject: true,
        projectId: PROJECT_ID,
      }),
    ).toBe(`/obra/${PROJECT_ID}`);
  });

  it("Obra: cai para lastProjectId quando saímos da rota da obra", () => {
    const slot = findSlot(CLIENT_NAV, "obra");
    // Simula: usuário tocou em algum link global → projectId da URL sumiu
    // mas a memória ainda guarda a última obra visitada.
    expect(
      slot.to({
        paths: emptyPaths,
        hasProject: false,
        projectId: undefined,
        lastProjectId: LAST_ID,
      }),
    ).toBe(`/obra/${LAST_ID}`);
  });

  it("Obra: vai para /minhas-obras quando não há projectId nem memória", () => {
    const slot = findSlot(CLIENT_NAV, "obra");
    expect(
      slot.to({
        paths: emptyPaths,
        hasProject: false,
        projectId: undefined,
        lastProjectId: undefined,
      }),
    ).toBe("/minhas-obras");
  });

  it.each(["financeiro", "documentos", "formalizacoes"] as const)(
    "%s: aplica o mesmo fallback de projectId",
    (slotId) => {
      const slot = findSlot(CLIENT_NAV, slotId);
      // Com URL ativa
      expect(
        slot.to({
          paths: projectPaths(PROJECT_ID),
          hasProject: true,
          projectId: PROJECT_ID,
        }),
      ).toBe(`/obra/${PROJECT_ID}/${slotId}`);
      // Sem URL, com memória — deve voltar para a obra anterior
      expect(
        slot.to({
          paths: emptyPaths,
          hasProject: false,
          projectId: undefined,
          lastProjectId: LAST_ID,
        }),
      ).toBe(`/obra/${LAST_ID}/${slotId}`);
      // Sem URL e sem memória
      expect(
        slot.to({
          paths: emptyPaths,
          hasProject: false,
          projectId: undefined,
        }),
      ).toBe("/minhas-obras");
    },
  );
});

describe("STAFF_NAV: Hoje, Obras e Pendências", () => {
  const PROJECT_ID = "proj-1";
  const LAST_ID = "proj-last";

  it("tem só as três abas de link (o Registrar e o Perfil não são links)", () => {
    expect(STAFF_NAV.map((s) => s.id)).toEqual(["hoje", "obras", "pendencias"]);
  });

  it("Hoje sempre aponta para /gestao/hoje", () => {
    const slot = findSlot(STAFF_NAV, "hoje");
    expect(
      slot.to({ paths: projectPaths(PROJECT_ID), hasProject: true, projectId: PROJECT_ID }),
    ).toBe("/gestao/hoje");
    expect(
      slot.to({ paths: emptyPaths, hasProject: false, lastProjectId: LAST_ID }),
    ).toBe("/gestao/hoje");
  });

  describe("Obras sempre abre a lista de obras", () => {
    const slot = findSlot(STAFF_NAV, "obras");

    it("dentro de uma obra", () => {
      expect(
        slot.to({ paths: projectPaths(PROJECT_ID), hasProject: true, projectId: PROJECT_ID }),
      ).toBe("/gestao/painel-obras");
    });

    it("fora da obra, mesmo com uma obra recente na memória", () => {
      expect(
        slot.to({ paths: emptyPaths, hasProject: false, projectId: undefined, lastProjectId: LAST_ID }),
      ).toBe("/gestao/painel-obras");
    });

    it("primeira sessão (sem memória nem URL)", () => {
      expect(
        slot.to({ paths: emptyPaths, hasProject: false, projectId: undefined, lastProjectId: undefined }),
      ).toBe("/gestao/painel-obras");
    });
  });

  it("Pendências: também usa fallback de projectId", () => {
    const slot = findSlot(STAFF_NAV, "pendencias");
    // Dentro da obra
    expect(
      slot.to({
        paths: projectPaths(PROJECT_ID),
        hasProject: true,
        projectId: PROJECT_ID,
      }),
    ).toBe(`/obra/${PROJECT_ID}/pendencias`);
    // Fora da obra, com memória
    expect(
      slot.to({
        paths: emptyPaths,
        hasProject: false,
        projectId: undefined,
        lastProjectId: LAST_ID,
      }),
    ).toBe(`/obra/${LAST_ID}/pendencias`);
    // Sem nada → NCs globais
    expect(
      slot.to({
        paths: emptyPaths,
        hasProject: false,
      }),
    ).toBe("/gestao/nao-conformidades");
  });
});
