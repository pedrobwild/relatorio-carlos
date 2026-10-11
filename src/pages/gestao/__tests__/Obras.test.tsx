/**
 * Tela Obras (Fase 5): resumo do topo, ordem por risco, "minhas obras",
 * semana não planejada e link para a Semana da obra.
 * Os dados vêm mockados já calculados; as regras estão em obrasPainel.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ObraRow } from "@/lib/obrasPainel";

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  loading: false,
  error: null as string | null,
  lastWeek: null as { from: string; to: string } | null,
  mobile: false,
}));

vi.mock("@/hooks/useObrasPainel", () => ({
  useObrasPainel: (week: { from: string; to: string }) => {
    h.lastWeek = week;
    return { rows: h.rows, isLoading: h.loading, error: h.error, refetch: vi.fn() };
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "eu" } }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => h.mobile }));

import Obras from "../Obras";

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

const renderPage = (search = "") =>
  render(
    <MemoryRouter initialEntries={[`/gestao/obras${search}`]}>
      <Obras />
    </MemoryRouter>,
  );

describe("Obras (Fase 5)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    h.loading = false;
    h.error = null;
    h.mobile = false;
    h.rows = [
      mk({
        id: "a",
        name: "Ap. 1204 Vila Mariana",
        responsible: "Carlos",
        responsibleId: "eu",
        risk: "vermelho",
        slack: -4,
        penalty: 3600,
        week: { stages: ["Elétrica", "Gesso"], planned: 6, done: 2, notDone: 1, unplanned: false },
        alerts: [
          { kind: "material", tone: "warning", text: "Falta material: Disjuntores (qua)" },
          { kind: "multa", tone: "destructive", text: "R$ 3.600 de multa se nada mudar" },
        ],
      }),
      mk({
        id: "b",
        name: "Studio Pinheiros",
        responsible: "Ana",
        responsibleId: "outra",
        week: { stages: ["Pintura"], planned: 0, done: 0, notDone: 0, unplanned: true },
      }),
    ];
  });

  it("mostra só três números no topo", () => {
    renderPage();
    const resumo = screen.getByLabelText("Resumo das obras");
    expect(within(resumo).getByText("Obras ativas").nextSibling).toHaveTextContent("1");
    expect(within(resumo).getByText("No vermelho").nextSibling).toHaveTextContent("1");
    expect(within(resumo).getByText("Multa projetada").nextSibling?.textContent?.replace(/\s/g, " ")).toMatch(/R\$\s?3\.600/);
  });

  it("abre em 'Minhas obras' quando sou responsável e permite ver todas", () => {
    renderPage();
    expect(screen.getByRole("radio", { name: /Minhas obras \(1\)/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("Studio Pinheiros")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Todas \(2\)/ }));
    expect(screen.getByText("Studio Pinheiros")).toBeInTheDocument();
    expect(window.localStorage.getItem("bwild.obras.escopo")).toBe("todas");
  });

  it("linha da obra: responsável, folga, semana, alerta e link para a Semana", () => {
    renderPage();
    const linha = screen.getByRole("row", { name: /Ap\. 1204/ });
    expect(within(linha).getByText("Carlos")).toBeInTheDocument();
    expect(within(linha).getByText("−4 dias")).toBeInTheDocument();
    expect(within(linha).getByText("Elétrica, Gesso")).toBeInTheDocument();
    expect(within(linha).getByText(/1 não feito/)).toBeInTheDocument();
    expect(within(linha).getByText("R$ 3.600 de multa se nada mudar")).toBeInTheDocument();
    const link = within(linha).getByRole("link", { name: /Ap\. 1204/ });
    expect(link.getAttribute("href")).toMatch(/^\/gestao\/semana\?obra=a&semana=\d{4}-\d{2}-\d{2}$/);
  });

  it("obra sem nada marcado na semana aparece como 'Não planejada'", () => {
    window.localStorage.setItem("bwild.obras.escopo", "todas");
    renderPage();
    const linha = screen.getByRole("row", { name: /Studio Pinheiros/ });
    expect(within(linha).getByText("Não planejada")).toBeInTheDocument();
    expect(screen.getByText("1 obra sem semana planejada")).toBeInTheDocument();
  });

  it("'Próxima semana' muda a semana consultada", () => {
    renderPage();
    const atual = h.lastWeek!.from;
    const grupo = screen.getByRole("radiogroup", { name: "Semana" });
    fireEvent.click(within(grupo).getAllByRole("radio")[1]);
    expect(h.lastWeek!.from > atual).toBe(true);
  });

  it("celular mostra cartões com link para a Semana", () => {
    h.mobile = true;
    renderPage();
    expect(screen.queryByRole("table")).toBeNull();
    const link = screen.getByRole("link", { name: /Ap\. 1204/ });
    expect(link.getAttribute("href")).toContain("/gestao/semana?obra=a");
  });

  it("estado vazio quando não há obra em execução", () => {
    h.rows = [];
    renderPage();
    expect(screen.getByText("Nenhuma obra em execução")).toBeInTheDocument();
  });

  it("tem atalho para o painel completo", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /Painel completo/ })).toHaveAttribute("href", "/gestao/painel-obras");
  });
});
