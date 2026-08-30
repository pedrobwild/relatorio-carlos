/**
 * Integração: paridade entre o rótulo renderizado (tabela + board) e o
 * retorno de `formatEtapaLabel` para o mesmo conjunto de fixtures/datas.
 *
 * Garante que UI e lógica pura nunca divergem para um mesmo `inicio_etapa`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { PainelObra } from "@/hooks/usePainelObras";
import { formatEtapaLabel } from "@/lib/painelEtapaWeek";

const TODAY = new Date(2026, 3, 29); // 29/abr/2026

function makeObra(overrides: Partial<PainelObra>): PainelObra {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    nome: overrides.nome ?? "Obra",
    customer_name: overrides.customer_name ?? "Cliente",
    engineer_name: null,
    inicio_oficial: overrides.inicio_oficial ?? null,
    entrega_oficial: null,
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

// Fixture: vários inícios cobrindo S1, S2, S3, S5, além de outras etapas.
const obrasFixture: PainelObra[] = [
  makeObra({
    id: "o-s1",
    customer_name: "Cliente S1",
    etapa: "Execução",
    inicio_etapa: "2026-04-25",
  }), // 4 dias → S1
  makeObra({
    id: "o-s2",
    customer_name: "Cliente S2",
    etapa: "Execução",
    inicio_etapa: "2026-04-22",
  }), // 7 dias → S2
  makeObra({
    id: "o-s3",
    customer_name: "Cliente S3",
    etapa: "Execução",
    inicio_etapa: "2026-04-15",
  }), // 14 dias → S3
  makeObra({
    id: "o-s5",
    customer_name: "Cliente S5",
    etapa: "Execução",
    inicio_etapa: "2026-04-01",
  }), // 28 dias → S5
  makeObra({
    id: "o-plan",
    customer_name: "Cliente Plan",
    etapa: "Planejamento",
  }),
  makeObra({ id: "o-med", customer_name: "Cliente Med", etapa: "Medição" }),
  makeObra({
    id: "o-final",
    customer_name: "Cliente Final",
    etapa: "Finalizada",
  }),
];

/**
 * O Painel segmenta por aba Ativas/Concluídas (`?aba=concluidas`), e a visão
 * padrão ("ativas") ESCONDE obras concluídas — etapa `Finalizada` ou com
 * `entrega_real` registrada. Ver o filtro em src/pages/PainelObras.tsx.
 *
 * Os testes abaixo asseguram a paridade de rótulos dentro de cada aba, em vez
 * de esperar que todas as obras do fixture apareçam na visão padrão.
 */
const isConcluida = (o: PainelObra) =>
  !!o.entrega_real || o.etapa === "Finalizada";
const obrasAtivas = obrasFixture.filter((o) => !isConcluida(o));
const obrasConcluidas = obrasFixture.filter(isConcluida);

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

// O Painel agora ativa o filtro de período (semana corrente) por padrão,
// restringindo a lista às obras com atividades no período. Sem mockar este
// hook, `periodByProject` vem vazio e todas as obras são filtradas, deixando
// a tabela/board vazios. Mockamos para que o filtro de período aceite todas.
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

describe("PainelObras — paridade rótulo renderizado × formatEtapaLabel", () => {
  it("tabela: cada linha exibe exatamente o que formatEtapaLabel retorna", () => {
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

    // Mapa "texto da célula cliente" → rótulo renderizado (data-attribute estável).
    const rendered: Array<{ cliente: string; label: string }> = [];
    for (const row of rows) {
      const cliente =
        within(row)
          .getByTestId("painel-obras-cell-cliente")
          .textContent?.trim() ?? "";
      const cell = within(row).getByTestId("painel-obras-cell-etapa");
      rendered.push({
        cliente,
        label: cell.getAttribute("data-etapa-label") ?? "",
      });
    }

    // Para cada obra ATIVA do fixture, achar a linha correspondente pelo
    // customer_name (textContent inclui também `obra.nome`, então usamos
    // `includes`).
    for (const obra of obrasAtivas) {
      const expected = obra.etapa ? (formatEtapaLabel(obra, TODAY) ?? "") : "";
      const match = rendered.find((r) =>
        r.cliente.includes(obra.customer_name ?? ""),
      );
      expect(
        match,
        `linha de "${obra.customer_name}" não encontrada`,
      ).toBeTruthy();
      expect(
        match!.label,
        `linha de "${obra.customer_name}" deveria exibir "${expected}"`,
      ).toBe(expected);
    }

    // A aba padrão é "ativas": obra concluída não pode vazar para cá.
    for (const obra of obrasConcluidas) {
      expect(
        rendered.some((r) => r.cliente.includes(obra.customer_name ?? "")),
        `obra concluída "${obra.customer_name}" não deveria aparecer na aba Ativas`,
      ).toBe(false);
    }

    // Sanidade: pelo menos uma obra com rótulo S{N} foi renderizada.
    expect(rendered.some((r) => /^Execução - S\d+$/.test(r.label))).toBe(true);
  });

  it("tabela (aba Concluídas): obras finalizadas aparecem com o rótulo correto", () => {
    const { container } = render(
      <Wrapper route="/gestao/painel-obras?aba=concluidas">
        <PainelObras />
      </Wrapper>,
    );

    const desktopTh = container.querySelector(
      '[data-testid="painel-obras-th-cliente"]',
    );
    expect(desktopTh).not.toBeNull();
    const desktopTable = desktopTh!.closest("table")!;
    const rows = within(desktopTable).getAllByTestId("painel-obras-row");

    const rendered = rows.map((row) => ({
      cliente:
        within(row)
          .getByTestId("painel-obras-cell-cliente")
          .textContent?.trim() ?? "",
      label:
        within(row)
          .getByTestId("painel-obras-cell-etapa")
          .getAttribute("data-etapa-label") ?? "",
    }));

    for (const obra of obrasConcluidas) {
      const expected = obra.etapa ? (formatEtapaLabel(obra, TODAY) ?? "") : "";
      const match = rendered.find((r) =>
        r.cliente.includes(obra.customer_name ?? ""),
      );
      expect(
        match,
        `linha de "${obra.customer_name}" não encontrada na aba Concluídas`,
      ).toBeTruthy();
      expect(match!.label).toBe(expected);
    }
  });

  it("board: cada grupo de Execução tem label === formatEtapaLabel da obra", () => {
    const { container } = render(
      <Wrapper route="/gestao/painel-obras?view=board">
        <PainelObras />
      </Wrapper>,
    );

    const labelEls = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-testid="board-group-label"]',
      ),
    );
    const labels = labelEls.map((el) => el.textContent?.trim() ?? "");

    // Todas as obras em Execução do fixture devem ter um grupo
    // cujo label começa exatamente com `formatEtapaLabel(obra)`.
    const execObras = obrasFixture.filter((o) => o.etapa === "Execução");
    for (const obra of execObras) {
      const expected = formatEtapaLabel(obra, TODAY)!;
      const found = labels.find(
        (l) => l === expected || l.startsWith(`${expected} `),
      );
      expect(
        found,
        `board sem grupo "${expected}" para ${obra.customer_name}`,
      ).toBeTruthy();
    }

    // Etapas não-Execução também devem aparecer com o nome puro.
    // "Finalizada" NÃO entra aqui: a aba padrão é "ativas" e obras concluídas
    // ficam fora dela — verificado no teste seguinte.
    for (const etapa of ["Planejamento", "Medição"] as const) {
      const found = labels.find(
        (l) => l === etapa || l.startsWith(`${etapa} `),
      );
      expect(found, `board sem grupo "${etapa}"`).toBeTruthy();
    }

    expect(
      labels.some((l) => l === "Finalizada" || l.startsWith("Finalizada ")),
      'board da aba Ativas não deveria ter grupo "Finalizada"',
    ).toBe(false);
  });

  it("board (aba Concluídas): grupo Finalizada aparece", () => {
    const { container } = render(
      <Wrapper route="/gestao/painel-obras?view=board&aba=concluidas">
        <PainelObras />
      </Wrapper>,
    );

    const labels = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-testid="board-group-label"]',
      ),
    ).map((el) => el.textContent?.trim() ?? "");

    expect(
      labels.find((l) => l === "Finalizada" || l.startsWith("Finalizada ")),
      'board da aba Concluídas deveria ter grupo "Finalizada"',
    ).toBeTruthy();
  });
});
