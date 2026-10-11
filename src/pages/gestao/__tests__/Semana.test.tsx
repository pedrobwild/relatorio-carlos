/**
 * Tela Semana (Fase 4): grade por etapa, resumo, planejar semana e gaveta.
 * Hooks de dados mockados; regras de negócio estão em semanaPlan.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { shiftISODate } from "@/lib/hojeDia";
import { isHoliday } from "@/lib/businessDays";
import { planningMonday } from "@/lib/semanaPlan";

const MON = planningMonday();

const h = vi.hoisted(() => ({
  createActivity: vi.fn(async () => ({ id: "novo" })),
  createAssignments: vi.fn(async () => []),
  week: [] as unknown[],
  prev: [] as unknown[],
  stages: [] as unknown[],
  activities: [] as unknown[],
}));

vi.mock("@/hooks/useOps", () => {
  const m = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useOpsStages: () => ({ data: h.stages, isLoading: false }),
    useOpsActivities: () => ({ data: h.activities, isLoading: false }),
    useOpsAssignments: (_p: string, from: string) => ({ data: from === MON ? h.week : h.prev, isLoading: false }),
    useOpsProjectMaterials: () => ({
      data: [
        { id: "m1", activity_id: "a1", description: "Massa corrida", status: "pendente", needed_by: null },
        { id: "m2", activity_id: "a1", description: "Conduíte", status: "na_obra", needed_by: null },
      ],
    }),
    useOpsActivityAssignments: () => ({ data: [] }),
    useOpsMaterials: () => ({ data: [] }),
    useOpsReviews: () => ({ data: [] }),
    useCreateOpsActivity: () => ({ ...m(), mutateAsync: h.createActivity }),
    useCreateOpsAssignments: () => ({ ...m(), mutateAsync: h.createAssignments }),
    useCreateOpsAssignment: m,
    useUpdateAssignmentPlan: m,
    useDeleteOpsAssignment: m,
    useUpdateOpsActivity: m,
    useCreateOpsReview: m,
    useCreateOpsMaterial: m,
    useSetMaterialStatus: m,
    useDeleteOpsMaterial: m,
  };
});
vi.mock("@/hooks/useStaffUsers", () => ({
  useStaffUsers: () => ({ data: [{ id: "u1", nome: "Pedro Alves", email: "", perfil: "gestor" }] }),
}));
vi.mock("@/hooks/useContractDeadline", () => ({
  useObraDeadlines: () => ({ data: [{ project_id: "p1", project_name: "Apto 142", status: "active" }], isLoading: false }),
  useProjectDeadline: () => ({
    data: { current_deadline: "2026-12-18", business_days_remaining: 40, business_days_late: 0, current_business_days: 60 },
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Semana from "../Semana";

const stage = (id: string, description: string, start: string, end: string, sort: number) => ({
  id, description, sort_order: sort, planned_start: start, planned_end: end, actual_start: null, actual_end: null,
});
const activity = (id: string, stage_id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, stage_id, title, status: "planejada", sort_order: 0, is_critical: false, late_finish: null, materials_missing: 0,
  assignments_total: 0, planned_start: null, planned_end: null, responsible_user_id: null, stage_name: null, ...extra,
});
const assignment = (id: string, activity_id: string, work_date: string, extra: Record<string, unknown> = {}) => ({
  id, activity_id, work_date, outcome: null, user_id: null, worker_name: "João", fornecedor_id: null, not_done_reason: null, ...extra,
});

const renderAt = (search = "") =>
  render(
    <MemoryRouter initialEntries={[`/gestao/semana${search}`]}>
      <Semana />
    </MemoryRouter>,
  );

describe("Tela Semana", () => {
  beforeEach(() => {
    window.localStorage.clear();
    h.createActivity.mockClear();
    h.createAssignments.mockClear();
    h.stages = [
      stage("s1", "Elétrica", shiftISODate(MON, -7), shiftISODate(MON, 2), 1),
      stage("s2", "Gesso", shiftISODate(MON, 1), shiftISODate(MON, 3), 2),
    ];
    h.activities = [activity("a1", "s1", "Passar conduíte", { materials_missing: 1, assignments_total: 2 })];
    h.week = [
      assignment("w1", "a1", shiftISODate(MON, 1), { outcome: "feito" }),
      assignment("w2", "a1", shiftISODate(MON, 3)), // depois do fim da etapa (MON+2) → ⚠
    ];
    h.prev = [];
  });

  it("sem obra escolhida, pede a obra", () => {
    renderAt();
    expect(screen.getByRole("heading", { name: "Escolha a obra" })).toBeInTheDocument();
  });

  it("lembra a última obra deste aparelho", () => {
    window.localStorage.setItem("bwild.semana.obra", "p1");
    renderAt();
    expect(screen.getByRole("columnheader", { name: /Atividade/ })).toBeInTheDocument();
  });

  it("grade por etapa: chips, ⚠ depois da data-limite e etapa prevista sem atividade", () => {
    renderAt("?obra=p1");
    expect(screen.getByRole("rowheader", { name: /Elétrica/ })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /Gesso/ })).toBeInTheDocument();
    expect(screen.getByText(/Prevista no cronograma para esta semana, sem atividade ainda/)).toBeInTheDocument();
    const chips = screen.getAllByRole("button", { name: /^João,/ });
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveAccessibleName(/Feito/);
    expect(chips[1]).toHaveAccessibleName(/depois da data-limite/);
  });

  it("resumo: prazo, dias confirmados e material faltando", () => {
    renderAt("?obra=p1");
    const resumo = screen.getByLabelText("Resumo da semana");
    expect(within(resumo).getByText("No prazo")).toBeInTheDocument();
    expect(within(resumo).getByText(/40 dias úteis até/)).toBeInTheDocument();
    expect(within(resumo).getByText("1 de 2 confirmados")).toBeInTheDocument();
    expect(within(resumo).getByText("1 de 2 na obra")).toBeInTheDocument();
    expect(within(resumo).getByText(/Falta: Massa corrida/)).toBeInTheDocument();
  });

  it("planejar semana: etapa do cronograma vira atividade, exige quem faz e grava os dias", async () => {
    renderAt("?obra=p1");
    fireEvent.click(screen.getByRole("button", { name: /Planejar semana/ }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText(/Prevista no cronograma · 1/)).toBeInTheDocument();
    const confirm = within(sheet).getByRole("button", { name: "Marcar na semana" });
    expect(confirm).toBeDisabled();
    expect(within(sheet).getByText("Informe quem vai fazer.")).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText("Quem faz Gesso"), { target: { value: "Equipe Gesso" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await vi.waitFor(() => expect(h.createAssignments).toHaveBeenCalled());
    expect(h.createActivity).toHaveBeenCalledWith(expect.objectContaining({ project_id: "p1", stage_id: "s2", title: "Gesso" }));
    const rows = (h.createAssignments.mock.calls[0] as unknown[])[0] as { activity_id: string; worker_name: string; work_date: string }[];
    expect(rows.every((r) => r.activity_id === "novo" && r.worker_name === "Equipe Gesso")).toBe(true);
    expect(rows.map((r) => r.work_date)).toEqual(
      [1, 2, 3].map((i) => shiftISODate(MON, i)).filter((d) => !isHoliday(new Date(d + "T12:00:00"))),
    );
  });

  it("toque na atividade abre a gaveta", () => {
    renderAt("?obra=p1");
    fireEvent.click(screen.getByRole("button", { name: /^Passar conduíte/ }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Passar conduíte")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Concluir" })).toBeInTheDocument();
    expect(within(drawer).getByText(/Material · 0 de 0 na obra/)).toBeInTheDocument();
  });
});
