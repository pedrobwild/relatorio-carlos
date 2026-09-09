/**
 * O gestor da obra tem que APARECER no card — inclusive quando não há
 * gestor definido.
 *
 * Histórico: o campo existia, mas era invisível na prática. No card do
 * kanban e no card mobile ele só era renderizado quando havia nome
 * (`{obra.responsavel_nome && ...}`), e como 107 das 110 obras estavam sem
 * gestor, o card parecia simplesmente não ter esse dado. Na tabela, a
 * coluna carregava `hidden xl:table-cell` e sumia abaixo de 1280px.
 *
 * Estes testes travam as duas coisas: o gestor aparece com nome quando há,
 * e aparece como "Sem gestor" quando não há — que é justamente a obra que
 * some de qualquer filtro por responsável.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { PainelObra } from "@/hooks/usePainelObras";

function makeObra(overrides: Partial<PainelObra>): PainelObra {
  return {
    id: "obra",
    nome: "Obra",
    customer_name: "Cliente",
    engineer_name: null,
    inicio_oficial: null,
    entrega_oficial: null,
    inicio_real: null,
    entrega_real: null,
    prazo: null,
    etapa: "Execução",
    inicio_etapa: null,
    previsao_avanco: null,
    status: null,
    relacionamento: null,
    external_budget_id: null,
    responsavel_id: null,
    responsavel_nome: null,
    ultima_atualizacao: "2026-09-09T00:00:00Z",
    is_project_phase: false,
    progress_percentage: null,
    pending_count: 0,
    overdue_count: 0,
    ...overrides,
  };
}

const COM_GESTOR = makeObra({
  id: "com-gestor",
  customer_name: "Cliente Com Gestor",
  nome: "Obra com gestor",
  responsavel_id: "u-ana",
  responsavel_nome: "Ana Souza",
});
const SEM_GESTOR = makeObra({
  id: "sem-gestor",
  customer_name: "Cliente Sem Gestor",
  nome: "Obra sem gestor",
});

vi.mock("@/hooks/usePainelObras", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePainelObras")>(
    "@/hooks/usePainelObras",
  );
  return {
    ...actual,
    usePainelObras: () => ({
      obras: [COM_GESTOR, SEM_GESTOR],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      updateObra: vi.fn(async () => {}),
      isUpdating: false,
    }),
  };
});

vi.mock("@/hooks/useStaffUsers", () => ({
  useStaffUsers: () => ({
    data: [
      { id: "u-ana", nome: "Ana Souza", email: "ana@x", perfil: "gestor" },
      { id: "u-caio", nome: "Caio Lima", email: "caio@x", perfil: "gestor" },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/usePainelPeriodActivities", async (orig) => {
  const actual =
    await orig<typeof import("@/hooks/usePainelPeriodActivities")>();
  return {
    ...actual,
    usePainelPeriodActivities: () => ({
      byProject: { has: () => true, get: () => undefined, size: 0 },
      isLoading: false,
      error: null,
    }),
  };
});

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    role: "admin",
    roles: ["admin"],
    loading: false,
    isStaff: true,
    isCustomer: false,
  }),
}));

vi.mock("@/components/admin/obras/DadosClienteDialog", () => ({
  DadosClienteDialog: () => null,
}));
vi.mock("@/components/admin/obras/DailyLogInline", () => ({
  DailyLogInline: () => null,
}));

import PainelObras from "../PainelObras";

function Wrapper({ children, route }: { children: ReactNode; route: string }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PainelObras — gestor visível no card", () => {
  it("card do kanban mostra o nome do gestor", () => {
    render(
      <Wrapper route="/gestao/painel-obras?view=kanban">
        <PainelObras />
      </Wrapper>,
    );

    const trigger = screen.getByLabelText("Gestor da obra: Ana Souza");
    expect(trigger).toHaveTextContent("Ana Souza");
  });

  it("card do kanban sem gestor diz 'Sem gestor' — não fica em branco", () => {
    render(
      <Wrapper route="/gestao/painel-obras?view=kanban">
        <PainelObras />
      </Wrapper>,
    );

    // O ponto do bug: antes o card não renderizava NADA quando o gestor era
    // nulo, e como quase toda obra estava sem gestor o card parecia não ter
    // esse dado.
    const trigger = screen.getByLabelText("Definir gestor da obra");
    expect(trigger).toHaveTextContent("Sem gestor");
  });

  it("o gestor do card é um seletor de valor único — nunca uma lista", () => {
    render(
      <Wrapper route="/gestao/painel-obras?view=kanban">
        <PainelObras />
      </Wrapper>,
    );

    const trigger = screen.getByLabelText("Definir gestor da obra");
    expect(trigger).toHaveAttribute("role", "combobox");
    expect(trigger).not.toHaveAttribute("multiple");
    // Um gatilho por card: não há como abrir dois gestores para a mesma obra.
    expect(screen.getAllByLabelText(/gestor da obra/i)).toHaveLength(2);
  });

  it("card mobile mostra o gestor com nome e, sem gestor, o aviso", () => {
    render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );

    expect(
      screen.getByLabelText(
        "Abrir obra Obra com gestor de Cliente Com Gestor",
      ),
    ).toHaveTextContent("Ana Souza");
    expect(
      screen.getByLabelText(
        "Abrir obra Obra sem gestor de Cliente Sem Gestor",
      ),
    ).toHaveTextContent("Sem gestor");
  });

  it("coluna do gestor na tabela não some em tela estreita", () => {
    const { container } = render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );

    const th = container.querySelector(
      '[data-testid="painel-obras-th-cliente"]',
    );
    const table = th!.closest("table")!;
    const rows = within(table).getAllByTestId("painel-obras-row");
    const linha = rows.find((r) =>
      r.textContent?.includes("Cliente Com Gestor"),
    )!;

    const celula = within(linha)
      .getByLabelText("Responsável pela obra")
      .closest("td")!;
    // `hidden xl:table-cell` escondia o gestor abaixo de 1280px — era por
    // isso que ninguém via nem preenchia o campo. (`overflow-hidden` é outra
    // classe: por isso o limite de palavra.)
    expect(celula.className).not.toMatch(/(?:^|\s)hidden(?:\s|$)/);
    expect(within(linha).getByText("Ana Souza")).toBeInTheDocument();
  });
});
