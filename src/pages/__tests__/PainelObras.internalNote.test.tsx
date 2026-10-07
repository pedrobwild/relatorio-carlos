/**
 * Observação interna fixada aparece na linha da obra no Painel.
 *
 * É o "porquê" da obra estar sem atualização: o selo vai ao lado do
 * "sem atualização há Nd" — e aparece mesmo quando a obra não está parada.
 */
import { describe, it, expect, vi } from "vitest";
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { PainelObra } from "@/hooks/usePainelObras";
import type { ProjectInternalNote } from "@/infra/repositories";

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
    ultima_atualizacao: "2020-01-01T00:00:00Z",
    is_project_phase: false,
    progress_percentage: null,
    pending_count: 0,
    overdue_count: 0,
    ...overrides,
  };
}

const PARADA_COM_NOTA = makeObra({
  id: "parada-com-nota",
  customer_name: "Cliente Parada Com Nota",
});
const RECENTE_COM_NOTA = makeObra({
  id: "recente-com-nota",
  customer_name: "Cliente Recente Com Nota",
  ultima_atualizacao: new Date().toISOString(),
});
const PARADA_SEM_NOTA = makeObra({
  id: "parada-sem-nota",
  customer_name: "Cliente Parada Sem Nota",
});

function makeNote(projectId: string, category: string): ProjectInternalNote {
  return {
    id: `nota-${projectId}`,
    project_id: projectId,
    author_id: "u-ana",
    author_name: "Ana Souza",
    body: "Cliente viajando até dia 20.",
    category,
    is_pinned: true,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    edited_at: null,
    deleted_at: null,
  };
}

vi.mock("@/hooks/usePainelObras", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePainelObras")>(
    "@/hooks/usePainelObras",
  );
  return {
    ...actual,
    usePainelObras: () => ({
      obras: [PARADA_COM_NOTA, RECENTE_COM_NOTA, PARADA_SEM_NOTA],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      updateObra: vi.fn(async () => {}),
      isUpdating: false,
    }),
  };
});

vi.mock("@/hooks/useProjectInternalNotes", () => ({
  usePinnedInternalNotes: () => ({
    byProjectId: new Map([
      [PARADA_COM_NOTA.id, makeNote(PARADA_COM_NOTA.id, "aguardando_cliente")],
      [RECENTE_COM_NOTA.id, makeNote(RECENTE_COM_NOTA.id, "obra_pausada")],
    ]),
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useStaffUsers", () => ({
  filterCoordenadoresObra: (users: unknown[]) => users,
  useStaffUsers: () => ({ data: [], isLoading: false }),
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

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/gestao/painel-obras"]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function linhaDaTabela(container: HTMLElement, cliente: string) {
  const table = container
    .querySelector('[data-testid="painel-obras-th-cliente"]')
    ?.closest("table");
  if (!table) throw new Error("tabela do painel não encontrada");
  const linha = within(table)
    .getAllByTestId("painel-obras-row")
    .find((r) => r.textContent?.includes(cliente));
  if (!linha) throw new Error(`linha de "${cliente}" não encontrada`);
  return linha;
}

describe("PainelObras — observação interna fixada na linha da obra", () => {
  it("mostra a categoria ao lado do selo 'sem atualização'", () => {
    const { container } = render(
      <Wrapper>
        <PainelObras />
      </Wrapper>,
    );

    const linha = linhaDaTabela(container, "Cliente Parada Com Nota");
    expect(within(linha).getByText(/sem atualização há/)).toBeInTheDocument();
    expect(within(linha).getByRole("note")).toHaveTextContent(
      "Aguardando cliente",
    );
  });

  it("aparece mesmo quando a obra não está sem atualização", () => {
    const { container } = render(
      <Wrapper>
        <PainelObras />
      </Wrapper>,
    );

    const linha = linhaDaTabela(container, "Cliente Recente Com Nota");
    expect(within(linha).queryByText(/sem atualização há/)).toBeNull();
    expect(within(linha).getByRole("note")).toHaveTextContent("Obra pausada");
  });

  it("obra sem nota fixada não ganha indicador", () => {
    const { container } = render(
      <Wrapper>
        <PainelObras />
      </Wrapper>,
    );

    const linha = linhaDaTabela(container, "Cliente Parada Sem Nota");
    expect(within(linha).getByText(/sem atualização há/)).toBeInTheDocument();
    expect(within(linha).queryByRole("note")).toBeNull();
  });
});
