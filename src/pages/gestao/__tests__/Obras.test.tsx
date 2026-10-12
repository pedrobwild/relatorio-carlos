/**
 * Painel de Obras reformulado: resumo do topo, ordem por risco, "minhas",
 * semana, e — para o escritório — busca, listas Projetos/Concluídas, visões
 * Board/Kanban e a gaveta da obra.
 * Os dados vêm mockados já calculados; as regras estão em obrasPainel.test.ts
 * e painelNovo.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ObraRow } from "@/lib/obrasPainel";
import type { ConcluidaRow, ProjetoRow } from "@/lib/painelNovo";
import type { PainelObra } from "@/hooks/usePainelObras";

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  projetos: [] as unknown[],
  concluidas: [] as unknown[],
  obras: new Map<string, unknown>(),
  loading: false,
  error: null as string | null,
  lastWeek: null as { from: string; to: string } | null,
  mobile: false,
  simple: false,
  canEdit: true,
  updateObra: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useObrasPainel", () => ({
  useObrasPainel: (week: { from: string; to: string }) => {
    h.lastWeek = week;
    return {
      rows: h.rows,
      projetos: h.projetos,
      concluidas: h.concluidas,
      obraById: h.obras,
      deadlineById: new Map(),
      updateObra: h.updateObra,
      isUpdating: false,
      isLoading: h.loading,
      error: h.error,
      refetch: vi.fn(),
    };
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "eu" } }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => h.mobile }));
vi.mock("@/hooks/useMenuMode", () => ({ useMenuMode: () => ({ isSimple: h.simple }) }));
vi.mock("@/hooks/useCan", () => ({ useCan: () => ({ can: () => h.canEdit }) }));
vi.mock("@/hooks/useStaffUsers", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useStaffUsers")>()),
  useStaffUsers: () => ({ data: [] }),
}));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: vi.fn() } }));

import Obras, { PAINEL_ANTIGO_HREF } from "../Obras";

const base: ObraRow = {
  id: "x",
  name: "Obra",
  customer: null,
  responsibleId: null,
  responsible: null,
  deadline: "2026-11-27",
  projectedEnd: "2026-11-20",
  slack: 5,
  penalty: 0,
  progress: 50,
  consumed: 50,
  week: { stages: ["Pintura"], planned: 4, done: 1, notDone: 0, unplanned: false },
  alerts: [],
  risk: "verde",
};
const mk = (p: Partial<ObraRow>): ObraRow => ({ ...base, ...p });

const cadastro = (p: Partial<PainelObra>): PainelObra =>
  ({
    id: "a",
    nome: "Ap. 1204 Vila Mariana",
    customer_name: "Mariana Costa",
    engineer_name: null,
    inicio_oficial: null,
    entrega_oficial: null,
    inicio_real: null,
    entrega_real: null,
    etapa: "Execução",
    status: null,
    relacionamento: null,
    responsavel_id: null,
    responsavel_nome: null,
    ultima_atualizacao: "2026-10-01T12:00:00Z",
    is_project_phase: false,
    ...p,
  }) as PainelObra;

const projeto = (p: Partial<ProjetoRow>): ProjetoRow => ({
  id: "p",
  name: "Loft Itaim",
  customer: "Bruno",
  responsibleId: null,
  responsible: null,
  etapa: "Projeto 3D",
  staleDays: 20,
  daysInEtapa: 8,
  relationship: null,
  paused: false,
  ...p,
});

const concluida = (p: Partial<ConcluidaRow>): ConcluidaRow => ({
  id: "c",
  name: "Casa Alto de Pinheiros",
  customer: null,
  responsibleId: null,
  responsible: "Bruna",
  deadline: "2026-09-30",
  deliveredOn: "2026-10-07",
  resultado: "atrasada",
  lateDays: 5,
  penalty: 2500,
  ...p,
});

function Onde() {
  const l = useLocation();
  return <output data-testid="onde">{l.pathname + l.search}</output>;
}

const renderPage = (search = "") =>
  render(
    <MemoryRouter initialEntries={[`/gestao/painel-obras${search}`]}>
      <Obras />
      <Onde />
    </MemoryRouter>,
  );

const onde = () => screen.getByTestId("onde").textContent;

describe("Painel de Obras reformulado", () => {
  beforeEach(() => {
    window.localStorage.clear();
    h.loading = false;
    h.error = null;
    h.mobile = false;
    h.simple = false;
    h.canEdit = true;
    h.updateObra.mockReset().mockResolvedValue(undefined);
    h.toastSuccess.mockReset();
    h.rows = [
      mk({
        id: "a",
        name: "Ap. 1204 Vila Mariana",
        customer: "Mariana Costa",
        responsible: "Carlos",
        responsibleId: "eu",
        risk: "vermelho",
        slack: -4,
        penalty: 3600,
        cadastro: { etapa: "Execução", relationship: "Atrito", paused: false },
        week: { stages: ["Elétrica", "Gesso"], planned: 6, done: 2, notDone: 1, unplanned: false },
        alerts: [
          { kind: "multa", tone: "destructive", text: "R$ 3.600 de multa se nada mudar" },
          { kind: "material", tone: "warning", text: "Falta material: Disjuntores (qua)" },
          { kind: "etapa_atrasada", tone: "warning", text: "Elétrica atrasada 2 dias" },
        ],
      }),
      mk({
        id: "b",
        name: "Studio Pinheiros",
        responsible: "Ana",
        responsibleId: "outra",
        cadastro: { etapa: null, relationship: null, paused: false },
        week: { stages: ["Pintura"], planned: 0, done: 0, notDone: 0, unplanned: true },
      }),
    ];
    h.projetos = [projeto({})];
    h.concluidas = [concluida({})];
    h.obras = new Map([
      ["a", cadastro({})],
      ["b", cadastro({ id: "b", nome: "Studio Pinheiros", customer_name: null, etapa: null })],
      ["p", cadastro({ id: "p", nome: "Loft Itaim", etapa: "Projeto 3D", is_project_phase: true })],
    ]);
  });

  describe("o que todos veem", () => {
    it("mostra só três números no topo", () => {
      renderPage();
      const resumo = screen.getByLabelText("Resumo das obras");
      expect(within(resumo).getAllByRole("term")).toHaveLength(3);
      expect(within(resumo).getByText("Obras ativas").nextSibling).toHaveTextContent("1");
      expect(within(resumo).getByText("No vermelho").nextSibling).toHaveTextContent("1");
      expect(within(resumo).getByText("Multa projetada").nextSibling?.textContent?.replace(/\s/g, " ")).toMatch(/R\$\s?3\.600/);
    });

    it("abre em 'Minhas' quando sou responsável e permite ver todas", () => {
      renderPage();
      expect(screen.getByRole("radio", { name: "Minhas (1)" })).toHaveAttribute("aria-checked", "true");
      expect(screen.queryByText("Studio Pinheiros")).toBeNull();

      fireEvent.click(screen.getByRole("radio", { name: "Todas" }));
      expect(screen.getByText("Studio Pinheiros")).toBeInTheDocument();
      expect(window.localStorage.getItem("bwild.obras.escopo")).toBe("todas");
    });

    it("linha da obra: responsável, folga, semana e os avisos (dois, e quantos faltam)", () => {
      renderPage();
      const linha = screen.getByRole("row", { name: /Ap\. 1204/ });
      expect(within(linha).getByText("Carlos")).toBeInTheDocument();
      expect(within(linha).getByText("−4 dias")).toBeInTheDocument();
      expect(within(linha).getByText("Elétrica, Gesso")).toBeInTheDocument();
      expect(within(linha).getByText(/1 não feito/)).toBeInTheDocument();
      expect(within(linha).getByText("R$ 3.600 de multa se nada mudar")).toBeInTheDocument();
      expect(within(linha).getByText("+2 avisos")).toBeInTheDocument();
      expect(within(linha).getByText("Cliente: atrito")).toBeInTheDocument();
    });

    it("obra sem nada marcado na semana aparece como 'Não planejada'", () => {
      window.localStorage.setItem("bwild.obras.escopo", "todas");
      renderPage();
      const linha = screen.getByRole("row", { name: /Studio Pinheiros/ });
      expect(within(linha).getByText("Não planejada")).toBeInTheDocument();
      expect(screen.getByText("1 obra sem semana planejada")).toBeInTheDocument();
    });

    it("'Ver a semana seguinte' muda a semana consultada e volta", () => {
      renderPage();
      const atual = h.lastWeek!.from;
      fireEvent.click(screen.getByRole("button", { name: "Ver a semana seguinte" }));
      expect(h.lastWeek!.from > atual).toBe(true);
      expect(onde()).toContain("semana=proxima");

      fireEvent.click(screen.getByRole("button", { name: "Voltar à semana anterior" }));
      expect(h.lastWeek!.from).toBe(atual);
    });

    it("estado vazio quando não há obra em execução", () => {
      h.rows = [];
      renderPage();
      expect(screen.getByText("Nenhuma obra em execução")).toBeInTheDocument();
    });

    it("sem dados (erro) os números do topo ficam em branco, não em zero", () => {
      h.error = "Sem conexão";
      renderPage();
      const resumo = screen.getByLabelText("Resumo das obras");
      expect(within(resumo).getByText("Obras ativas").nextSibling).toHaveTextContent("–");
      expect(screen.getByText("Não deu para carregar as obras")).toBeInTheDocument();
    });

    it("tem o caminho para o painel antigo", () => {
      renderPage();
      expect(PAINEL_ANTIGO_HREF).toBe("/gestao/painel-obras?painel=antigo");
      expect(screen.getByRole("link", { name: "Abrir o painel antigo" })).toHaveAttribute("href", PAINEL_ANTIGO_HREF);
    });
  });

  describe("gestor de obra (menu simples)", () => {
    beforeEach(() => {
      h.simple = true;
    });

    it("vê só a lista em execução: sem busca, sem outras listas, sem visões, sem 'Nova obra'", () => {
      renderPage("?fase=projetos&view=kanban");
      expect(screen.queryByRole("radiogroup", { name: "Lista" })).toBeNull();
      expect(screen.queryByRole("radiogroup", { name: "Visão" })).toBeNull();
      expect(screen.queryByRole("searchbox")).toBeNull();
      expect(screen.queryByRole("link", { name: /Nova obra/ })).toBeNull();
      // Endereço de projetos/kanban não tira o gestor da lista dele.
      expect(screen.getByRole("row", { name: /Ap\. 1204/ })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Todas (2)" })).toBeInTheDocument();
    });

    it("o nome da obra leva à Semana dela", () => {
      renderPage();
      const link = within(screen.getByRole("row", { name: /Ap\. 1204/ })).getByRole("link", { name: /Ap\. 1204/ });
      expect(link.getAttribute("href")).toMatch(/^\/gestao\/semana\?obra=a&semana=\d{4}-\d{2}-\d{2}$/);
    });

    it("celular mostra cartões com link para a Semana", () => {
      h.mobile = true;
      renderPage();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.getByRole("link", { name: /Ap\. 1204/ }).getAttribute("href")).toContain("/gestao/semana?obra=a");
    });

    it("não abre a gaveta, mesmo com a obra no endereço", () => {
      renderPage("?obra=a");
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("escritório", () => {
    beforeEach(() => {
      window.localStorage.setItem("bwild.obras.escopo", "todas");
    });

    it("as três listas com a contagem, e 'Nova obra'", () => {
      renderPage();
      const listas = screen.getByRole("radiogroup", { name: "Lista" });
      expect(within(listas).getByRole("radio", { name: "Em execução (2)" })).toHaveAttribute("aria-checked", "true");
      expect(within(listas).getByRole("radio", { name: "Projetos (1)" })).toBeInTheDocument();
      expect(within(listas).getByRole("radio", { name: "Concluídas (1)" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Nova obra/ })).toHaveAttribute("href", "/gestao/nova-obra");
    });

    it("busca filtra a lista sem mexer nos números do topo", () => {
      renderPage();
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pinheiros" } });
      expect(screen.queryByRole("row", { name: /Ap\. 1204/ })).toBeNull();
      expect(screen.getByRole("row", { name: /Studio Pinheiros/ })).toBeInTheDocument();
      expect(within(screen.getByLabelText("Resumo das obras")).getByText("Obras ativas").nextSibling).toHaveTextContent("2");

      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
      expect(screen.getByText('Nada encontrado para "zzz"')).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
      expect(screen.getByRole("row", { name: /Ap\. 1204/ })).toBeInTheDocument();
    });

    it("Projetos: há quanto tempo está parado; sem a linha da semana", () => {
      renderPage();
      fireEvent.click(screen.getByRole("radio", { name: "Projetos (1)" }));
      expect(onde()).toContain("fase=projetos");
      const linha = screen.getByRole("row", { name: /Loft Itaim/ });
      expect(within(linha).getByText("Projeto 3D")).toBeInTheDocument();
      expect(within(linha).getByText("Há 20 dias")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ver a semana seguinte" })).toBeNull();
    });

    it("Concluídas: resultado contra o contrato; sem Board nem Kanban", () => {
      renderPage("?aba=concluidas&view=kanban");
      const linha = screen.getByRole("row", { name: /Casa Alto de Pinheiros/ });
      expect(within(linha).getByText("5 dias úteis de atraso")).toBeInTheDocument();
      expect(linha.textContent?.replace(/\s/g, " ")).toMatch(/R\$\s?2\.500/);
      expect(screen.queryByRole("radiogroup", { name: "Visão" })).toBeNull();
    });

    it("Board agrupa por etapa, com 'Sem etapa' primeiro", () => {
      renderPage();
      fireEvent.click(screen.getByRole("radio", { name: "Board" }));
      expect(onde()).toContain("view=board");
      const grupos = screen.getAllByRole("button", { expanded: true }).map((b) => b.textContent);
      expect(grupos[0]).toMatch(/^Sem etapa\s*1/);
      expect(grupos[1]).toMatch(/^Execução\s*1.*1 no vermelho/);
      expect(within(screen.getByRole("region", { name: "Execução" })).getByText("Ap. 1204 Vila Mariana")).toBeInTheDocument();
    });

    it("Kanban: colunas por etapa e o cartão com a situação", () => {
      renderPage("?view=kanban");
      const coluna = screen.getByRole("region", { name: "Execução: 1" });
      const cartao = within(coluna).getByRole("button", { name: /Ap\. 1204/ });
      expect(cartao).toHaveTextContent("−4 dias · entrega 27/11");
      expect(cartao).toHaveTextContent("R$ 3.600 de multa se nada mudar");
      expect(screen.getByRole("region", { name: "Vistoria: 0" })).toBeInTheDocument();
      // A linha da semana é da lista; no Kanban não aparece.
      expect(screen.queryByRole("button", { name: "Ver a semana seguinte" })).toBeNull();
    });

    it("Kanban: soltar o cartão em outra coluna muda a etapa", async () => {
      renderPage("?view=kanban");
      const cartao = screen.getByRole("button", { name: /Ap\. 1204/ });
      const store = new Map<string, string>();
      const dataTransfer = {
        setData: (k: string, v: string) => store.set(k, v),
        getData: (k: string) => store.get(k) ?? "",
        effectAllowed: "",
        dropEffect: "",
      };
      const destino = screen.getByRole("region", { name: "Vistoria: 0" });
      fireEvent.dragStart(cartao, { dataTransfer });
      // Sem preventDefault no dragover o navegador não deixa soltar.
      expect(fireEvent.dragOver(destino, { dataTransfer })).toBe(false);
      fireEvent.drop(destino, { dataTransfer });
      expect(h.updateObra).toHaveBeenCalledWith("a", { etapa: "Vistoria" });
      await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Etapa: Vistoria"));
    });

    it("Kanban: soltar na própria coluna não grava; Enter no cartão abre a gaveta", () => {
      renderPage("?view=kanban");
      const cartao = screen.getByRole("button", { name: /Ap\. 1204/ });
      const dataTransfer = { setData: vi.fn(), getData: () => "a", effectAllowed: "", dropEffect: "" };
      fireEvent.dragStart(cartao, { dataTransfer });
      fireEvent.drop(screen.getByRole("region", { name: "Execução: 1" }), { dataTransfer });
      expect(h.updateObra).not.toHaveBeenCalled();

      fireEvent.keyDown(cartao, { key: "Enter" });
      expect(onde()).toContain("obra=a");
    });

    it("os números do topo não mudam ao trocar de lista", () => {
      window.localStorage.clear(); // sem escolha explícita de escopo
      renderPage();
      const ativas = () => within(screen.getByLabelText("Resumo das obras")).getByText("Obras ativas").nextSibling;
      expect(ativas()).toHaveTextContent("1"); // só a minha
      fireEvent.click(screen.getByRole("radio", { name: "Projetos (1)" }));
      expect(screen.getByRole("row", { name: /Loft Itaim/ })).toBeInTheDocument(); // nenhum projeto meu → mostra todos
      expect(ativas()).toHaveTextContent("1");
    });

    it("Kanban sem permissão de edição: cartões não arrastam", () => {
      h.canEdit = false;
      renderPage("?view=kanban");
      expect(screen.getByRole("button", { name: /Ap\. 1204/ })).toHaveAttribute("draggable", "false");
    });

    it("clicar na obra abre a gaveta; a Semana continua a um clique na linha", () => {
      renderPage();
      const linha = screen.getByRole("row", { name: /Ap\. 1204/ });
      expect(within(linha).getByRole("link", { name: "Semana de Ap. 1204 Vila Mariana" }).getAttribute("href")).toContain(
        "/gestao/semana?obra=a",
      );
      fireEvent.click(within(linha).getByRole("button", { name: /Ap\. 1204/ }));
      expect(onde()).toContain("obra=a");
      const gaveta = screen.getByRole("dialog");
      expect(within(gaveta).getByRole("heading", { name: "Ap. 1204 Vila Mariana" })).toBeInTheDocument();
      expect(within(gaveta).getByRole("link", { name: /Planejar a semana/ }).getAttribute("href")).toContain("/gestao/semana?obra=a");
    });

    it("gaveta: marcar 'Obra paralisada' grava o status", async () => {
      renderPage("?obra=a");
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("switch", { name: "Obra paralisada" }));
      await waitFor(() => expect(h.updateObra).toHaveBeenCalledWith("a", { status: "Paralisada" }));
    });

    it("gaveta de obra que não existe avisa em vez de quebrar", () => {
      renderPage("?obra=nao-existe");
      expect(within(screen.getByRole("dialog")).getByText("Obra não encontrada")).toBeInTheDocument();
    });

    it("celular: cartões abrem a gaveta", () => {
      h.mobile = true;
      renderPage();
      expect(screen.queryByRole("table")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Ap\. 1204/ }));
      expect(onde()).toContain("obra=a");
    });
  });
});
