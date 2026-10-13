/**
 * Linha do Lookahead: as ações gravam no CRONOGRAMA INTERNO e — para item de
 * primeiro nível vindo do cliente — também na atividade do cliente (como
 * sempre foi). Micro-etapa e item só interno gravam só no interno. O avanço
 * físico (medido na atividade do cliente) só aparece com vínculo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  update: vi.fn(),
  mirror: vi.fn(),
  invalidateActivityQueries: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: h.toastError } }));
vi.mock("@/hooks/useStaffUsers", () => ({ useStaffUsers: () => ({ data: [] }) }));
vi.mock("@/hooks/useActivityProgress", () => ({ useActivityMeasurements: () => ({ data: [] }) }));
vi.mock("@/components/gestao/avanco/RegistrarAvancoDialog", () => ({
  RegistrarAvancoDialog: ({ activityId }: { activityId: string }) => <div data-testid="avanco">{activityId}</div>,
}));
vi.mock("@/infra/repositories/internalSchedule.repository", () => ({
  internalScheduleRepo: { update: h.update, mirrorToClientActivity: h.mirror },
}));
vi.mock("@/lib/queryKeys", async (orig) => ({
  ...(await orig<typeof import("@/lib/queryKeys")>()),
  invalidateActivityQueries: h.invalidateActivityQueries,
}));

import { LookaheadRow } from "../LookaheadRow";
import type { LookaheadActivity } from "@/hooks/useLookahead";
import { CLIENT_NOT_UPDATED_MESSAGE } from "@/hooks/useInternalSchedule";

const activity = (p: Partial<LookaheadActivity> = {}): LookaheadActivity => ({
  id: "i1",
  project_id: "p1",
  project_name: "Ap. 12",
  description: "Elétrica",
  planned_start: "2026-11-02",
  planned_end: "2026-11-06",
  actual_start: null,
  actual_end: null,
  responsible_user_id: null,
  responsible_name: null,
  client_activity_id: "c1",
  parent_id: null,
  weekKey: "2026-11-02",
  isOverdue: false,
  hasResponsible: false,
  ...p,
});

function renderRow(a: LookaheadActivity) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LookaheadRow activity={a} windowDays={14} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const DAY = expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/);

beforeEach(() => {
  vi.clearAllMocks();
  h.update.mockResolvedValue({ data: {}, error: null });
  h.mirror.mockResolvedValue({ data: null, error: null });
});

describe("LookaheadRow", () => {
  it("item de primeiro nível ligado ao cliente: Iniciar grava no interno E no cliente", async () => {
    renderRow(activity());
    fireEvent.click(screen.getByRole("button", { name: "Marcar atividade como iniciada" }));
    await waitFor(() => expect(h.mirror).toHaveBeenCalledWith("c1", { actual_start: DAY }));
    expect(h.update).toHaveBeenCalledWith("i1", { actual_start: DAY });
    expect(h.update.mock.calls[0][1]).toEqual(h.mirror.mock.calls[0][1]);
    expect(h.invalidateActivityQueries).toHaveBeenCalledWith("p1");
  });

  it("Concluir grava início e término nos dois", async () => {
    renderRow(activity({ actual_start: "2026-11-02" }));
    fireEvent.click(screen.getByRole("button", { name: "Concluir atividade" }));
    await waitFor(() => expect(h.mirror).toHaveBeenCalledWith("c1", { actual_start: "2026-11-02", actual_end: DAY }));
    expect(h.update).toHaveBeenCalledWith("i1", { actual_start: "2026-11-02", actual_end: DAY });
  });

  it("micro-etapa e item só interno gravam só no interno", async () => {
    const { unmount } = renderRow(activity({ parent_id: "mae" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar atividade como iniciada" }));
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    unmount();

    renderRow(activity({ client_activity_id: null }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar atividade como iniciada" }));
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(2));
    expect(h.mirror).not.toHaveBeenCalled();
    expect(h.invalidateActivityQueries).not.toHaveBeenCalled();
  });

  it("falha no cliente: avisa em português e mantém o interno (sem desfazer)", async () => {
    h.mirror.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    renderRow(activity());
    fireEvent.click(screen.getByRole("button", { name: "Marcar atividade como iniciada" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(CLIENT_NOT_UPDATED_MESSAGE));
    // Uma gravação no interno, nenhuma para desfazer.
    expect(h.update).toHaveBeenCalledTimes(1);
  });

  it("links levam ao cronograma interno da obra", () => {
    renderRow(activity());
    expect(screen.getByRole("link", { name: "Abrir cronograma interno da obra" })).toHaveAttribute(
      "href",
      "/obra/p1/cronograma-interno",
    );
  });

  it("avanço físico usa a atividade do cliente; item só interno não tem o botão", () => {
    const { unmount } = renderRow(activity());
    expect(screen.getByRole("button", { name: "Registrar avanço físico" })).toBeInTheDocument();
    expect(screen.getByTestId("avanco")).toHaveTextContent("c1");
    unmount();

    renderRow(activity({ client_activity_id: null }));
    expect(screen.queryByRole("button", { name: "Registrar avanço físico" })).toBeNull();
  });
});
