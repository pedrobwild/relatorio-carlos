import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProjectDeadline } from "@/infra/repositories/contractDeadline.repository";

const mutate = vi.fn();
let deadline: Partial<ProjectDeadline> | null = null;

vi.mock("@/hooks/useContractDeadline", () => ({
  useProjectDeadline: () => ({ data: deadline, isLoading: false }),
  useUpdateContractTerms: () => ({ mutate, isPending: false }),
}));
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
});
