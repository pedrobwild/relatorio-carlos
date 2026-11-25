/**
 * Resumo geral do Painel de Obras: total em destaque + em andamento /
 * atrasadas / paralisadas / entregues. Os grupos somam o total e cada cartão
 * filtra a lista. Os filtros de status e gestor vivem na URL, para que
 * "Salvar visão atual" os capture.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
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

const OBRAS = [
  makeObra({ id: "a", nome: "Obra em dia", status: "Em dia" }),
  makeObra({ id: "b", nome: "Obra sem status" }),
  makeObra({
    id: "c",
    nome: "Obra vencida",
    status: "Em dia",
    entrega_oficial: "2020-01-10",
  }),
  // Paralisada com prazo vencido aparece como Atrasado na lista — conta lá.
  makeObra({
    id: "d",
    nome: "Obra paralisada vencida",
    status: "Paralisada",
    entrega_oficial: "2020-01-10",
  }),
  makeObra({
    id: "e",
    nome: "Obra paralisada",
    status: "Paralisada",
    responsavel_id: "u-ana",
    responsavel_nome: "Ana Souza",
  }),
  makeObra({ id: "f", nome: "Obra entregue", entrega_real: "2026-01-10" }),
];

vi.mock("@/hooks/usePainelObras", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePainelObras")>(
    "@/hooks/usePainelObras",
  );
  return {
    ...actual,
    usePainelObras: () => ({
      obras: OBRAS,
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

const resumo = () => screen.getByLabelText("Visão geral das obras");
const cartao = (nome: RegExp) =>
  within(resumo()).getByRole("button", { name: nome });
const linhasMobile = () =>
  screen.getAllByLabelText(/^Abrir obra /).map((el) => el.getAttribute("aria-label"));

describe("PainelObras — resumo geral", () => {
  it("mostra o total e grupos que somam o total", () => {
    render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );
    expect(resumo()).toHaveTextContent("Total de obras6");
    expect(cartao(/^Em andamento: 2 de 6/)).toBeInTheDocument();
    expect(cartao(/^Atrasadas: 2 de 6/)).toBeInTheDocument();
    expect(cartao(/^Paralisadas: 1 de 6/)).toBeInTheDocument();
    expect(cartao(/^Entregues: 1 de 6/)).toBeInTheDocument();
  });

  it("clicar em Atrasadas filtra a lista; clicar de novo desfaz", () => {
    render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );
    fireEvent.click(cartao(/^Atrasadas/));
    expect(cartao(/^Atrasadas/)).toHaveAttribute("aria-pressed", "true");
    expect(linhasMobile()).toHaveLength(2);
    expect(linhasMobile().join()).toContain("Obra paralisada vencida");

    fireEvent.click(cartao(/^Atrasadas/));
    expect(linhasMobile()).toHaveLength(5);
  });

  it("clicar em Entregues abre as concluídas", () => {
    render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );
    fireEvent.click(cartao(/^Entregues/));
    expect(linhasMobile()).toHaveLength(1);
    expect(linhasMobile()[0]).toContain("Obra entregue");
  });

  it("status e gestor vêm da URL (visões salvas e links)", () => {
    render(
      <Wrapper route="/gestao/painel-obras?status=Paralisada&gestor=u-ana">
        <PainelObras />
      </Wrapper>,
    );
    expect(linhasMobile()).toHaveLength(1);
    expect(linhasMobile()[0]).toContain("Obra paralisada");
    expect(cartao(/^Paralisadas/)).toHaveAttribute("aria-pressed", "true");
  });
});
