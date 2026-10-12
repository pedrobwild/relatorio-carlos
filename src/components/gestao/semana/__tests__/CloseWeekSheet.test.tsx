/**
 * Fechar semana: confirmar o que ficou sem resposta, ver o PPC e gravar.
 * Os números gravados vêm do banco; aqui a tela só informa obra e semana.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import type { OpsAssignment, OpsWeekClosing } from "@/infra/repositories/ops.repository";

const h = vi.hoisted(() => ({
  setOutcome: vi.fn(),
  closeWeek: vi.fn(),
  reopenWeek: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/hooks/useOps", () => ({
  useSetAssignmentOutcome: () => ({ mutateAsync: h.setOutcome, isPending: false }),
  useCloseOpsWeek: () => ({ mutateAsync: h.closeWeek, isPending: false }),
  useReopenOpsWeek: () => ({ mutateAsync: h.reopenWeek, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: h.success, error: vi.fn() } }));

import { CloseWeekSheet } from "../CloseWeekSheet";

// Semana de 05/10/2026; "hoje" = sexta, 09/10.
const MON = "2026-10-05";
const TODAY = "2026-10-09";

const asg = (id: string, work_date: string, extra: Partial<OpsAssignment> = {}) =>
  ({
    id,
    activity_id: "a1",
    project_id: "p1",
    work_date,
    outcome: null,
    not_done_reason: null,
    user_id: null,
    worker_name: "João",
    fornecedor_id: null,
    ...extra,
  }) as OpsAssignment;

const closingRow = (over: Partial<OpsWeekClosing> = {}): OpsWeekClosing => ({
  id: "c1",
  project_id: "p1",
  week_start: MON,
  planned: 3,
  done: 2,
  not_done: 1,
  reasons: { material: 1 },
  notes: "choveu na quarta",
  closed_by: "u1",
  closed_at: "2026-10-09T20:00:00Z",
  ...over,
});

const onOpenChange = vi.fn();

function renderSheet(props: Partial<React.ComponentProps<typeof CloseWeekSheet>> = {}) {
  return render(
    <CloseWeekSheet
      open
      onOpenChange={onOpenChange}
      projectId="p1"
      monday={MON}
      weekText="Semana de 05/10 a 09/10"
      today={TODAY}
      assignments={[
        asg("d1", "2026-10-05", { outcome: "feito" }),
        asg("d2", "2026-10-06", { outcome: "nao_feito", not_done_reason: "material" }),
        asg("d3", "2026-10-07"),
        asg("d4", "2026-10-08"),
      ]}
      activities={[{ id: "a1", title: "Passar conduíte", stage_name: "Elétrica" }]}
      staffNameById={new Map([["u1", "Bruna Sampaio"]])}
      closing={null}
      history={[]}
      {...props}
    />,
  );
}

const fechar = () => screen.getByRole("button", { name: "Fechar semana" });
const ppc = () => screen.getByRole("region", { name: "PPC da semana" });

describe("CloseWeekSheet", () => {
  beforeEach(() => {
    h.setOutcome.mockReset().mockResolvedValue({});
    h.closeWeek.mockReset().mockResolvedValue({ planned: 4, done: 3 });
    h.reopenWeek.mockReset().mockResolvedValue(null);
    h.success.mockReset();
    onOpenChange.mockReset();
  });

  it("mostra o PPC parcial e não deixa fechar com dia sem confirmação", () => {
    renderSheet();
    expect(within(ppc()).getByText("PPC até agora")).toBeInTheDocument();
    expect(within(ppc()).getByText("25%")).toBeInTheDocument();
    expect(within(ppc()).getByText(/1 de 4 dias feitos · 1 não feito/)).toBeInTheDocument();
    expect(screen.getByText("Falta confirmar · 2")).toBeInTheDocument();
    expect(fechar()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Falta confirmar 2 dias.");
  });

  it("'Feito' grava na hora e tira o dia da lista", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Feito: Passar conduíte, qua 07" }));
    expect(h.setOutcome).toHaveBeenCalledWith({ id: "d3", outcome: "feito", reason: null });
    expect(screen.getByText("Falta confirmar · 1")).toBeInTheDocument();
    expect(within(ppc()).getByText("50%")).toBeInTheDocument();
    await waitFor(() => expect(h.setOutcome).toHaveBeenCalledTimes(1));
  });

  it("'Não feito' pede o motivo (dois toques) e o dia vai para a lista de não feitos", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Não feito: Passar conduíte, qui 08" }));
    expect(h.setOutcome).not.toHaveBeenCalled();
    const motivos = screen.getByRole("group", { name: /Motivo de Passar conduíte/ });
    expect(within(motivos).getAllByRole("button")).toHaveLength(7);
    fireEvent.click(within(motivos).getByRole("button", { name: "Clima" }));
    expect(h.setOutcome).toHaveBeenCalledWith({ id: "d4", outcome: "nao_feito", reason: "clima" });
    expect(screen.getByText("Não feitos · 2")).toBeInTheDocument();
    expect(screen.getByText("Clima (1) · Faltou material (1)")).toBeInTheDocument();
  });

  it("se o banco recusar, o dia volta para a lista", async () => {
    h.setOutcome.mockRejectedValue(new Error("sem conexão"));
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Feito: Passar conduíte, qua 07" }));
    await waitFor(() => expect(screen.getByText("Falta confirmar · 2")).toBeInTheDocument());
    expect(fechar()).toBeDisabled();
  });

  it("'Marcar os N como feitos' confirma todos e libera o fechamento", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Marcar os 2 como feitos" }));
    await waitFor(() => expect(h.setOutcome).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fechar()).toBeEnabled());
    expect(within(ppc()).getByText("75%")).toBeInTheDocument();
    expect(screen.queryByText(/Falta confirmar/)).toBeNull();
  });

  it("fechar grava só obra, semana e observação — os números são do banco", async () => {
    renderSheet({ assignments: [asg("d1", "2026-10-05", { outcome: "feito" }), asg("d2", "2026-10-06", { outcome: "feito" })] });
    expect(within(ppc()).getByText("100%")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Observação da semana (opcional)"), { target: { value: "  semana cheia  " } });
    fireEvent.click(fechar());
    await waitFor(() =>
      expect(h.closeWeek).toHaveBeenCalledWith({ project_id: "p1", week_start: MON, notes: "semana cheia" }),
    );
    // O aviso usa o que o banco devolveu (3 de 4), não a conta da tela.
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Semana fechada · PPC 75%"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("dia marcado para frente: não dá para confirmar nem fechar ainda", () => {
    renderSheet({
      today: "2026-10-07",
      assignments: [asg("d1", "2026-10-05", { outcome: "feito" }), asg("d5", "2026-10-09")],
    });
    expect(screen.queryByText(/Falta confirmar ·/)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Ainda há 1 dia marcado para frente (sex 09)");
    expect(fechar()).toBeDisabled();
  });

  it("semana sem nada marcado: não há o que fechar", () => {
    renderSheet({ assignments: [] });
    expect(within(ppc()).getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Nada foi marcado nesta semana");
    expect(fechar()).toBeDisabled();
    expect(screen.queryByLabelText("Observação da semana (opcional)")).toBeNull();
  });

  it("corrigir o motivo de um não feito grava o novo motivo", async () => {
    renderSheet();
    const motivo = screen.getByRole("combobox", { name: "Motivo de Passar conduíte, ter 06" });
    expect(motivo).toHaveTextContent("Faltou material");
    fireEvent.click(motivo);
    fireEvent.click(await screen.findByRole("option", { name: "Clima" }));
    expect(h.setOutcome).toHaveBeenCalledWith({ id: "d2", outcome: "nao_feito", reason: "clima" });
    expect(screen.getByText("Clima (1)")).toBeInTheDocument();
  });

  it("não deixa fechar enquanto a resposta do último dia ainda está sendo gravada", async () => {
    let liberar: (v: unknown) => void = () => undefined;
    h.setOutcome.mockReturnValue(new Promise((resolve) => (liberar = resolve)));
    renderSheet({ assignments: [asg("d1", "2026-10-05", { outcome: "feito" }), asg("d3", "2026-10-07")] });
    fireEvent.click(screen.getByRole("button", { name: "Feito: Passar conduíte, qua 07" }));
    // Na tela já está tudo confirmado, mas o banco ainda não respondeu.
    expect(screen.queryByText(/Falta confirmar/)).toBeNull();
    expect(fechar()).toBeDisabled();
    liberar({});
    await waitFor(() => expect(fechar()).toBeEnabled());
  });

  it("a observação acompanha o fechamento que chega depois de abrir, sem apagar o que foi digitado", () => {
    const feitos = [asg("d1", "2026-10-05", { outcome: "feito" })];
    const { rerender } = renderSheet({ assignments: feitos });
    const campo = () => screen.getByLabelText("Observação da semana (opcional)");
    expect(campo()).toHaveValue("");
    const props = {
      open: true, onOpenChange, projectId: "p1", monday: MON, weekText: "", today: TODAY, assignments: feitos,
      activities: [], staffNameById: new Map<string, string>(), history: [],
    };
    rerender(<CloseWeekSheet {...props} closing={closingRow({ planned: 1, done: 1, not_done: 0, reasons: {} })} />);
    expect(campo()).toHaveValue("choveu na quarta");

    fireEvent.change(campo(), { target: { value: "minha nota" } });
    rerender(<CloseWeekSheet {...props} closing={closingRow({ planned: 1, done: 1, not_done: 0, reasons: {}, notes: "outra" })} />);
    expect(campo()).toHaveValue("minha nota");
  });

  it("semana já fechada: mostra quem fechou, a observação e as semanas anteriores; dá para reabrir", async () => {
    renderSheet({
      assignments: [
        asg("d1", "2026-10-05", { outcome: "feito" }),
        asg("d2", "2026-10-06", { outcome: "feito" }),
        asg("d3", "2026-10-07", { outcome: "nao_feito", not_done_reason: "material" }),
      ],
      closing: closingRow(),
      history: [closingRow(), closingRow({ id: "c0", week_start: "2026-09-28", planned: 10, done: 6, not_done: 4 })],
    });
    expect(screen.getByRole("heading", { name: "Fechamento da semana" })).toBeInTheDocument();
    expect(within(ppc()).getByText(/Fechada em 09\/10 por Bruna Sampaio com PPC 67%/)).toBeInTheDocument();
    expect(within(ppc()).getByText("Semanas anteriores: 28/09 60%")).toBeInTheDocument();
    expect(within(ppc()).queryByText(/mudaram depois/)).toBeNull();
    expect(screen.getByLabelText("Observação da semana (opcional)")).toHaveValue("choveu na quarta");
    expect(screen.getByRole("button", { name: "Atualizar fechamento" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Reabrir semana" }));
    await waitFor(() => expect(h.reopenWeek).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(h.success).toHaveBeenCalledWith("Semana reaberta"));
  });

  it("avisa quando os dias mudaram depois do fechamento", () => {
    renderSheet({
      assignments: [asg("d1", "2026-10-05", { outcome: "feito" }), asg("d2", "2026-10-06", { outcome: "feito" })],
      closing: closingRow(),
    });
    expect(within(ppc()).getByText(/Os dias mudaram depois do fechamento/)).toBeInTheDocument();
  });
});
