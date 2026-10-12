/**
 * Painel de Obras reformulado: resumo do topo, ordem por risco, "minhas",
 * semana, e — para o escritório — busca, listas Projetos/Concluídas, visões
 * Board/Kanban e a gaveta da obra. Em Projetos: etapa da fase de projeto,
 * situação do prazo, resumo acima da lista, colunas por etapa e o que
 * acontece ao soltar um cartão.
 * Os dados vêm mockados já calculados; as regras estão em obrasPainel.test.ts
 * e painelNovo.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ObraRow } from "@/lib/obrasPainel";
import { buildProjetoRow, type ConcluidaRow, type ProjetoRow } from "@/lib/painelNovo";
import { PHASE_STEPS, type PhaseStepRow } from "@/lib/faseProjeto";
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
  canEditPhase: true,
  updateObra: vi.fn(),
  toastSuccess: vi.fn(),
  phaseStatus: "ok" as "ok" | "loading" | "error",
  refetchPhase: vi.fn(),
  moveToPhaseStep: vi.fn(),
  phaseSteps: [] as unknown[],
  savePhase: vi.fn(),
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
      phaseStatus: h.phaseStatus,
      refetchPhase: h.refetchPhase,
      moveToPhaseStep: h.moveToPhaseStep,
      isLoading: h.loading,
      error: h.error,
      refetch: vi.fn(),
    };
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "eu" } }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => h.mobile }));
vi.mock("@/hooks/useMenuMode", () => ({ useMenuMode: () => ({ isSimple: h.simple }) }));
vi.mock("@/hooks/useCan", () => ({
  useCan: () => ({ can: (feature: string) => (feature === "projectPhase:edit" ? h.canEditPhase : h.canEdit) }),
}));
// A gaveta lê e grava as etapas da obra aberta (regras em FaseProjetoSection.test.tsx).
vi.mock("@/hooks/useProjectPhase", () => ({
  useProjectPhaseSteps: () => ({ data: h.phaseSteps, isError: false, isLoading: false, isFetching: false, refetch: vi.fn() }),
  useSaveProjectPhaseStep: () => ({ mutateAsync: h.savePhase, isPending: false }),
}));
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

/** Hoje das linhas de projeto (as regras de data estão em painelNovo.test.ts). */
const HOJE = "2026-10-14";

/** As `n` primeiras etapas concluídas e a seguinte com o que for passado. */
function etapas(n: number, atual: Partial<PhaseStepRow> | null = null): PhaseStepRow[] {
  const base = { due_date: null, responsible_user_id: null, notes: null };
  const rows: PhaseStepRow[] = PHASE_STEPS.slice(0, n).map((s) => ({ ...base, step: s.key, done_at: "2026-10-01" }));
  if (atual && n < PHASE_STEPS.length) rows.push({ ...base, step: PHASE_STEPS[n].key, done_at: null, ...atual });
  return rows;
}

/**
 * Linha de uma obra em fase de projeto, calculada como o hook faz.
 * `steps`: linhas de project_phase_steps; [] = nada registrado; null = não se sabe.
 */
const projeto = (p: Partial<PainelObra> = {}, steps: PhaseStepRow[] | null = []): ProjetoRow =>
  buildProjetoRow(
    cadastro({
      id: "p",
      nome: "Loft Itaim",
      customer_name: "Bruno",
      etapa: "Projeto 3D",
      inicio_etapa: "2026-10-06",
      // Meio-dia UTC: mesmo dia de calendário em São Paulo e em UTC.
      ultima_atualizacao: "2026-09-24T12:00:00Z",
      is_project_phase: true,
      ...p,
    }),
    HOJE,
    { steps, staffNames: new Map([["u1", "Bruna"], ["eu", "Eu Mesma"]]) },
  );

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
    h.canEditPhase = true;
    h.updateObra.mockReset().mockResolvedValue(undefined);
    h.toastSuccess.mockReset();
    h.phaseStatus = "ok";
    h.refetchPhase.mockReset();
    h.moveToPhaseStep.mockReset().mockResolvedValue(undefined);
    h.phaseSteps = [];
    h.savePhase.mockReset().mockResolvedValue({});
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
    h.projetos = [projeto()];
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

    it("fechamento de semana: PPC da semana anterior e quem não fechou", () => {
      window.localStorage.setItem("bwild.obras.escopo", "todas");
      h.rows = [
        mk({ id: "a", name: "Ap. 1204 Vila Mariana", week: { ...base.week, previous: { ppc: 75, pending: false } } }),
        mk({ id: "b", name: "Studio Pinheiros", week: { ...base.week, previous: { ppc: null, pending: true } } }),
        mk({ id: "c", name: "Loft Itaim", week: { ...base.week, ppc: 80, previous: { ppc: 60, pending: false } } }),
        mk({ id: "d", name: "Casa Perdizes" }),
      ];
      renderPage();
      expect(within(screen.getByRole("row", { name: /Ap\. 1204/ })).getByText("Anterior: PPC 75%")).toBeInTheDocument();
      expect(within(screen.getByRole("row", { name: /Studio Pinheiros/ })).getByText("Anterior sem fechar")).toBeInTheDocument();
      // Semana já fechada: mostra o PPC dela, não o da anterior.
      const fechada = screen.getByRole("row", { name: /Loft Itaim/ });
      expect(within(fechada).getByText("Fechada · PPC 80%")).toBeInTheDocument();
      expect(within(fechada).queryByText(/Anterior/)).toBeNull();
      expect(within(screen.getByRole("row", { name: /Casa Perdizes/ })).queryByText(/PPC|sem fechar/)).toBeNull();
      expect(screen.getByText("1 sem fechar a semana anterior")).toBeInTheDocument();
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

    it("Projetos sem etapa registrada: etapa antiga e há quanto tempo está parado; sem a linha da semana", () => {
      renderPage();
      fireEvent.click(screen.getByRole("radio", { name: "Projetos (1)" }));
      expect(onde()).toContain("fase=projetos");
      const linha = screen.getByRole("row", { name: /Loft Itaim/ });
      expect(within(linha).getByText("Projeto 3D")).toBeInTheDocument();
      expect(within(linha).getByText("Etapas não registradas · há 20 dias sem atualização")).toBeInTheDocument();
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

    describe("Projetos: fase de projeto", () => {
      const dataTransfer = () => {
        const store = new Map<string, string>();
        return {
          setData: (k: string, v: string) => store.set(k, v),
          getData: (k: string) => store.get(k) ?? "",
          effectAllowed: "",
          dropEffect: "",
        };
      };
      /** Arrasta o cartão para a coluna; devolve se a coluna aceitou o arrasto. */
      const arrastar = (cartao: RegExp, coluna: string) => {
        const dt = dataTransfer();
        fireEvent.dragStart(screen.getByRole("button", { name: cartao }), { dataTransfer: dt });
        const aceita = !fireEvent.dragOver(screen.getByRole("region", { name: coluna }), { dataTransfer: dt });
        fireEvent.drop(screen.getByRole("region", { name: coluna }), { dataTransfer: dt });
        return aceita;
      };

      beforeEach(() => {
        h.projetos = [
          projeto({ id: "p", nome: "Loft Itaim" }, etapas(2, { due_date: "2026-10-10", responsible_user_id: "u1" })),
          projeto({ id: "q", nome: "Studio Lapa", customer_name: "Ana" }, etapas(1, { due_date: "2026-10-15" })),
          projeto({ id: "r", nome: "Ap. Moema", customer_name: null, etapa: null }, []),
          projeto({ id: "s", nome: "Casa Perdizes", customer_name: null, inicio_apos_aprovacao: "2026-10-21" }, etapas(6)),
        ];
        for (const r of h.projetos as ProjetoRow[]) {
          h.obras.set(r.id, cadastro({ id: r.id, nome: r.name, etapa: r.etapa, is_project_phase: true, inicio_apos_aprovacao: r.officialStart }));
        }
      });

      it("linha: etapa atual com o avanço, situação em texto, prazo e responsável da etapa", () => {
        renderPage("?fase=projetos");
        const linha = screen.getByRole("row", { name: /Loft Itaim/ });
        expect(within(linha).getByText("Medição fina in loco")).toBeInTheDocument();
        expect(within(linha).getByText("2 de 6 concluídas")).toBeInTheDocument();
        expect(within(linha).getByText("Atrasada há 4 dias")).toBeInTheDocument();
        expect(within(linha).getByText("10/10/26")).toBeInTheDocument();
        expect(within(linha).getByText("Bruna")).toBeInTheDocument();
        const pronta = screen.getByRole("row", { name: /Casa Perdizes/ });
        expect(within(pronta).getByText("Pronta para iniciar")).toBeInTheDocument();
        expect(within(pronta).getByText("Início oficial: 21/10/2026 (5 dias úteis após a aprovação)")).toBeInTheDocument();
      });

      it("resumo acima da lista, que não muda com a busca", () => {
        renderPage("?fase=projetos");
        const resumo = "1 com etapa atrasada · 1 vence em até 3 dias · 1 sem prazo";
        expect(screen.getByText(resumo)).toBeInTheDocument();
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "medicao" } });
        expect(screen.getAllByRole("row")).toHaveLength(2); // cabeçalho + Loft Itaim (pela etapa atual)
        expect(screen.getByRole("row", { name: /Loft Itaim/ })).toBeInTheDocument();
        expect(screen.getByText(resumo)).toBeInTheDocument();
        // O resumo é da lista de Projetos; não aparece em execução.
        fireEvent.click(screen.getByRole("radio", { name: "Em execução (2)" }));
        expect(screen.queryByText(resumo)).toBeNull();
      });

      it("a busca acha pelo responsável da etapa", () => {
        renderPage("?fase=projetos");
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bruna" } });
        expect(screen.getByRole("row", { name: /Loft Itaim/ })).toBeInTheDocument();
        expect(screen.queryByRole("row", { name: /Studio Lapa/ })).toBeNull();
      });

      it("'Minhas' inclui a obra cuja etapa atual está comigo", () => {
        window.localStorage.clear();
        h.projetos = [
          projeto({ id: "p", nome: "Loft Itaim" }, etapas(2, { responsible_user_id: "eu" })),
          projeto({ id: "q", nome: "Studio Lapa" }, etapas(1, { responsible_user_id: "u1" })),
        ];
        renderPage("?fase=projetos");
        expect(screen.getByRole("radio", { name: "Minhas (1)" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByRole("row", { name: /Loft Itaim/ })).toBeInTheDocument();
        expect(screen.queryByRole("row", { name: /Studio Lapa/ })).toBeNull();
      });

      it("etapas ainda carregando: a lista aparece, neutra, sem resumo e sem acusar ninguém", () => {
        h.phaseStatus = "loading";
        h.projetos = [projeto({ id: "p" }, null), projeto({ id: "r", nome: "Ap. Moema", etapa: null }, null)];
        renderPage("?fase=projetos");
        const tabela = screen.getByRole("table");
        expect(within(tabela).getAllByRole("row")).toHaveLength(3);
        expect(tabela).not.toHaveTextContent(/Sem prazo|Etapas não registradas|concluídas/);
        expect(screen.queryByText(/sem prazo|com etapa atrasada/)).toBeNull();
        expect(screen.queryByText("Não deu para carregar as etapas da fase de projeto.")).toBeNull();
        expect(within(screen.getByRole("row", { name: /Loft Itaim/ })).getByText("Projeto 3D")).toBeInTheDocument();
      });

      it("leitura das etapas falhou: a lista continua, com o aviso e 'Tentar de novo'", () => {
        h.phaseStatus = "error";
        h.projetos = [projeto({ id: "p" }, null)];
        renderPage("?fase=projetos");
        expect(screen.getByRole("row", { name: /Loft Itaim/ })).toBeInTheDocument();
        expect(screen.getByRole("table")).not.toHaveTextContent(/Sem prazo|Etapas não registradas/);
        expect(screen.getByText("Não deu para carregar as etapas da fase de projeto.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
        expect(h.refetchPhase).toHaveBeenCalled();
        // O Painel inteiro não entra em erro por causa disso.
        expect(screen.queryByText("Não deu para carregar as obras")).toBeNull();
        expect(within(screen.getByLabelText("Resumo das obras")).getByText("Obras ativas").nextSibling).toHaveTextContent("2");
      });

      it("Board: 'Sem etapa registrada' primeiro, depois as etapas na ordem e 'Pronta para iniciar'", () => {
        renderPage("?fase=projetos&view=board");
        const grupos = screen.getAllByRole("button", { expanded: true }).map((b) => b.textContent);
        expect(grupos).toHaveLength(4);
        expect(grupos[0]).toMatch(/^Sem etapa registrada\s*1$/);
        expect(grupos[1]).toMatch(/^Projeto executivo\s*1$/);
        expect(grupos[2]).toMatch(/^Medição fina in loco\s*1.*1 atrasada$/);
        expect(grupos[3]).toMatch(/^Pronta para iniciar\s*1$/);
        expect(within(screen.getByRole("region", { name: "Medição fina in loco" })).getByText("Loft Itaim")).toBeInTheDocument();
      });

      it("Kanban: as seis etapas e 'Pronta para iniciar' sempre; 'Sem etapa registrada' só quando tem obra", () => {
        renderPage("?fase=projetos&view=kanban");
        const colunas = within(screen.getByRole("group", { name: "Obras por etapa da fase de projeto" }))
          .getAllByRole("region")
          .map((c) => c.getAttribute("aria-label"));
        expect(colunas).toEqual([
          "Sem etapa registrada: 1",
          "Projeto 3D: 0",
          "Projeto executivo: 1",
          "Medição fina in loco: 1",
          "Emissão da ART/RRT: 0",
          "Pedido de aprovação ao condomínio: 0",
          "Aprovação do condomínio recebida: 0",
          "Pronta para iniciar: 1",
        ]);
        const cartao = within(screen.getByRole("region", { name: "Medição fina in loco: 1" })).getByRole("button", { name: /Loft Itaim/ });
        expect(within(cartao).getByText("Atrasada há 4 dias")).toBeInTheDocument();
        expect(cartao).toHaveTextContent("Prazo 10/10/26");
        expect(cartao).toHaveTextContent("Bruna");
        expect(screen.getByRole("button", { name: /Casa Perdizes/ })).toHaveTextContent("Início oficial 21/10/2026");
      });

      it("Kanban sem obra sem registro: a coluna 'Sem etapa registrada' some", () => {
        h.projetos = (h.projetos as ProjetoRow[]).filter((r) => r.id !== "r");
        renderPage("?fase=projetos&view=kanban");
        expect(screen.queryByRole("region", { name: /Sem etapa registrada/ })).toBeNull();
        expect(screen.getAllByRole("region")).toHaveLength(7);
      });

      it("Kanban: soltar numa coluna de etapa posiciona a obra nela (e não mexe na etapa antiga do Painel)", async () => {
        renderPage("?fase=projetos&view=kanban");
        expect(arrastar(/Loft Itaim/, "Emissão da ART/RRT: 0")).toBe(true);
        expect(h.moveToPhaseStep).toHaveBeenCalledWith("p", "emissao_art");
        expect(h.updateObra).not.toHaveBeenCalled();
        await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Etapa: Emissão da ART/RRT"));
        expect(onde()).not.toContain("obra=");
      });

      it("Kanban: obra sem etapa registrada pode ser posicionada; a coluna dela não é destino", () => {
        renderPage("?fase=projetos&view=kanban");
        expect(arrastar(/Ap\. Moema/, "Projeto 3D: 0")).toBe(true);
        expect(h.moveToPhaseStep).toHaveBeenCalledWith("r", "projeto_3d");
        h.moveToPhaseStep.mockClear();
        expect(arrastar(/Loft Itaim/, "Sem etapa registrada: 1")).toBe(false);
        expect(h.moveToPhaseStep).not.toHaveBeenCalled();
      });

      it("Kanban: soltar em 'Pronta para iniciar' NÃO grava nada — abre a gaveta e diz por quê", () => {
        renderPage("?fase=projetos&view=kanban");
        expect(arrastar(/Loft Itaim/, "Pronta para iniciar: 1")).toBe(true);
        expect(h.moveToPhaseStep).not.toHaveBeenCalled();
        expect(h.updateObra).not.toHaveBeenCalled();
        expect(h.savePhase).not.toHaveBeenCalled();
        expect(h.toastSuccess).not.toHaveBeenCalled();

        expect(onde()).toContain("obra=p");
        const gaveta = screen.getByRole("dialog");
        expect(within(gaveta).getByRole("heading", { name: "Loft Itaim" })).toBeInTheDocument();
        const fase = within(gaveta).getByRole("region", { name: "Fase de projeto" });
        expect(within(fase).getByRole("status")).toHaveTextContent(/não grava nada.*dia em que a aprovação do condomínio chegou/);
        expect(within(fase).getByRole("group", { name: "Aprovação do condomínio recebida" })).toBeInTheDocument();
      });

      it("o aviso de 'Pronta para iniciar' é só daquela vez: abrir a obra de outro jeito não o repete", async () => {
        renderPage("?fase=projetos&view=kanban");
        arrastar(/Loft Itaim/, "Pronta para iniciar: 1");
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        await waitFor(() => expect(onde()).not.toContain("obra="));
        fireEvent.click(screen.getByRole("button", { name: /Loft Itaim/ }));
        expect(onde()).toContain("obra=p");
        expect(within(screen.getByRole("region", { name: "Fase de projeto" })).queryByRole("status")).toBeNull();
      });

      it("Kanban: obra com a aprovação do condomínio registrada não arrasta (reabrir é pela gaveta)", () => {
        renderPage("?fase=projetos&view=kanban");
        expect(screen.getByRole("button", { name: /Casa Perdizes/ })).toHaveAttribute("draggable", "false");
        expect(screen.getByRole("button", { name: /Loft Itaim/ })).toHaveAttribute("draggable", "true");
        arrastar(/Casa Perdizes/, "Projeto 3D: 0");
        expect(h.moveToPhaseStep).not.toHaveBeenCalled();
      });

      it("Kanban sem 'projectPhase:edit': cartões não arrastam, mesmo podendo editar o cadastro", () => {
        h.canEditPhase = false;
        renderPage("?fase=projetos&view=kanban");
        for (const c of within(screen.getByRole("group", { name: "Obras por etapa da fase de projeto" })).getAllByRole("button")) {
          expect(c).toHaveAttribute("draggable", "false");
        }
        expect(arrastar(/Loft Itaim/, "Emissão da ART/RRT: 0")).toBe(false);
        expect(h.moveToPhaseStep).not.toHaveBeenCalled();
      });

      it("Kanban com as etapas desconhecidas: cartões numa coluna neutra, sem arrastar", () => {
        h.phaseStatus = "loading";
        h.projetos = [projeto({ id: "p" }, null)];
        renderPage("?fase=projetos&view=kanban");
        const coluna = screen.getByRole("region", { name: "Etapas não carregadas: 1" });
        expect(within(coluna).getByRole("button", { name: /Loft Itaim/ })).toHaveAttribute("draggable", "false");
        expect(screen.queryByRole("region", { name: /Sem etapa registrada/ })).toBeNull();
        expect(coluna).not.toHaveTextContent(/Sem prazo/);
      });

      it("o Kanban em execução continua mudando a etapa do Painel", () => {
        renderPage("?view=kanban");
        arrastar(/Ap\. 1204/, "Vistoria: 0");
        expect(h.updateObra).toHaveBeenCalledWith("a", { etapa: "Vistoria" });
        expect(h.moveToPhaseStep).not.toHaveBeenCalled();
      });

      it("gaveta de obra em projeto: a seção 'Fase de projeto' no lugar do seletor de etapa", async () => {
        h.phaseSteps = etapas(2, { due_date: "2026-10-10" });
        renderPage("?fase=projetos&obra=p");
        const gaveta = screen.getByRole("dialog");
        const fase = within(gaveta).getByRole("region", { name: "Fase de projeto" });
        expect(within(fase).getAllByRole("group")).toHaveLength(6);
        expect(within(gaveta).queryByRole("combobox", { name: "Etapa" })).toBeNull();
        expect(within(gaveta).queryByRole("status")).toBeNull();

        const atual = within(fase).getByRole("group", { name: "Medição fina in loco" });
        fireEvent.click(within(atual).getByRole("button", { name: "Concluir" }));
        fireEvent.change(within(atual).getByLabelText("Data de conclusão"), { target: { value: "2026-10-09" } });
        fireEvent.click(within(atual).getByRole("button", { name: "Confirmar conclusão" }));
        await waitFor(() => expect(h.savePhase).toHaveBeenCalledWith({ project_id: "p", step: "medicao_fina", done_at: "2026-10-09" }));
      });

      it("gaveta sem 'projectPhase:edit': fase de projeto só leitura", () => {
        h.canEditPhase = false;
        renderPage("?fase=projetos&obra=p");
        const fase = within(screen.getByRole("dialog")).getByRole("region", { name: "Fase de projeto" });
        expect(within(fase).queryByRole("button")).toBeNull();
        expect(within(fase).getByText("Você não tem permissão para alterar a fase de projeto.")).toBeInTheDocument();
      });
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
