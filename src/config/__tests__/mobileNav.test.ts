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

describe("STAFF_NAV — fallback projectId entre Início/Atividades e Obras", () => {
  const PROJECT_ID = "proj-1";
  const LAST_ID = "proj-last";

  it("Início sempre aponta para /gestao/painel-obras (não usa fallback)", () => {
    const slot = findSlot(STAFF_NAV, "inicio");
    expect(
      slot.to({
        paths: projectPaths(PROJECT_ID),
        hasProject: true,
        projectId: PROJECT_ID,
      }),
    ).toBe("/gestao/painel-obras");
    expect(
      slot.to({
        paths: emptyPaths,
        hasProject: false,
        lastProjectId: LAST_ID,
      }),
    ).toBe("/gestao/painel-obras");
  });

  it("Atividades sempre aponta para /gestao/atividades (rota global)", () => {
    const slot = findSlot(STAFF_NAV, "atividades");
    expect(
      slot.to({
        paths: emptyPaths,
        hasProject: false,
        lastProjectId: LAST_ID,
      }),
    ).toBe("/gestao/atividades");
  });

  describe("Obras — regressão do bug original", () => {
    const slot = findSlot(STAFF_NAV, "obras");

    it("usa projectId da URL quando o usuário está em /obra/:id", () => {
      expect(
        slot.to({
          paths: projectPaths(PROJECT_ID),
          hasProject: true,
          projectId: PROJECT_ID,
        }),
      ).toBe(`/obra/${PROJECT_ID}`);
    });

    it("fluxo completo: Obra → Início → Obras volta para a mesma obra", () => {
      // 1) Usuário entra direto em /obra/proj-1 (projectId presente)
      const step1 = slot.to({
        paths: projectPaths(PROJECT_ID),
        hasProject: true,
        projectId: PROJECT_ID,
      });
      expect(step1).toBe(`/obra/${PROJECT_ID}`);

      // 2) Clica em Início → navega para /gestao/painel-obras. A partir daí
      //    `projectId` (vindo de useParams) é undefined, mas a memória
      //    `lastProjectId` foi atualizada para "proj-1".
      const step2 = slot.to({
        paths: emptyPaths,
        hasProject: false,
        projectId: undefined,
        lastProjectId: PROJECT_ID,
      });

      // 3) Clica em Obras → deve voltar para /obra/proj-1, NÃO para o
      //    painel global. Esta é a asserção que blinda o bug.
      expect(step2).toBe(`/obra/${PROJECT_ID}`);
    });

    it("primeira sessão (sem memória nem URL): cai no painel global", () => {
      expect(
        slot.to({
          paths: emptyPaths,
          hasProject: false,
          projectId: undefined,
          lastProjectId: undefined,
        }),
      ).toBe("/gestao/painel-obras");
    });

    it("URL atual tem prioridade sobre a memória (obras diferentes)", () => {
      // Cenário: usuário está em /obra/proj-1, mas a memória ainda guarda
      // /obra/proj-last (residual). O slot deve respeitar a URL atual.
      expect(
        slot.to({
          paths: projectPaths(PROJECT_ID),
          hasProject: true,
          projectId: PROJECT_ID,
          lastProjectId: LAST_ID,
        }),
      ).toBe(`/obra/${PROJECT_ID}`);
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
