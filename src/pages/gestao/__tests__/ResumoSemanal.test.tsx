/**
 * Resumo da semana: números, lista de atenção (com link para a obra no
 * Painel), adoção por gestor (tabela no computador, cartões no celular),
 * "Copiar resumo" e o bloqueio de acesso. As contas estão em
 * resumoSemanal.test.ts; aqui o resumo vem pronto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ObraRow } from "@/lib/obrasPainel";
import { buildResumo, type ResumoSemanal } from "@/lib/resumoSemanal";

const h = vi.hoisted(() => ({
  allowed: true,
  canLoading: false,
  mobile: false,
  loading: false,
  error: null as string | null,
  historyError: null as string | null,
  resumo: null as unknown,
  hookCalls: 0,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useResumoSemanal", () => ({
  useResumoSemanal: () => {
    h.hookCalls++;
    return {
      resumo: h.resumo,
      isLoading: h.loading,
      error: h.error,
      historyError: h.historyError,
      refetch: vi.fn(),
    };
  },
}));
vi.mock("@/hooks/useCan", () => ({
  useCan: () => ({ can: (f: string) => f === "portfolio:resumo" && h.allowed, loading: h.canLoading }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => h.mobile }));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));

import ResumoSemanalPage from "../ResumoSemanal";

const base: ObraRow = {
  id: "x",
  name: "Obra",
  customer: null,
  responsibleId: "ana",
  responsible: "Ana",
  deadline: "2026-12-30",
  projectedEnd: "2026-12-01",
  slack: 10,
  penalty: 0,
  progress: 50,
  consumed: 40,
  week: { stages: [], planned: 0, done: 0, notDone: 0, unplanned: false },
  alerts: [],
  risk: "verde",
  cadastro: { etapa: "Execução", relationship: null, paused: false },
};
const row = (p: Partial<ObraRow>): ObraRow => ({ ...base, ...p });

function fixture(): ResumoSemanal {
  return buildResumo({
    today: "2026-10-12",
    rows: [
      row({
        id: "r1",
        name: "Ap 1204 Vila Mariana",
        risk: "vermelho",
        slack: -4,
        penalty: 3200,
        alerts: [{ kind: "etapa_atrasada", tone: "destructive", text: "Pintura atrasada 4 dias" }],
      }),
      row({
        id: "y1",
        name: "Casa Alto de Pinheiros",
        responsibleId: "bruno",
        responsible: "Bruno",
        risk: "amarelo",
        slack: 1,
        deadline: "2026-10-20",
        alerts: [{ kind: "material", tone: "warning", text: "Falta material: porcelanato (qua)" }],
      }),
      row({ id: "g1", name: "Loft Itaim", responsibleId: "bruno", responsible: "Bruno" }),
    ],
    assignments: [
      { project_id: "r1", work_date: "2026-10-06" },
      { project_id: "y1", work_date: "2026-10-07" },
    ],
    closings: [{ project_id: "r1", week_start: "2026-10-05", planned: 5, done: 4, reasons: { material: 1 } }],
  });
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/gestao/resumo"]}>
      <ResumoSemanalPage />
    </MemoryRouter>,
  );

describe("Resumo da semana", () => {
  beforeEach(() => {
    h.allowed = true;
    h.canLoading = false;
    h.mobile = false;
    h.loading = false;
    h.error = null;
    h.historyError = null;
    h.resumo = fixture();
    h.hookCalls = 0;
    h.toastSuccess.mockReset();
    h.toastError.mockReset();
  });

  it("sem a permissão mostra 'sem acesso' e não carrega dados", () => {
    h.allowed = false;
    renderPage();
    expect(screen.getByText("Sem acesso ao resumo da semana")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copiar resumo/ })).toBeNull();
    expect(h.hookCalls).toBe(0);
  });

  it("mostra os números grandes da semana e da carteira", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Resumo da semana" })).toBeInTheDocument();
    expect(screen.getByText("Semana que passou: 5–11/out")).toBeInTheDocument();
    const nums = within(screen.getByLabelText("Números da semana"));
    expect(nums.getByText("80%")).toBeInTheDocument(); // PPC 4/5
    expect(nums.getByText("4 de 5 dias feitos")).toBeInTheDocument();
    expect(nums.getByText("1/2")).toBeInTheDocument(); // fecharam / planejadas
    expect(nums.getByText("1 sem planejamento")).toBeInTheDocument();
    expect(nums.getByText("No vermelho").nextElementSibling).toHaveTextContent("1");
    expect(nums.getByText("Em atenção").nextElementSibling).toHaveTextContent("1");
    expect(nums.getByText(/3\.200/)).toBeInTheDocument();
    expect(nums.getByText("Casa Alto de Pinheiros (20/10)")).toBeInTheDocument();
  });

  it("lista de atenção: vermelho primeiro, um motivo, link para a obra no Painel", () => {
    renderPage();
    const section = screen.getByRole("region", { name: "Precisa de atenção" });
    const links = within(section).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Ap 1204 Vila Mariana");
    expect(links[0]).toHaveTextContent("No vermelho");
    expect(links[0]).toHaveTextContent("Pintura atrasada 4 dias");
    expect(links[0]).toHaveAttribute("href", "/gestao/obras?obra=r1");
    expect(links[1]).toHaveTextContent("Falta material: porcelanato (qua)");
  });

  it("adoção: uma linha por gestor, menor adoção primeiro (tabela no computador)", () => {
    renderPage();
    const section = screen.getByRole("region", { name: "Adoção por gestor" });
    const rows = within(section).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["Bruno", "Ana"]);
    expect(rows[0]).toHaveTextContent("0%");
    expect(rows[1]).toHaveTextContent("25%");
    expect(rows[1]).toHaveTextContent("80%"); // PPC da Ana
  });

  it("no celular a adoção vira cartões", () => {
    h.mobile = true;
    renderPage();
    const section = screen.getByRole("region", { name: "Adoção por gestor" });
    expect(within(section).queryByRole("table")).toBeNull();
    const cards = within(section).getAllByRole("listitem").filter((li) => li.querySelector("p"));
    expect(cards[0]).toHaveTextContent("Bruno");
    expect(cards[0]).toHaveTextContent("Esta semana: 0/2 planejadas");
  });

  it("motivos do não feito com rótulo em português", () => {
    renderPage();
    const section = screen.getByRole("region", { name: "Por que não foi feito" });
    expect(section).toHaveTextContent("Faltou material");
    expect(section).toHaveTextContent("1 dia");
  });

  it("Copiar resumo manda o texto do WhatsApp para a área de transferência", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Copiar resumo/ }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0] as string;
    expect(text.split("\n")[0]).toBe("*Resumo da semana 5–11/out*");
    expect(text).toContain("Ap 1204 Vila Mariana: Pintura atrasada 4 dias");
    expect(text).toContain("• Bruno (2 obras)");
  });

  it("sem clipboard usa o caminho antigo; se falhar, avisa", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const exec = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Copiar resumo/ }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("erro do planejamento semanal não derruba a carteira", () => {
    h.historyError = "Sem conexão";
    renderPage();
    expect(screen.getByText("Não deu para carregar o planejamento semanal")).toBeInTheDocument();
    expect(screen.getByText("Precisa de atenção")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Por que não foi feito" })).toBeNull();
  });

  it("erro das obras mostra a mensagem e esconde o botão ativo", () => {
    h.error = "Falhou";
    renderPage();
    expect(screen.getByText("Não deu para carregar o resumo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copiar resumo/ })).toBeDisabled();
  });
});
