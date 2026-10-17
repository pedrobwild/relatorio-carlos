import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";

const mutate = vi.fn();
let deadline: Partial<ProjectDeadline> | null = null;
let query: { isLoading: boolean; isError: boolean } = { isLoading: false, isError: false };
const refetch = vi.fn();

vi.mock("@/hooks/useContractDeadline", () => ({
  useProjectDeadline: () => ({ data: deadline, ...query, isFetching: false, refetch }),
  useUpdateContractTerms: () => ({ mutate, isPending: false }),
  useContractAmendments: () => ({ data: [], isLoading: false, isError: false }),
  useUpdateAmendmentStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAmendmentDraft: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useOps", () => ({ useOpsPhotoUrls: () => ({ data: [], isLoading: false, isError: false }) }));
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import { PrazoContratualCard } from "../PrazoContratualCard";

const base: Partial<ProjectDeadline> = {
  project_id: "p1",
  contract_business_days: 60,
  contract_start_date: "2026-03-02",
  contract_start_trigger: null,
  penalty_pct_per_day: null,
  penalty_cap_pct: null,
  contract_deadline: "2026-05-28",
  current_deadline: "2026-05-28",
  current_business_days: 60,
  amendment_business_days: 0,
  amendments_pending: 0,
  business_days_elapsed: 30,
  business_days_remaining: 30,
  business_days_late: 0,
  penalty_accrued_value: null,
  contract_terms_confirmed: false,
};

describe("PrazoContratualCard", () => {
  beforeEach(() => {
    mutate.mockReset();
    toast.mockReset();
    refetch.mockReset();
    query = { isLoading: false, isError: false };
  });

  it("mostra aviso de conferência quando o prazo veio do cronograma", () => {
    deadline = { ...base };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    expect(screen.getByText(/Preenchido automaticamente/)).toBeInTheDocument();
    expect(screen.getByText("No prazo")).toBeInTheDocument();
    expect(screen.getByText(/30 de 60 decorridos/)).toBeInTheDocument();
    expect(screen.getByLabelText("Dias úteis do contrato")).toHaveValue("60");
  });

  it("obra atrasada mostra atraso e multa acumulada", () => {
    deadline = {
      ...base,
      contract_terms_confirmed: true,
      business_days_remaining: -8,
      business_days_late: 8,
      penalty_pct_per_day: 0.5,
      penalty_accrued_value: 4000,
    };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    expect(screen.getByText("Atrasada")).toBeInTheDocument();
    expect(screen.getByText("8 dias úteis")).toBeInTheDocument();
    expect(screen.getByText(/Multa acumulada/)).toHaveTextContent("4.000,00");
    expect(screen.queryByText(/Preenchido automaticamente/)).toBeNull();
    expect(screen.getByText("Conferido com o contrato")).toBeInTheDocument();
  });

  it("salva convertendo vírgula e marca como conferido", () => {
    deadline = { ...base };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    fireEvent.change(screen.getByLabelText("Multa por dia útil (%)"), { target: { value: "0,5" } });
    fireEvent.change(screen.getByLabelText("Teto da multa (%)"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e marcar como conferido" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({
      contract_business_days: 60,
      contract_start_date: "2026-03-02",
      penalty_pct_per_day: 0.5,
      penalty_cap_pct: 10,
      confirm: true,
    });
  });

  it("não salva com dados inválidos", () => {
    deadline = { ...base };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    fireEvent.change(screen.getByLabelText("Teto da multa (%)"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("sem permissão: campos desabilitados e sem botões", () => {
    deadline = { ...base };
    render(<PrazoContratualCard projectId="p1" canEdit={false} />);
    expect(screen.getByLabelText("Dias úteis do contrato")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Salvar/ })).toBeNull();
  });

  it("sem prazo cadastrado", () => {
    deadline = { ...base, contract_business_days: null, contract_start_date: null, contract_deadline: null, current_deadline: null, business_days_remaining: null };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    expect(screen.getByText("Prazo não cadastrado")).toBeInTheDocument();
    expect(screen.queryByText(/Entrega vigente/)).toBeNull();
  });

  it("prazo ainda carregando: não deixa salvar um formulário vazio por cima dos termos", () => {
    deadline = null;
    query = { isLoading: true, isError: false };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    expect(screen.getByLabelText("Dias úteis do contrato")).toBeDisabled();
    const confirmar = screen.getByRole("button", { name: "Salvar e marcar como conferido" });
    expect(confirmar).toBeDisabled();
    fireEvent.click(confirmar);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("erro ao carregar: avisa, bloqueia os campos e oferece tentar de novo", () => {
    deadline = null;
    query = { isLoading: false, isError: true };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    expect(screen.getByRole("alert")).toHaveTextContent(/Não foi possível carregar/);
    expect(screen.getByLabelText("Multa por dia útil (%)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("falha ao atualizar em segundo plano não bloqueia o que já estava na tela", () => {
    deadline = { ...base };
    query = { isLoading: false, isError: true };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Dias úteis do contrato")).toBeEnabled();
  });

  it("sem alterações: Salvar fica desabilitado", () => {
    deadline = { ...base };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    // Conferir sem mudar nada continua possível enquanto não foi conferido.
    expect(screen.getByRole("button", { name: "Salvar e marcar como conferido" })).toBeEnabled();
  });

  it('"10%" no teto é aceito como 10; texto que não é número é recusado', () => {
    deadline = { ...base };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    fireEvent.change(screen.getByLabelText("Teto da multa (%)"), { target: { value: "10%" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mutate.mock.calls[0][0]).toMatchObject({ penalty_cap_pct: 10 });

    mutate.mockReset();
    fireEvent.change(screen.getByLabelText("Multa por dia útil (%)"), { target: { value: "meio" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("obra entregue dentro do prazo aparece como no prazo, não em atenção", () => {
    deadline = { ...base, actual_end_date: "2026-05-26", business_days_remaining: 2, business_days_late: 0 };
    render(<PrazoContratualCard projectId="p1" canEdit />);
    expect(screen.getByText("No prazo")).toBeInTheDocument();
    expect(screen.queryByText("Atenção ao prazo")).toBeNull();
  });
});
