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
import type {
  PeriodActivity,
  PeriodProjectBucket,
} from "@/hooks/usePainelPeriodActivities";

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

/**
 * Helper de fixture. Reduz duplicação derivando `id`, `nome` e
 * `customer_name` de um único `label`. Qualquer campo pode ser sobrescrito
 * via `overrides` — incluindo o próprio `id` quando o slug derivado for
 * inconveniente (ex.: acentos).
 *
 * Uso típico:
 *   obra("S5", { etapa: "Execução", inicio_etapa: "2026-04-01" })
 *   obra("Atraso Médio", { etapa: "Execução", entrega_oficial: "2026-04-01" })
 */
function slugifyLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function obra(
  label: string,
  overrides: Partial<PainelObra> = {},
): PainelObra {
  return makeObra({
    id: overrides.id ?? slugifyLabel(label),
    nome: overrides.nome ?? `Obra ${label}`,
    customer_name: overrides.customer_name ?? `Cliente ${label}`,
    ...overrides,
  });
}

const obrasFixture: PainelObra[] = [
  // Embaralhadas a propósito (ordem de chegada ≠ ordem esperada)
  obra("S5", { etapa: "Execução", inicio_etapa: "2026-04-01" }),
  obra("Final", { etapa: "Finalizada" }),
  obra("S1", { etapa: "Execução", inicio_etapa: "2026-04-25" }), // 4 dias
  obra("Plan", { etapa: "Planejamento" }),
  obra("S3", { etapa: "Execução", inicio_etapa: "2026-04-15" }), // 14 dias
  obra("S2", { etapa: "Execução", inicio_etapa: "2026-04-22" }), // 7 dias
  obra("Med", { etapa: "Medição" }),
];


// ── Mocks ──────────────────────────────────────────────────────────────────
// Cada teste pode fornecer sua própria fixture via `setObras(...)` em vez de
// mutar `obrasFixture` diretamente. Isso evita efeitos colaterais entre testes
// — antes a mutação do array compartilhado podia vazar caso uma asserção
// lançasse antes do bloco `finally`.
let currentObras: PainelObra[] = obrasFixture;
function setObras(obras: PainelObra[]): void {
  currentObras = obras;
}

vi.mock("@/hooks/usePainelObras", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePainelObras")>(
    "@/hooks/usePainelObras",
  );
  return {
    ...actual,
    usePainelObras: () => ({
      obras: currentObras,
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
//
// O hook real devolve `byProject: Map<projectId, { scheduled, overduePrior }>`
// onde cada item é uma `PeriodActivity` completa e o projeto SÓ aparece no
// map quando tem ao menos uma atividade `scheduled` na janela. Replicamos
// essa forma fielmente para que o filtro de período seja exercitado de
// verdade junto com a ordenação.
//
// Por padrão, cada obra recebe uma `scheduled` na semana de `TODAY` para
// passar pelo filtro. Testes podem:
//   • `setPeriodExcluded(ids)` — não emitir entrada no map (obra some);
//   • `setPeriodOverduePrior(map)` — anexar `overduePrior` por projeto.
const PERIOD_TODAY_ISO = "2026-04-29";
const PERIOD_PRIOR_ISO = "2026-04-20";
let periodExcluded: Set<string> = new Set();
let periodOverduePrior: Map<string, PeriodActivity[]> = new Map();

function setPeriodExcluded(ids: string[]): void {
  periodExcluded = new Set(ids);
}
function setPeriodOverduePrior(map: Record<string, PeriodActivity[]>): void {
  periodOverduePrior = new Map(Object.entries(map));
}
function makePeriodActivity(
  overrides: Partial<PeriodActivity> & Pick<PeriodActivity, "project_id">,
): PeriodActivity {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    project_id: overrides.project_id,
    description: overrides.description ?? "Atividade planejada",
    etapa: overrides.etapa ?? null,
    planned_start: overrides.planned_start ?? PERIOD_TODAY_ISO,
    planned_end: overrides.planned_end ?? PERIOD_TODAY_ISO,
    actual_start: overrides.actual_start ?? null,
    actual_end: overrides.actual_end ?? null,
    parent_activity_id: overrides.parent_activity_id ?? null,
    responsible_name: overrides.responsible_name ?? null,
  };
}

vi.mock("@/hooks/usePainelPeriodActivities", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/usePainelPeriodActivities")
  >("@/hooks/usePainelPeriodActivities");
  return {
    ...actual,
    usePainelPeriodActivities: () => {
      const map = new Map<string, PeriodProjectBucket>();
      for (const o of currentObras) {
        if (periodExcluded.has(o.id)) continue;
        const bucket: PeriodProjectBucket = {
          scheduled: [
            makePeriodActivity({
              project_id: o.id,
              etapa: o.etapa ?? null,
              description: `Atividade ${o.nome}`,
            }),
          ],
          overduePrior: (periodOverduePrior.get(o.id) ?? []).map((a) => ({
            ...a,
            project_id: o.id,
          })),
        };
        map.set(o.id, bucket);
      }
      return {
        byProject: map,
        isLoading: false,
        error: null,
      };
    },
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
  // Garante que cada teste comece com a fixture base; testes que precisarem
  // de dados específicos chamam `setObras([...])` localmente.
  setObras(obrasFixture);
  setPeriodExcluded([]);
  setPeriodOverduePrior({});
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
      // Etapa canônica precoce: pela regra antiga viria primeiro.
      obra("Saudável", { etapa: "Medição" }),
      obra("Atraso Pequeno", {
        etapa: "Execução",
        entrega_oficial: "2026-04-27", // 2 dias úteis de atraso
      }),
      // Finalizada não é contabilizada como atraso → vai para o fim.
      obra("Atraso Grande", {
        etapa: "Finalizada" as never,
        entrega_oficial: "2026-01-05",
      }),
      obra("Atraso Médio", {
        etapa: "Execução",
        entrega_oficial: "2026-04-01", // ~20 dias úteis de atraso
      }),
    ];

    setObras(obrasAtraso);

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
  });

  it("board: prioriza obras atrasadas no topo do grupo, com mais atrasada antes da menos", () => {
    // Todas em "Execução" sem `inicio_etapa` ⇒ caem no mesmo grupo
    // "Execução" (S? – sem semana), permitindo comparar a ordem interna.
    const obrasBoard: PainelObra[] = [
      makeObra({
        id: "board-saudavel",
        customer_name: "Cliente Saudável Board",
        nome: "Obra Saudável Board",
        etapa: "Execução",
        entrega_oficial: "2026-06-30", // futura ⇒ sem atraso
      }),
      makeObra({
        id: "board-atraso-pequeno",
        customer_name: "Cliente Atraso Pequeno Board",
        nome: "Obra Atraso Pequeno Board",
        etapa: "Execução",
        entrega_oficial: "2026-04-27", // 2 dias úteis de atraso
      }),
      makeObra({
        id: "board-atraso-medio",
        customer_name: "Cliente Atraso Médio Board",
        nome: "Obra Atraso Médio Board",
        etapa: "Execução",
        entrega_oficial: "2026-04-01", // ~20 dias úteis de atraso
      }),
    ];

    setObras(obrasBoard);

    const { container } = render(
      <Wrapper route="/gestao/painel-obras?view=board">
        <PainelObras />
      </Wrapper>,
    );

    // O board agrupa por etapa canônica + semana. Como nenhum item tem
    // `inicio_etapa`, todos caem no grupo "Execução" (chave Execução::S?).
    const groupContainer = container.querySelector<HTMLElement>(
      '[id^="board-group-Execução"]',
    );
    expect(groupContainer, "grupo Execução não renderizado").not.toBeNull();

    const rows = within(groupContainer!).getAllByTestId("painel-obras-row");
    const order = rows.map(
      (r) =>
        within(r)
          .getByTestId("painel-obras-cell-cliente")
          .textContent?.trim() ?? "",
    );

    const idxMedio = order.findIndex((t) => t.includes("Atraso Médio"));
    const idxPequeno = order.findIndex((t) => t.includes("Atraso Pequeno"));
    const idxSaudavel = order.findIndex((t) => t.includes("Saudável"));

    expect(idxMedio).toBeGreaterThanOrEqual(0);
    expect(idxPequeno).toBeGreaterThanOrEqual(0);
    expect(idxSaudavel).toBeGreaterThanOrEqual(0);

    // Atrasadas no topo do grupo, mais atrasada primeiro; saudável ao final.
    expect(idxMedio).toBe(0);
    expect(idxMedio).toBeLessThan(idxPequeno);
    expect(idxPequeno).toBeLessThan(idxSaudavel);
  });

  it("board: cada obra cai na coluna da própria etapa e atrasadas têm precedência sobre a ordem canônica dentro do grupo", () => {
    // Fixture cobre 2 etapas (Medição e Execução), com obra atrasada e
    // saudável em cada uma. O board agrupa por etapa, então a regra
    // "atrasadas primeiro" não muda a ORDEM DAS COLUNAS (que segue a ordem
    // canônica de `ETAPA_OPTIONS`), mas precisa valer para os CARDS dentro
    // de cada coluna — inclusive em etapas precoces como Medição, onde
    // antes da regra de urgência a saudável apareceria primeiro só por ter
    // sido inserida antes.
    const obrasBoard: PainelObra[] = [
      makeObra({
        id: "med-saudavel",
        customer_name: "Cliente Med Saudável",
        nome: "Obra Med Saudável",
        etapa: "Medição",
        entrega_oficial: "2026-07-15",
      }),
      makeObra({
        id: "med-atrasada",
        customer_name: "Cliente Med Atrasada",
        nome: "Obra Med Atrasada",
        etapa: "Medição",
        entrega_oficial: "2026-04-10", // ~13 dias úteis de atraso
      }),
      makeObra({
        id: "exec-saudavel",
        customer_name: "Cliente Exec Saudável",
        nome: "Obra Exec Saudável",
        etapa: "Execução",
        entrega_oficial: "2026-07-30",
      }),
      makeObra({
        id: "exec-atrasada",
        customer_name: "Cliente Exec Atrasada",
        nome: "Obra Exec Atrasada",
        etapa: "Execução",
        entrega_oficial: "2026-04-20", // ~7 dias úteis de atraso
      }),
    ];

    setObras(obrasBoard);

    const { container } = render(
      <Wrapper route="/gestao/painel-obras?view=board">
        <PainelObras />
      </Wrapper>,
    );

    // ── Helpers ──────────────────────────────────────────────────────────
    const readGroupClientes = (idPrefix: string): string[] => {
      const group = container.querySelector<HTMLElement>(
        `[id^="board-group-${idPrefix}"]`,
      );
      expect(group, `grupo "${idPrefix}" não renderizado`).not.toBeNull();
      return within(group!)
        .getAllByTestId("painel-obras-row")
        .map(
          (r) =>
            within(r)
              .getByTestId("painel-obras-cell-cliente")
              .textContent?.trim() ?? "",
        );
    };

    // ── Membership: cada obra está na coluna esperada ────────────────────
    const medGroup = readGroupClientes("Medição");
    const execGroup = readGroupClientes("Execução");

    expect(medGroup.some((t) => t.includes("Med Saudável"))).toBe(true);
    expect(medGroup.some((t) => t.includes("Med Atrasada"))).toBe(true);
    expect(medGroup.some((t) => t.includes("Exec"))).toBe(false);

    expect(execGroup.some((t) => t.includes("Exec Saudável"))).toBe(true);
    expect(execGroup.some((t) => t.includes("Exec Atrasada"))).toBe(true);
    expect(execGroup.some((t) => t.includes("Med"))).toBe(false);

    // ── Precedência: atrasada > saudável dentro de cada coluna ───────────
    const medAtrasadaIdx = medGroup.findIndex((t) =>
      t.includes("Med Atrasada"),
    );
    const medSaudavelIdx = medGroup.findIndex((t) =>
      t.includes("Med Saudável"),
    );
    expect(medAtrasadaIdx).toBe(0);
    expect(medAtrasadaIdx).toBeLessThan(medSaudavelIdx);

    const execAtrasadaIdx = execGroup.findIndex((t) =>
      t.includes("Exec Atrasada"),
    );
    const execSaudavelIdx = execGroup.findIndex((t) =>
      t.includes("Exec Saudável"),
    );
    expect(execAtrasadaIdx).toBe(0);
    expect(execAtrasadaIdx).toBeLessThan(execSaudavelIdx);

    // ── Ordem das colunas: continua canônica (Medição antes de Execução) ─
    // A regra "atrasadas primeiro" age dentro do grupo, não promove a
    // coluna inteira para o topo do board.
    const groupButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[aria-controls^="board-group-"]',
      ),
    );
    const labels = groupButtons.map((b) => b.textContent?.trim() ?? "");
    const idxMedCol = labels.findIndex((l) => l.startsWith("Medição"));
    const idxExecCol = labels.findIndex((l) => l.startsWith("Execução"));
    expect(idxMedCol).toBeGreaterThanOrEqual(0);
    expect(idxExecCol).toBeGreaterThanOrEqual(0);
    expect(idxMedCol).toBeLessThan(idxExecCol);
  });

  it("tabela: filtro de período exclui obras sem `scheduled` e mantém a ordenação por atraso entre as remanescentes", () => {
    // Cenário: 4 obras, sendo uma SEM atividade na semana (some) e três
    // visíveis — uma atrasada média, uma atrasada pequena e uma saudável.
    // Validamos que: (a) a obra fora do período não renderiza e
    // (b) a ordenação padrão (atrasadas primeiro) continua valendo entre
    // as obras filtradas, junto da presença de `overduePrior` no bucket.
    const obrasPeriodo: PainelObra[] = [
      makeObra({
        id: "fora-do-periodo",
        customer_name: "Cliente Fora do Período",
        nome: "Obra Fora do Período",
        etapa: "Execução",
        entrega_oficial: "2026-03-15", // atrasada, mas sem atividade na semana
      }),
      makeObra({
        id: "saudavel-no-periodo",
        customer_name: "Cliente Saudável Período",
        nome: "Obra Saudável Período",
        etapa: "Medição",
        entrega_oficial: "2026-07-10",
      }),
      makeObra({
        id: "atraso-pequeno-periodo",
        customer_name: "Cliente Atraso Pequeno Período",
        nome: "Obra Atraso Pequeno Período",
        etapa: "Execução",
        entrega_oficial: "2026-04-27",
      }),
      makeObra({
        id: "atraso-medio-periodo",
        customer_name: "Cliente Atraso Médio Período",
        nome: "Obra Atraso Médio Período",
        etapa: "Execução",
        entrega_oficial: "2026-04-01",
      }),
    ];

    setObras(obrasPeriodo);
    setPeriodExcluded(["fora-do-periodo"]);
    // Anexa um overduePrior à obra com atraso médio para garantir que o
    // mock honra o segundo bucket sem afetar o filtro (`scheduled` é o que
    // controla a visibilidade).
    setPeriodOverduePrior({
      "atraso-medio-periodo": [
        {
          id: "prior-1",
          project_id: "atraso-medio-periodo",
          description: "Atividade anterior em aberto",
          etapa: "Medição",
          planned_start: PERIOD_PRIOR_ISO,
          planned_end: PERIOD_PRIOR_ISO,
          actual_start: null,
          actual_end: null,
          parent_activity_id: null,
          responsible_name: null,
        },
      ],
    });

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

    // (a) Obra sem `scheduled` foi filtrada
    expect(order.some((t) => t.includes("Fora do Período"))).toBe(false);
    // As três remanescentes aparecem
    expect(order).toHaveLength(3);

    // (b) Ordenação padrão preservada: atrasada média antes da pequena;
    // saudável por último.
    const idxMedio = order.findIndex((t) => t.includes("Atraso Médio"));
    const idxPequeno = order.findIndex((t) => t.includes("Atraso Pequeno"));
    const idxSaudavel = order.findIndex((t) => t.includes("Saudável"));
    expect(idxMedio).toBe(0);
    expect(idxMedio).toBeLessThan(idxPequeno);
    expect(idxPequeno).toBeLessThan(idxSaudavel);
  });
});
