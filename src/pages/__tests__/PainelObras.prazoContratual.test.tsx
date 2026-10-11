/**
 * Prazo contratual no Painel de Obras (Fase 1).
 *
 * Trava a regra: quando a obra tem prazo contratual, ele decide "Atrasado",
 * dias de atraso e os indicadores do topo — reprogramar a entrega oficial não
 * esconde mais o atraso. Sem prazo contratual, vale a regra antiga.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";
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

// Hoje fixo: domingo, 11/10/2026.
const TODAY = new Date("2026-10-11T12:00:00-03:00");

// A obra que motivou a mudança: a entrega oficial foi REPROGRAMADA para
// dezembro, o que antes "zerava" o atraso. Pelo contrato, venceu em 01/10.
const REPROGRAMADA = makeObra({
  id: "reprogramada",
  customer_name: "Cliente Reprogramada",
  nome: "Obra reprogramada",
  entrega_oficial: "2026-12-20",
});
const FOLGA_CURTA = makeObra({
  id: "folga-curta",
  customer_name: "Cliente Folga Curta",
  nome: "Obra folga curta",
  entrega_oficial: "2026-12-30",
});
const SEM_CONTRATO = makeObra({
  id: "sem-contrato",
  customer_name: "Cliente Sem Contrato",
  nome: "Obra sem contrato",
  entrega_oficial: "2026-10-14",
});
const NO_PRAZO = makeObra({
  id: "no-prazo",
  customer_name: "Cliente No Prazo",
  nome: "Obra no prazo",
  entrega_oficial: "2026-11-27",
});

const dl = (p: Partial<ProjectDeadline>): ProjectDeadline =>
  ({
    contract_business_days: 60,
    current_business_days: 60,
    business_days_elapsed: 30,
    business_days_late: 0,
    amendment_business_days: 0,
    amendments_pending: 0,
    penalty_accrued_value: null,
    contract_terms_confirmed: true,
    is_project_phase: false,
    ...p,
  }) as ProjectDeadline;

const DEADLINES: ProjectDeadline[] = [
  dl({ project_id: "reprogramada", contract_deadline: "2026-10-01", current_deadline: "2026-10-01", business_days_remaining: -7, business_days_late: 7, penalty_accrued_value: 3500 }),
  dl({ project_id: "folga-curta", contract_deadline: "2026-10-15", current_deadline: "2026-10-15", business_days_remaining: 3 }),
  dl({ project_id: "no-prazo", contract_deadline: "2026-11-27", current_deadline: "2026-11-27", business_days_remaining: 33 }),
];

vi.mock("@/hooks/useContractDeadline", () => ({
  useObraDeadlines: () => ({ data: DEADLINES, isLoading: false }),
}));

vi.mock("@/hooks/usePainelObras", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePainelObras")>(
    "@/hooks/usePainelObras",
  );
  return {
    ...actual,
    usePainelObras: () => ({
      obras: [NO_PRAZO, SEM_CONTRATO, FOLGA_CURTA, REPROGRAMADA],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      updateObra: vi.fn(async () => {}),
      isUpdating: false,
    }),
  };
});

vi.mock("@/hooks/useStaffUsers", () => ({
  filterCoordenadoresObra: (users: Array<{ email: string }>) =>
    users.filter((user) =>
      ["gabriellafranco@bwild.com.br", "bruna.sampaio@bewild.com.br"].includes(
        user.email,
      ),
    ),
  useStaffUsers: () => ({
    data: [
      {
        id: "u-gabi",
        nome: "Gabriella Franco",
        email: "gabriellafranco@bwild.com.br",
        perfil: "admin",
      },
      {
        id: "u-bruna",
        nome: "Bruna Sampaio",
        email: "bruna.sampaio@bewild.com.br",
        perfil: "admin",
      },
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

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
});
afterEach(() => {
  vi.useRealTimers();
});

const tabela = (container: HTMLElement) =>
  container
    .querySelector('[data-testid="painel-obras-th-prazo"]')!
    .closest("table")! as HTMLElement;
const linhaDe = (table: HTMLElement, cliente: string) =>
  within(table)
    .getAllByTestId("painel-obras-row")
    .find((r) => r.textContent?.includes(cliente))!;

describe("PainelObras — prazo contratual", () => {
  it("obra reprogramada continua Atrasada pelo contrato, com dias úteis de atraso", () => {
    const { container } = render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );
    const linha = linhaDe(tabela(container), "Cliente Reprogramada");
    const cell = within(linha).getByTestId("painel-prazo-cell");
    expect(cell).toHaveAttribute("data-health", "atrasada");
    expect(cell).toHaveTextContent("7 du de atraso");
    expect(within(linha).getAllByText("Atrasado").length).toBeGreaterThan(0);
  });

  it("indicador Atrasadas conta pelo contrato e mostra a multa acumulada", () => {
    render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );
    const tile = screen.getByRole("button", { name: /^Atrasadas: 1\./ });
    expect(tile).toHaveAccessibleName(/Multa acumulada R\$\s?3\.500/);
  });

  it("Prazo em risco: folga curta pelo contrato + regra antiga para obra sem contrato", () => {
    render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );
    expect(
      screen.getByRole("button", { name: /^Prazo em risco: 2\./ }),
    ).toBeInTheDocument();
  });

  it("obra sem prazo contratual aparece como 'Sem prazo'", () => {
    const { container } = render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );
    const linha = linhaDe(tabela(container), "Cliente Sem Contrato");
    expect(within(linha).getByTestId("painel-prazo-cell")).toHaveTextContent("Sem prazo");
  });

  it("ordenar por Prazo contratual coloca a mais atrasada primeiro", () => {
    const { container } = render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );
    const th = container.querySelector('[data-testid="painel-obras-th-prazo"]')!;
    fireEvent.click(within(th as HTMLElement).getByRole("button"));
    const rows = within(tabela(container)).getAllByTestId("painel-obras-row");
    const ordem = rows.map((r) =>
      ["Reprogramada", "Folga Curta", "No Prazo", "Sem Contrato"].find((n) =>
        r.textContent?.includes(`Cliente ${n}`),
      ),
    );
    expect(ordem).toEqual(["Reprogramada", "Folga Curta", "No Prazo", "Sem Contrato"]);
  });
});
