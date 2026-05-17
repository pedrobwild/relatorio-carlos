/**
 * Integração: ordenação por etapa canônica + semana S{N} no Painel de Obras.
 *
 * Garante que tanto a tabela quanto o board agrupam/ordenam as obras em
 * Execução por número crescente da semana (S1 → S2 → S3 …) e respeitam a
 * ordem canônica das etapas vinda de `ETAPA_OPTIONS`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { PainelObra } from "@/hooks/usePainelObras";

// ── Fixture: hoje fixo para a semana S{N} ser determinística ──────────────
// Hoje = 29/abr/2026 → quem começou em 01/04/2026 está em S5.
const TODAY = new Date(2026, 3, 29);

function makeObra(overrides: Partial<PainelObra>): PainelObra {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    nome: overrides.nome ?? "Obra X",
    customer_name: overrides.customer_name ?? "Cliente X",
    engineer_name: null,
    inicio_oficial: overrides.inicio_oficial ?? null,
    entrega_oficial: overrides.entrega_oficial ?? null,
    inicio_real: null,
    entrega_real: null,
    prazo: null,
    etapa: overrides.etapa ?? null,
    inicio_etapa: overrides.inicio_etapa ?? null,
    previsao_avanco: null,
    status: null,
    relacionamento: null,
    external_budget_id: null,
    responsavel_id: null,
    responsavel_nome: null,
    ultima_atualizacao: "2026-04-29T00:00:00Z",
    is_project_phase: false,
    progress_percentage: null,
    pending_count: 0,
    overdue_count: 0,
  };
}

const obrasFixture: PainelObra[] = [
  // Embaralhadas a propósito (ordem de chegada ≠ ordem esperada)
  makeObra({
    id: "exec-s5",
    customer_name: "Cliente S5",
    nome: "Obra S5",
    etapa: "Execução",
    inicio_etapa: "2026-04-01",
  }), // S5
  makeObra({
    id: "final",
    customer_name: "Cliente Final",
    nome: "Obra Final",
    etapa: "Finalizada",
  }),
  makeObra({
    id: "exec-s1",
    customer_name: "Cliente S1",
    nome: "Obra S1",
    etapa: "Execução",
    inicio_etapa: "2026-04-25",
  }), // S1 (4 dias)
  makeObra({
    id: "plan",
    customer_name: "Cliente Plan",
    nome: "Obra Plan",
    etapa: "Planejamento",
  }),
  makeObra({
    id: "exec-s3",
    customer_name: "Cliente S3",
    nome: "Obra S3",
    etapa: "Execução",
    inicio_etapa: "2026-04-15",
  }), // S3 (14 dias)
  makeObra({
    id: "exec-s2",
    customer_name: "Cliente S2",
    nome: "Obra S2",
    etapa: "Execução",
    inicio_etapa: "2026-04-22",
  }), // S2 (7 dias)
  makeObra({
    id: "medic",
    customer_name: "Cliente Med",
    nome: "Obra Med",
    etapa: "Medição",
  }),
];

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock("@/hooks/usePainelObras", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePainelObras")>(
    "@/hooks/usePainelObras",
  );
  return {
    ...actual,
    usePainelObras: () => ({
      obras: obrasFixture,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      updateObra: vi.fn(async () => {}),
      isUpdating: false,
    }),
  };
});

vi.mock("@/hooks/useStaffUsers", () => ({
  useStaffUsers: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    role: "admin",
    roles: ["admin"],
    loading: false,
    isStaff: true,
    isCustomer: false,
  }),
}));

// Componentes filhos pesados não importam para esta asserção de ordem
vi.mock("@/components/admin/obras/DadosClienteDialog", () => ({
  DadosClienteDialog: () => null,
}));
vi.mock("@/components/admin/obras/DailyLogInline", () => ({
  DailyLogInline: () => null,
}));

// O Painel aplica, por padrão, um filtro de período (semana corrente) que
// depende de `usePainelPeriodActivities`. Sem mock, a lista é esvaziada e a
// tabela/board nem chega a renderizar — quebrando as asserções abaixo.
// Aqui devolvemos um bucket "ocupado" para cada obra da fixture, simulando
// que todas têm atividade planejada na semana atual.
vi.mock("@/hooks/usePainelPeriodActivities", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/usePainelPeriodActivities")
  >("@/hooks/usePainelPeriodActivities");
  return {
    ...actual,
    usePainelPeriodActivities: () => ({
      byProject: new Map(
        obrasFixture.map((o) => [
          o.id,
          { scheduled: [], overduePrior: [] },
        ]),
      ),
      isLoading: false,
      error: null,
    }),
  };
});

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

describe("PainelObras — ordenação por etapa e semana S{N}", () => {
  it("tabela: ordena Medição → Planejamento → Execução S1→S5 → Finalizada", () => {
    const { container } = render(
      <Wrapper route="/gestao/painel-obras">
        <PainelObras />
      </Wrapper>,
    );

    // Pega apenas as linhas dentro da tabela desktop (mobile usa cards).
    // Há duas <table>: a desktop (com headers `painel-obras-th-cliente`) e
    // possíveis variações; usamos o th como âncora.
    const desktopTh = container.querySelector(
      '[data-testid="painel-obras-th-cliente"]',
    );
    expect(desktopTh).not.toBeNull();
    const desktopTable = desktopTh!.closest("table")!;
    const rows = within(desktopTable).getAllByTestId("painel-obras-row");
    const order = rows.map(
      (r) =>
        within(r)
          .getByTestId("painel-obras-cell-cliente")
          .textContent?.trim() ?? "",
    );

    // Validação: cada item deve aparecer na ordem esperada.
    const expectedSequence = [
      "Cliente Med", // Medição
      "Cliente Plan", // Planejamento
      "Cliente S1", // Execução S1
      "Cliente S2", // Execução S2
      "Cliente S3", // Execução S3
      "Cliente S5", // Execução S5
      "Cliente Final", // Finalizada
    ];

    for (const expected of expectedSequence) {
      const idx = order.findIndex((t) => t.includes(expected));
      expect(idx, `linha "${expected}" não encontrada`).toBeGreaterThanOrEqual(
        0,
      );
    }
    const indices = expectedSequence.map((e) =>
      order.findIndex((t) => t.includes(e)),
    );
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("board: cria grupos Execução - S1, S2, S3, S5 na ordem crescente, entre Planejamento e Finalizada", () => {
    const { container } = render(
      <Wrapper route="/gestao/painel-obras?view=board">
        <PainelObras />
      </Wrapper>,
    );

    // Cada grupo do board renderiza `<button aria-controls="board-group-${key}">`
    // com o label do grupo como texto. Vamos coletar a sequência de labels.
    const groupButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[aria-controls^="board-group-"]',
      ),
    );
    expect(groupButtons.length).toBeGreaterThan(0);

    const labels = groupButtons.map((b) => b.textContent?.trim() ?? "");

    const idxMed = labels.findIndex((l) => l.startsWith("Medição"));
    const idxPlan = labels.findIndex((l) => l.startsWith("Planejamento"));
    const idxS1 = labels.findIndex((l) => l.startsWith("Execução - S1"));
    const idxS2 = labels.findIndex((l) => l.startsWith("Execução - S2"));
    const idxS3 = labels.findIndex((l) => l.startsWith("Execução - S3"));
    const idxS5 = labels.findIndex((l) => l.startsWith("Execução - S5"));
    const idxFinal = labels.findIndex((l) => l.startsWith("Finalizada"));

    // Todos os grupos esperados existem
    for (const [name, idx] of Object.entries({
      Medição: idxMed,
      Planejamento: idxPlan,
      "Execução - S1": idxS1,
      "Execução - S2": idxS2,
      "Execução - S3": idxS3,
      "Execução - S5": idxS5,
      Finalizada: idxFinal,
    })) {
      expect(idx, `grupo "${name}" ausente do board`).toBeGreaterThanOrEqual(0);
    }

    // Ordem: canônica + semanas crescentes (S4 ausente no fixture)
    expect(idxMed).toBeLessThan(idxPlan);
    expect(idxPlan).toBeLessThan(idxS1);
    expect(idxS1).toBeLessThan(idxS2);
    expect(idxS2).toBeLessThan(idxS3);
    expect(idxS3).toBeLessThan(idxS5);
    expect(idxS5).toBeLessThan(idxFinal);
  });

  it("tabela: prioriza obras atrasadas no topo (mais atrasada primeiro), independente da etapa canônica", () => {
    // Cria uma fixture específica com obras atrasadas + uma "saudável".
    // `entrega_oficial` < hoje (29/abr/2026) e sem `entrega_real` ⇒ atraso > 0.
    const obrasAtraso: PainelObra[] = [
      makeObra({
        id: "saudavel",
        customer_name: "Cliente Saudável",
        nome: "Obra Saudável",
        etapa: "Medição", // etapa canônica precoce — viria primeiro na regra antiga
      }),
      makeObra({
        id: "atraso-pequeno",
        customer_name: "Cliente Atraso Pequeno",
        nome: "Obra Atraso Pequeno",
        etapa: "Execução",
        entrega_oficial: "2026-04-27", // 2 dias úteis de atraso
      }),
      makeObra({
        id: "atraso-grande",
        customer_name: "Cliente Atraso Grande",
        nome: "Obra Atraso Grande",
        etapa: "Finalizada" as never, // finalizada não conta como atraso → vai para o fim
        entrega_oficial: "2026-01-05",
        entrega_real: null,
      }),
      makeObra({
        id: "atraso-medio",
        customer_name: "Cliente Atraso Médio",
        nome: "Obra Atraso Médio",
        etapa: "Execução",
        entrega_oficial: "2026-04-01", // ~20 dias úteis de atraso
      }),
    ];

    // Reaproveita o mock do hook trocando temporariamente a lista.
    const original = obrasFixture.slice();
    obrasFixture.length = 0;
    obrasFixture.push(...obrasAtraso);

    try {
      const { container } = render(
        <Wrapper route="/gestao/painel-obras">
          <PainelObras />
        </Wrapper>,
      );
      const desktopTh = container.querySelector(
        '[data-testid="painel-obras-th-cliente"]',
      );
      expect(desktopTh).not.toBeNull();
      const desktopTable = desktopTh!.closest("table")!;
      const rows = within(desktopTable).getAllByTestId("painel-obras-row");
      const order = rows.map(
        (r) =>
          within(r)
            .getByTestId("painel-obras-cell-cliente")
            .textContent?.trim() ?? "",
      );

      const idxMedio = order.findIndex((t) => t.includes("Atraso Médio"));
      const idxPequeno = order.findIndex((t) => t.includes("Atraso Pequeno"));
      const idxSaudavel = order.findIndex((t) => t.includes("Saudável"));

      // Atrasadas vêm primeiro; entre elas, mais atrasada antes da menos.
      expect(idxMedio).toBeGreaterThanOrEqual(0);
      expect(idxPequeno).toBeGreaterThanOrEqual(0);
      expect(idxMedio).toBeLessThan(idxPequeno);
      // Saudável (sem atraso) vem depois das atrasadas.
      expect(idxPequeno).toBeLessThan(idxSaudavel);
    } finally {
      obrasFixture.length = 0;
      obrasFixture.push(...original);
    }
  });
});
