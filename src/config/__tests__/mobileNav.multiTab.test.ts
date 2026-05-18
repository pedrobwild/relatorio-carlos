import { describe, it, expect, beforeEach } from "vitest";
import {
  rememberLastProjectId,
  getLastProjectId,
} from "@/lib/lastProjectMemory";
import { CLIENT_NAV, STAFF_NAV } from "@/config/mobileNav";

/**
 * Cenário multi-aba (duas obras abertas simultaneamente).
 *
 * Contrato esperado:
 * - `localStorage` é compartilhado entre abas, então a memória global
 *   `lastProjectId` reflete sempre o último write (a aba mais recente vence).
 * - Mas em cada aba o slot.to recebe `projectId` vindo da URL daquela aba.
 *   Como a regra é "URL > memória", o link "Obra/Obras" da aba ativa deve
 *   apontar para a obra daquela aba — nunca cruzar para a outra obra,
 *   independente de qual gravou a memória por último.
 */

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

const projectPaths = (id: string) => ({
  ...emptyPaths,
  financeiro: `/obra/${id}/financeiro`,
  pendencias: `/obra/${id}/pendencias`,
  documentos: `/obra/${id}/documentos`,
  formalizacoes: `/obra/${id}/formalizacoes`,
});

/**
 * Simula uma aba do navegador: cada aba tem sua própria URL (`projectId`)
 * e lê a memória compartilhada (`localStorage`) no momento da renderização.
 * Em React real esse snapshot vive em `useState(() => getLastProjectId())`.
 */
function openTab(projectId: string | undefined) {
  // 1) Snapshot da memória no momento em que a aba é carregada.
  const lastProjectIdSnapshot = getLastProjectId();
  // 2) Se a aba está em /obra/:id, o efeito grava o id (write-through).
  if (projectId) rememberLastProjectId(projectId);
  return {
    projectId,
    lastProjectId: lastProjectIdSnapshot,
  };
}

const obraSlotStaff = STAFF_NAV.find((s) => s.id === "obras")!;
const obraSlotClient = CLIENT_NAV.find((s) => s.id === "obra")!;

describe("Multi-aba: fallback de projectId entre obras diferentes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("staff: cada aba resolve 'Obras' para SUA obra (URL > memória compartilhada)", () => {
    // Aba A entra em /obra/A — grava A na memória.
    const tabA = openTab("proj-A");
    expect(getLastProjectId()).toBe("proj-A");

    // Aba B abre /obra/B — snapshot pegou "A", depois sobrescreve memória com B.
    const tabB = openTab("proj-B");
    expect(getLastProjectId()).toBe("proj-B");

    // Cada aba renderiza seu próprio link de "Obras" usando o contexto local.
    const linkFromA = obraSlotStaff.to({
      paths: projectPaths("proj-A"),
      hasProject: true,
      projectId: tabA.projectId,
      lastProjectId: tabA.lastProjectId,
    });
    const linkFromB = obraSlotStaff.to({
      paths: projectPaths("proj-B"),
      hasProject: true,
      projectId: tabB.projectId,
      lastProjectId: tabB.lastProjectId,
    });

    // Nenhuma aba "cruza" para a obra da outra: cada uma volta para si.
    expect(linkFromA).toBe("/obra/proj-A");
    expect(linkFromB).toBe("/obra/proj-B");
  });

  it("client: mesma garantia para o slot Obra do CLIENT_NAV", () => {
    const tabA = openTab("proj-A");
    const tabB = openTab("proj-B");

    expect(
      obraSlotClient.to({
        paths: projectPaths("proj-A"),
        hasProject: true,
        projectId: tabA.projectId,
        lastProjectId: tabA.lastProjectId,
      }),
    ).toBe("/obra/proj-A");
    expect(
      obraSlotClient.to({
        paths: projectPaths("proj-B"),
        hasProject: true,
        projectId: tabB.projectId,
        lastProjectId: tabB.lastProjectId,
      }),
    ).toBe("/obra/proj-B");
  });

  it("aba global (sem URL) usa a memória mais recente — é o trade-off aceitável", () => {
    // Aba A está em /obra/A; aba C está em /gestao/painel-obras (sem projectId).
    openTab("proj-A");
    const tabC = openTab(undefined); // snapshot pega "A"
    // Aba B então abre /obra/B e atualiza memória.
    openTab("proj-B");

    // O snapshot da aba C foi tirado antes de B existir, então ela ainda
    // aponta para A (estado consistente com o que o usuário viu por último
    // nessa aba). Documenta o comportamento esperado para evitar regressão.
    expect(
      obraSlotStaff.to({
        paths: emptyPaths,
        hasProject: false,
        projectId: undefined,
        lastProjectId: tabC.lastProjectId,
      }),
    ).toBe("/obra/proj-A");

    // E uma aba global "recém-aberta" (re-snapshot) pega a memória atual.
    const tabDFresh = openTab(undefined);
    expect(
      obraSlotStaff.to({
        paths: emptyPaths,
        hasProject: false,
        projectId: undefined,
        lastProjectId: tabDFresh.lastProjectId,
      }),
    ).toBe("/obra/proj-B");
  });

  it("aba sem URL nunca redireciona para uma obra que a memória não conhece", () => {
    // Estado inicial limpo: nenhuma aba visitou obra alguma.
    const tab = openTab(undefined);
    expect(
      obraSlotStaff.to({
        paths: emptyPaths,
        hasProject: false,
        projectId: undefined,
        lastProjectId: tab.lastProjectId,
      }),
    ).toBe("/gestao/painel-obras");
  });
});
