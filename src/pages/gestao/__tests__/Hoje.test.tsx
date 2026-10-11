/**
 * Tela Hoje (Fase 3): fluxos de confirmação no celular.
 * Hooks de dados mockados: aqui testamos a tela, não o banco.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { OpsDayAssignment } from "@/infra/repositories/ops.repository";
import { todayISO, shiftISODate } from "@/lib/hojeDia";

const h = vi.hoisted(() => ({
  items: [] as unknown[],
  mutate: vi.fn(),
  readiness: [] as { id: string; materials_missing: number }[],
}));

vi.mock("@/hooks/useOps", () => ({
  useOpsDay: () => ({ data: h.items, isLoading: false, isError: false, refetch: vi.fn(), isFetching: false }),
  useOpsReadiness: () => ({ data: h.readiness }),
  useSetAssignmentOutcome: () => ({ mutate: h.mutate, isPending: false, variables: undefined }),
  useOpsPhotoUrls: () => ({ data: [] }),
  useAddAssignmentPhotos: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOpsStages: () => ({ data: [], isLoading: false }),
  useOpsActivities: () => ({ data: [] }),
  useCreateOpsActivity: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateOpsAssignment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u-me" } }) }));
vi.mock("@/hooks/useStaffUsers", () => ({
  useStaffUsers: () => ({ data: [{ id: "u-me", nome: "Pedro", email: "p@x", perfil: "gestor" }] }),
}));
vi.mock("@/hooks/useContractDeadline", () => ({ useObraDeadlines: () => ({ data: [] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Hoje from "../Hoje";

function item(over: Partial<OpsDayAssignment> & { id: string }): OpsDayAssignment {
  const title = (over as { title?: string }).title ?? `Atividade ${over.id}`;
  return {
    activity_id: `act-${over.id}`,
    created_at: "2026-10-14T08:00:00Z",
    created_by: null,
    done_at: null,
    done_by: null,
    fornecedor_id: null,
    not_done_reason: null,
    notes: null,
    outcome: null,
    photo_paths: [],
    project_id: "p1",
    updated_at: "2026-10-14T08:00:00Z",
    user_id: null,
    work_date: todayISO(),
    worker_name: "João",
    activity: { id: `act-${over.id}`, title, status: "planejada", stage_id: "s1", project_id: "p1", is_critical: false, stage: { description: "Elétrica" } },
    project: { id: "p1", name: "Obra Moema" },
    fornecedor: null,
    ...over,
  };
}

const renderAt = (search = "") =>
  render(
    <MemoryRouter initialEntries={[`/gestao/hoje${search}`]}>
      <Hoje />
    </MemoryRouter>,
  );

describe("Tela Hoje", () => {
  beforeEach(() => {
    h.mutate.mockReset();
    h.readiness = [];
    h.items = [
      item({ id: "1" }),
      item({ id: "2", outcome: "feito", done_by: "u-me", done_at: new Date().toISOString() }),
      item({ id: "3", project_id: "p2", project: { id: "p2", name: "Obra Alphaville" } }),
    ];
  });

  it("mostra o progresso do dia e agrupa por obra", () => {
    renderAt();
    expect(screen.getByRole("heading", { level: 1, name: "Hoje" })).toBeInTheDocument();
    expect(screen.getByText("1 de 3 confirmados")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Obra Moema" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Obra Alphaville" })).toBeInTheDocument();
    expect(screen.getByText(/Feito às \d\d:\d\d · Pedro/)).toBeInTheDocument();
  });

  it("Feito com um toque", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como feito: Atividade 1" }));
    expect(h.mutate).toHaveBeenCalledWith({ id: "1", outcome: "feito" }, expect.any(Object));
  });

  it("Não feito exige motivo antes de confirmar", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como não feito: Atividade 1" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Confirmar não feito" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Faltou material" }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(h.mutate).toHaveBeenCalledWith(
      { id: "1", outcome: "nao_feito", reason: "material", notes: null },
      expect.any(Object),
    );
  });

  it("motivo 'Outro' exige observação", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como não feito: Atividade 1" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: "Outro" }));
    const confirm = within(dialog).getByRole("button", { name: "Confirmar não feito" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Observação/), { target: { value: "Vizinho reclamou" } });
    expect(confirm).toBeEnabled();
  });

  it("desfazer volta para pendente", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer confirmação: Atividade 2" }));
    expect(h.mutate).toHaveBeenCalledWith({ id: "2", outcome: null }, expect.any(Object));
  });

  it("avisa material faltando na atividade pendente", () => {
    h.readiness = [{ id: "act-1", materials_missing: 2 }];
    renderAt();
    expect(screen.getByText("Faltam 2 materiais na obra")).toBeInTheDocument();
  });

  it("filtro por obra", () => {
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: /^Obra Alphaville/ }));
    expect(screen.queryByRole("heading", { name: "Obra Moema" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Obra Alphaville" })).toBeInTheDocument();
  });

  it("filtro de obra sem nada no dia não esconde o trabalho das outras obras", () => {
    h.items = [item({ id: "3", project_id: "p2", project: { id: "p2", name: "Obra Alphaville" } })];
    renderAt("?obra=p1");
    expect(screen.queryByText("Nada programado para este dia")).toBeNull();
    expect(screen.getByRole("heading", { name: "Obra Alphaville" })).toBeInTheDocument();
  });

  it("dia futuro: mostra o planejado, mas não deixa confirmar", () => {
    renderAt(`?data=${shiftISODate(todayISO(), 1)}`);
    expect(screen.getByRole("heading", { level: 1, name: "Amanhã" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como feito/ })).toBeNull();
    expect(screen.getAllByText("Planejado. A confirmação abre no dia.").length).toBe(2);
  });

  it("dia vazio convida a programar", () => {
    h.items = [];
    renderAt();
    expect(screen.getByText("Nada programado para este dia")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Adicionar ao dia/ }).length).toBeGreaterThan(0);
  });
});
