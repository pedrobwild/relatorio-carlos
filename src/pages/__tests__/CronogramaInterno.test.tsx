/**
 * Tela Cronograma interno: agrupamento por etapa, comparação com o
 * cronograma do cliente (datas e chips de entrega), atalhos de data real,
 * cópia do cliente (com confirmação ao substituir), exclusão com aviso da
 * Semana, reordenação e modo somente leitura.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const h = vi.hoisted(() => ({
  canEdit: true,
  items: [] as unknown[],
  client: [] as unknown[],
  opsCount: 0,
  listByProject: vi.fn(),
  listClientDates: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
  copyFromClient: vi.fn(),
  countOpsActivities: vi.fn(),
  getState: vi.fn(),
  customizedAt: "2026-10-20T15:00:00Z" as string | null,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/useCan", () => ({
  useCan: () => ({ can: (f: string) => (f === "internalSchedule:edit" ? h.canEdit : true), loading: false }),
}));
vi.mock("@/hooks/useStaffUsers", () => ({
  useStaffUsers: () => ({ data: [{ id: "u1", nome: "Ana Engenheira", email: "", perfil: "engineer" }] }),
}));
vi.mock("@/hooks/useFornecedoresPrestadores", () => ({
  useFornecedoresPrestadores: () => ({ data: [{ id: "f1", nome: "Elétrica Silva", categoria: null, status: "ativo" }] }),
}));
// Hoje fixo: quinta, 05/11/2026.
vi.mock("@/lib/hojeDia", async (orig) => ({
  ...(await orig<typeof import("@/lib/hojeDia")>()),
  todayISO: () => "2026-11-05",
}));
vi.mock("@/infra/repositories/internalSchedule.repository", () => ({
  internalScheduleRepo: {
    listByProject: h.listByProject,
    listClientDates: h.listClientDates,
    update: h.update,
    create: h.create,
    remove: h.remove,
    reorder: h.reorder,
    copyFromClient: h.copyFromClient,
    countOpsActivities: h.countOpsActivities,
    getState: h.getState,
  },
}));

import CronogramaInterno from "../CronogramaInterno";

type Item = {
  id: string;
  project_id: string;
  parent_id: string | null;
  client_activity_id: string | null;
  description: string;
  etapa: string | null;
  detailed_description: string | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  weight: number;
  sort_order: number;
  predecessor_ids: string[];
  responsible_user_id: string | null;
  fornecedor_id: string | null;
  notes: string | null;
  responsible: { id: string; nome: string } | null;
  fornecedor: { id: string; nome: string } | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

const it_ = (p: Partial<Item> & { id: string }): Item => ({
  project_id: "p1",
  parent_id: null,
  client_activity_id: null,
  description: p.id,
  etapa: null,
  detailed_description: null,
  planned_start: "2026-11-02",
  planned_end: "2026-11-06",
  actual_start: null,
  actual_end: null,
  weight: 10,
  sort_order: 0,
  predecessor_ids: [],
  responsible_user_id: null,
  fornecedor_id: null,
  notes: null,
  responsible: null,
  fornecedor: null,
  created_at: "",
  updated_at: "",
  created_by: null,
  updated_by: null,
  ...p,
});

const ok = <T,>(data: T) => Promise.resolve({ data, error: null });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/obra/p1/cronograma-interno"]}>
        <Routes>
          <Route path="/obra/:projectId/cronograma-interno" element={<CronogramaInterno />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const row = (id: string) => screen.getByTestId(`internal-item-${id}`);

beforeEach(() => {
  vi.clearAllMocks();
  h.canEdit = true;
  h.opsCount = 0;
  h.client = [
    { id: "c1", description: "Demolição", planned_start: "2026-11-02", planned_end: "2026-11-06", parent_activity_id: null },
    { id: "c2", description: "Elétrica", planned_start: "2026-11-03", planned_end: "2026-11-14", parent_activity_id: null },
  ];
  h.items = [
    it_({ id: "i1", description: "Demolição", etapa: "Preparação", client_activity_id: "c1", sort_order: 1 }),
    it_({
      id: "i2",
      description: "Elétrica",
      etapa: "Instalações",
      client_activity_id: "c2",
      planned_start: "2026-11-03",
      planned_end: "2026-11-20",
      actual_start: "2026-11-04",
      sort_order: 2,
      responsible_user_id: "u1",
      responsible: { id: "u1", nome: "Ana Engenheira" },
    }),
    it_({ id: "i2a", description: "Passar fiação", parent_id: "i2", etapa: "Instalações", sort_order: 3 }),
    it_({ id: "i3", description: "Limpeza extra", etapa: "Preparação", sort_order: 4 }),
  ];
  h.listByProject.mockImplementation(() => ok(h.items));
  h.listClientDates.mockImplementation(() => ok(h.client));
  h.update.mockImplementation((id: string, patch: object) => ok({ id, ...patch }));
  h.create.mockImplementation(() => ok({ id: "new" }));
  h.remove.mockImplementation(() => ok(null));
  h.reorder.mockImplementation(() => ok(null));
  h.copyFromClient.mockImplementation(() => ok(2));
  h.countOpsActivities.mockImplementation(() => ok(h.opsCount));
  h.customizedAt = "2026-10-20T15:00:00Z";
  h.getState.mockImplementation(() => ok({ project_id: "p1", customized_at: h.customizedAt, customized_by: "u1" }));
});

describe("Cronograma interno", () => {
  it("agrupa por etapa na ordem do cronograma, com micro-etapas embaixo do item", async () => {
    renderPage();
    const prep = await screen.findByRole("region", { name: "Preparação" });
    const inst = screen.getByRole("region", { name: "Instalações" });
    expect(within(prep).getByText("Demolição")).toBeInTheDocument();
    expect(within(prep).getByText("Limpeza extra")).toBeInTheDocument();
    expect(within(inst).getByText("Elétrica")).toBeInTheDocument();
    expect(within(inst).getByText("Passar fiação")).toBeInTheDocument();
    expect(within(inst).getByText("Micro-etapa:")).toBeInTheDocument();
    // Preparação vem antes de Instalações (primeiro item de cada uma).
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h2) => h2.textContent);
    expect(headings).toEqual(["Preparação", "Instalações"]);
  });

  it("sem etapa nenhuma, lista simples (sem cabeçalho de grupo)", async () => {
    h.items = [it_({ id: "a", sort_order: 1 }), it_({ id: "b", sort_order: 2 })];
    renderPage();
    await screen.findByTestId("internal-item-a");
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  });

  it("compara com o cliente: datas do cliente quando diferem e 'Só interno' sem vínculo", async () => {
    renderPage();
    await screen.findByTestId("internal-item-i2");
    expect(within(row("i2")).getByText("Cliente: 03/11–14/11")).toBeInTheDocument();
    expect(within(row("i1")).queryByText(/Cliente:/)).toBeNull();
    expect(within(row("i3")).getByText("Só interno")).toBeInTheDocument();
    expect(within(row("i1")).queryByText("Só interno")).toBeNull();
  });

  it("resumo: entrega interna depois da do cliente é risco", async () => {
    renderPage();
    const resumo = await screen.findByRole("region", { name: "Entrega interna e do cliente" });
    expect(resumo).toHaveTextContent("Entrega interna 20/11");
    expect(resumo).toHaveTextContent("Cliente 14/11");
    expect(within(resumo).getByText("Risco: termina 6 dias depois do cliente")).toBeInTheDocument();
  });

  it("resumo: entrega interna antes da do cliente é folga", async () => {
    h.items = [it_({ id: "i1", client_activity_id: "c2", planned_end: "2026-11-13", sort_order: 1 })];
    renderPage();
    const resumo = await screen.findByRole("region", { name: "Entrega interna e do cliente" });
    expect(within(resumo).getByText("Folga: termina 1 dia antes do cliente")).toBeInTheDocument();
  });

  it("'Iniciou hoje' e 'Concluiu hoje' gravam a data real no item interno", async () => {
    renderPage();
    await screen.findByTestId("internal-item-i1");
    fireEvent.click(within(row("i1")).getByRole("button", { name: /Iniciou hoje/ }));
    await waitFor(() => expect(h.update).toHaveBeenCalledWith("i1", { actual_start: "2026-11-05" }));

    // Item já iniciado: concluir não mexe no início.
    fireEvent.click(within(row("i2")).getByRole("button", { name: /Concluiu hoje/ }));
    await waitFor(() => expect(h.update).toHaveBeenCalledWith("i2", { actual_end: "2026-11-05" }));

    // Item não iniciado: concluir hoje também marca o início.
    fireEvent.click(within(row("i3")).getByRole("button", { name: /Concluiu hoje/ }));
    await waitFor(() =>
      expect(h.update).toHaveBeenCalledWith("i3", { actual_end: "2026-11-05", actual_start: "2026-11-05" }),
    );
  });

  it("editar a data prevista na linha grava; data inválida volta sem gravar", async () => {
    renderPage();
    await screen.findByTestId("internal-item-i1");
    const fim = within(row("i1")).getByLabelText("Fim previsto de Demolição") as HTMLInputElement;
    fireEvent.change(fim, { target: { value: "2026-11-10" } });
    fireEvent.blur(fim);
    await waitFor(() => expect(h.update).toHaveBeenCalledWith("i1", { planned_end: "2026-11-10" }));

    h.update.mockClear();
    const inicio = within(row("i3")).getByLabelText("Início previsto de Limpeza extra") as HTMLInputElement;
    fireEvent.change(inicio, { target: { value: "2026-11-30" } });
    fireEvent.blur(inicio);
    expect(h.update).not.toHaveBeenCalled();
    expect(inicio.value).toBe("2026-11-02");
  });

  it("editado pela equipe: data da edição e quantas atividades diferem do cliente", async () => {
    renderPage();
    const estado = await screen.findByTestId("internal-state");
    expect(estado).toHaveTextContent("Editado pela equipe em 20/10");
    // Só i2 (ligado ao cliente) tem datas diferentes; i3 é só interno.
    await waitFor(() => expect(estado).toHaveTextContent("1 atividade com datas diferentes do cliente"));
    expect(screen.getByRole("button", { name: /Copiar de novo do cronograma do cliente/ })).toBeInTheDocument();
  });

  it("acompanhando o cliente: aviso discreto e sem 'Copiar de novo'", async () => {
    h.customizedAt = null;
    renderPage();
    expect(await screen.findByTestId("internal-state")).toHaveTextContent(
      "Acompanhando o cronograma do cliente: muda sozinho até alguém da equipe editar aqui",
    );
    expect(screen.queryByRole("button", { name: /Copiar de novo/ })).toBeNull();
  });

  it("obra sem cronograma interno: copia do cliente sem substituir", async () => {
    h.items = [];
    renderPage();
    const btn = await screen.findByRole("button", { name: /Copiar do cronograma do cliente/ });
    expect(screen.getByText(/2 atividades/)).toBeInTheDocument();
    fireEvent.click(btn);
    await waitFor(() => expect(h.copyFromClient).toHaveBeenCalledWith("p1", false));
  });

  it("'Copiar de novo' só substitui depois de confirmar, explicando o que acontece", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Copiar de novo do cronograma do cliente/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("será apagado e trocado por uma cópia nova");
    expect(dialog).toHaveTextContent("As atividades da Semana passam para o item novo");
    expect(dialog).toHaveTextContent("as que estavam em itens só internos ficam sem etapa");
    expect(dialog).toHaveTextContent("volta a acompanhar o do cliente");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(h.copyFromClient).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Copiar de novo do cronograma do cliente/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Substituir pelo do cliente" }));
    await waitFor(() => expect(h.copyFromClient).toHaveBeenCalledWith("p1", true));
  });

  it("excluir avisa das atividades da Semana penduradas e das micro-etapas", async () => {
    h.opsCount = 2;
    renderPage();
    await screen.findByTestId("internal-item-i2");
    fireEvent.click(within(row("i2")).getByRole("button", { name: /Excluir “Elétrica”/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("A micro-etapa dele também será excluída.");
    expect(await within(dialog).findByText(/2 atividades da Semana estão ligadas/)).toBeInTheDocument();
    expect(h.countOpsActivities).toHaveBeenCalledWith(["i2", "i2a"]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.remove).toHaveBeenCalledWith("i2"));
  });

  it("reordena dentro da etapa", async () => {
    renderPage();
    await screen.findByTestId("internal-item-i1");
    fireEvent.click(screen.getByRole("button", { name: "Mover “Demolição” para baixo" }));
    await waitFor(() =>
      expect(h.reorder).toHaveBeenCalledWith([
        { id: "i3", sort_order: 1 },
        { id: "i1", sort_order: 4 },
      ]),
    );
  });

  it("adicionar item abre a gaveta e grava no cronograma interno", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar item" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Descrição"), { target: { value: "Vistoria final" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Adicionar" }));
    await waitFor(() =>
      expect(h.create).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: "p1",
          description: "Vistoria final",
          parent_id: null,
          planned_start: "2026-11-05",
          planned_end: "2026-11-05",
          sort_order: 5,
        }),
      ),
    );
  });

  it("sem permissão de edição: só leitura", async () => {
    h.canEdit = false;
    renderPage();
    await screen.findByTestId("internal-item-i1");
    expect(screen.getByText(/Somente leitura/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar item" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Copiar de novo/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Iniciou hoje/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mover/ })).toBeNull();
    expect(within(row("i1")).getByLabelText("Fim previsto de Demolição")).toBeDisabled();
    expect(within(row("i1")).getByRole("button", { name: /Detalhes/ })).toBeInTheDocument();
  });

  it("erro ao carregar mostra mensagem em português e permite tentar de novo", async () => {
    h.listByProject.mockImplementation(() =>
      Promise.resolve({ data: [], error: { message: "x", userError: { kind: "forbidden", userMessage: "Você não tem permissão para ver isto." } } }),
    );
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Você não tem permissão para ver isto.");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
