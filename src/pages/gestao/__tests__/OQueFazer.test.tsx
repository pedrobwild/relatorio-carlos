/**
 * Tela "O que fazer": pendências das obras, mais grave primeiro, botão para
 * onde se resolve, atalho para o Hoje e "minhas / todas".
 * As regras estão em oQueFazer.test.ts e proximoPasso.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ObraRow } from "@/lib/obrasPainel";

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  loading: false,
  error: null as string | null,
  dayItems: [] as { outcome: string | null }[],
  etapas: [] as { projectId: string; projectName: string; etapas: unknown[] }[],
}));

vi.mock("@/hooks/useObrasPainel", () => ({
  useObrasPainel: () => ({
    rows: h.rows,
    projetos: [],
    concluidas: [],
    isLoading: h.loading,
    error: h.error,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useOps", () => ({ useOpsDay: () => ({ data: h.dayItems }) }));
vi.mock("@/hooks/useEtapasHoje", () => ({ useEtapasHoje: () => ({ groups: h.etapas }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "eu" } }) }));

import OQueFazer from "../OQueFazer";

const base: ObraRow = {
  id: "x",
  name: "Obra",
  customer: null,
  responsibleId: "eu",
  responsible: "Eu",
  deadline: "2026-11-27",
  projectedEnd: "2026-11-20",
  slack: 5,
  penalty: 0,
  progress: 50,
  consumed: 50,
  week: { stages: [], planned: 3, done: 1, notDone: 0, unplanned: false },
  alerts: [],
  risk: "verde",
  cadastro: { etapa: "Execução", relationship: null, paused: false },
  nextWeekPlanned: 2,
};
const mk = (p: Partial<ObraRow>): ObraRow => ({ ...base, ...p });
const render_ = () =>
  render(
    <MemoryRouter>
      <OQueFazer />
    </MemoryRouter>,
  );

describe("O que fazer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    h.loading = false;
    h.error = null;
    h.dayItems = [];
    h.etapas = [];
    h.rows = [
      mk({
        id: "a",
        name: "Apto 82",
        alerts: [{ kind: "critica_nao_feita", tone: "destructive", text: "Crítica não feita: Impermeabilização" }],
        week: { stages: [], planned: 0, done: 0, notDone: 0, unplanned: true },
      }),
      mk({ id: "b", name: "Studio 1204", deadline: null }),
      mk({ id: "c", name: "Loft da outra pessoa", responsibleId: "outra", week: { stages: [], planned: 0, done: 0, notDone: 0, unplanned: true } }),
    ];
  });

  it("agrupa por gravidade, com o botão para onde se resolve", () => {
    render_();
    expect(screen.getByText(/coisas para resolver em 2 obras/)).toBeInTheDocument();
    const urgente = screen.getByRole("region", { name: /Urgente/ });
    expect(within(urgente).getByText("Remarcar o que não foi feito: Impermeabilização")).toBeInTheDocument();
    expect(within(urgente).getByRole("link", { name: /Abrir a semana/ }).getAttribute("href")).toMatch(
      /^\/gestao\/semana\?obra=a&semana=\d{4}-\d{2}-\d{2}$/,
    );
    const atencao = screen.getByRole("region", { name: /Precisa de atenção/ });
    expect(within(atencao).getByText("Planejar esta semana (nenhum dia marcado)")).toBeInTheDocument();
    const depois = screen.getByRole("region", { name: /Quando der/ });
    expect(within(depois).getByText("Cadastrar o prazo do contrato")).toBeInTheDocument();
    expect(within(depois).getByRole("link", { name: /Abrir a obra/ })).toHaveAttribute("href", "/gestao/painel-obras?obra=b");
    // Obra de outra pessoa fica de fora em "Minhas obras".
    expect(screen.queryByText("Loft da outra pessoa")).toBeNull();
  });

  it("'Todas as obras' inclui as dos outros e a escolha fica guardada", () => {
    render_();
    fireEvent.click(screen.getByRole("radio", { name: "Todas as obras" }));
    expect(screen.getAllByText("Loft da outra pessoa").length).toBeGreaterThan(0);
    expect(window.localStorage.getItem("bwild.oQueFazer.escopo")).toBe("todas");
  });

  it("atalho para o Hoje com o que falta confirmar", () => {
    h.dayItems = [{ outcome: null }, { outcome: "feito" }, { outcome: null }];
    h.etapas = [{ projectId: "a", projectName: "Apto 82", etapas: [{}] }];
    render_();
    expect(screen.getByText(/2 serviços para confirmar · 1 etapa para dizer se começou ou terminou/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir o Hoje/ })).toHaveAttribute("href", "/gestao/hoje");
  });

  it("tudo em dia", () => {
    h.rows = [mk({ id: "z", name: "Casa Verde", andamento: undefined, deadline: "2026-12-01" })].map((r) => ({
      ...r,
      // Com cronograma e nada pendente.
      andamento: {
        etapas: [],
        atual: null,
        posicao: null,
        fase: "andamento",
        agora: [],
        proximaSemana: [],
        continuaProximaSemana: [],
        semanaQueVem: { from: "2026-10-19", to: "2026-10-25" },
        proximo: null,
        concluidas: 0,
        inicio: "2026-10-01",
        fim: "2026-12-01",
      },
    })) as unknown[];
    render_();
    expect(screen.getByText("Tudo em dia")).toBeInTheDocument();
    expect(screen.getByText(/Em dia, sem pendência: Casa Verde/)).toBeInTheDocument();
  });
});
