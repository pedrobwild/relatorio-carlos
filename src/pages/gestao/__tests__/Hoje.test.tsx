/**
 * Tela Hoje (Fase 3): fluxos de confirmação no celular.
 * Hooks de dados mockados: aqui testamos a tela, não o banco.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { OpsDayAssignment } from "@/infra/repositories/ops.repository";
import { todayISO, shiftISODate, parseISODate } from "@/lib/hojeDia";

const h = vi.hoisted(() => ({
  items: [] as unknown[] | undefined,
  dayState: { isPending: false, fetchStatus: "idle" as string },
  mutate: vi.fn(),
  readiness: [] as { id: string; materials_missing: number }[],
  /** Ficha por obra (project_studio_info). `error: true` simula a consulta falhando. */
  studio: {} as Record<string, { data?: unknown; isError?: boolean }>,
  online: true,
  pending: [] as { vars: { id: string; outcome: string | null }; submittedAt: number }[],
  failures: [] as { key: string; assignmentId: string; label: string; action: string; message: string; at: number }[],
  photos: [] as unknown[],
  suppress: vi.fn(),
  /** Etapas do cronograma para "começou? terminou?". */
  etapas: [] as unknown[],
  responder: vi.fn(),
}));

vi.mock("@/hooks/useEtapasHoje", async () => {
  const { etapasParaConfirmar } = await vi.importActual<typeof import("@/lib/etapasHoje")>("@/lib/etapasHoje");
  return {
    useEtapasHoje: (today: string) => ({
      groups: etapasParaConfirmar(h.etapas as never, today),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      responder: h.responder,
      isSaving: false,
    }),
  };
});

vi.mock("@/hooks/useOps", () => ({
  useOpsDay: () => ({
    data: h.items,
    isPending: h.dayState.isPending,
    fetchStatus: h.dayState.fetchStatus,
    isError: false,
    refetch: vi.fn(),
    isFetching: false,
  }),
  usePrefetchOpsDays: vi.fn(),
  useOpsReadiness: () => ({ data: h.readiness }),
  useSetAssignmentOutcome: () => ({ mutate: h.mutate, isPending: false, variables: undefined }),
  useOpsPhotoUrls: () => ({ data: [] }),
  useAddAssignmentPhotos: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOpsStages: () => ({ data: [], isLoading: false }),
  useOpsActivities: () => ({ data: [] }),
  useCreateOpsActivity: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateOpsAssignment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useStudioInfo", () => ({
  useStudioInfo: (projectId: string) => ({
    data: null,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...(h.studio[projectId] ?? {}),
  }),
  useUpdateStudioInfo: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useCan", () => ({ useCan: () => ({ can: () => true }) }));
vi.mock("@/hooks/useOpsOffline", async () => {
  const { syncStatusFor } = await vi.importActual<typeof import("@/lib/offline/syncStatus")>(
    "@/lib/offline/syncStatus",
  );
  return {
    useIsOnline: () => h.online,
    usePendingOutcomes: () => h.pending,
    useSyncFailures: () => h.failures,
    useQueuedPhotos: () => h.photos,
    useSuppressNetworkBanner: h.suppress,
    useSyncStatus: (pending: number) => syncStatusFor({ online: h.online, pending, justFlushed: false }),
  };
});
vi.mock("@/lib/offline/opsPhotoSync", () => ({
  getOpsPhotoQueue: () => ({ retry: vi.fn(), discard: vi.fn(), enqueue: vi.fn() }),
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
    h.studio = {};
    h.online = true;
    h.pending = [];
    h.failures = [];
    h.photos = [];
    h.dayState = { isPending: false, fetchStatus: "idle" };
    h.etapas = [];
    h.responder.mockReset().mockReturnValue(vi.fn());
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
    expect(h.mutate).toHaveBeenCalledWith({ id: "1", outcome: "feito", label: "Atividade 1" });
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
    expect(h.mutate).toHaveBeenCalledWith({
      id: "1",
      outcome: "nao_feito",
      reason: "material",
      notes: null,
      label: "Atividade 1",
    });
    // Não espera o banco: a gaveta fecha na hora (vale também sem sinal).
    expect(screen.queryByRole("dialog")).toBeNull();
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
    expect(h.mutate).toHaveBeenCalledWith({ id: "2", outcome: null, label: "Atividade 2" });
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

  describe("ficha da obra", () => {
    const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayOf = (iso: string) => DAYS[parseISODate(iso).getDay()];
    const amanha = shiftISODate(todayISO(), 1);
    const WEEKDAY = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    it("cada obra tem o botão Ficha, que abre a ficha daquela obra", () => {
      h.studio = { p2: { data: { project_id: "p2", key_location: "Com o zelador" } } };
      renderAt();
      expect(screen.getByRole("button", { name: "Ficha da obra Obra Moema" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Ficha da obra Obra Alphaville" }));
      const dialog = screen.getByRole("dialog", { name: "Ficha da obra" });
      expect(within(dialog).getByText("Obra Alphaville")).toBeInTheDocument();
      expect(within(dialog).getByText("Com o zelador")).toBeInTheDocument();
    });

    it("mostra o horário que o condomínio permite hoje, por obra", () => {
      h.studio = {
        // Moema: hoje pode. Alphaville: só amanhã.
        p1: { data: { allowed_work_days: [dayOf(todayISO())], allowed_work_start_time: "09:00", allowed_work_end_time: "17:00" } },
        p2: { data: { allowed_work_days: [dayOf(amanha)], allowed_work_start_time: "08:00", allowed_work_end_time: "12:30" } },
      };
      renderAt();
      const moema = screen.getByRole("heading", { name: "Obra Moema" }).closest("header") as HTMLElement;
      expect(within(moema).getByText("Hoje: 9h às 17h")).toBeInTheDocument();
      const alpha = screen.getByRole("heading", { name: "Obra Alphaville" }).closest("header") as HTMLElement;
      expect(within(alpha).getByText("Condomínio não permite obra hoje")).toBeInTheDocument();
    });

    it("em outro dia, fala do dia que está na tela (não de hoje)", () => {
      h.studio = {
        p1: { data: { allowed_work_days: [dayOf(amanha)], allowed_work_start_time: "09:00", allowed_work_end_time: "17:00" } },
      };
      h.items = [item({ id: "1", work_date: amanha })];
      renderAt(`?data=${amanha}`);
      const nome = WEEKDAY[parseISODate(amanha).getDay()];
      expect(screen.getByText(`${nome}: 9h às 17h`)).toBeInTheDocument();
      expect(screen.queryByText(/^Hoje:/)).toBeNull();
    });

    it("sem dias e horários na ficha, não afirma nada", () => {
      renderAt();
      expect(screen.queryByText(/^Hoje:/)).toBeNull();
      expect(screen.queryByText(/Condomínio não permite/)).toBeNull();
    });

    it("se a ficha não carregar, o dia continua funcionando", () => {
      h.studio = { p1: { data: undefined, isError: true }, p2: { data: undefined, isError: true } };
      renderAt();
      expect(screen.getByRole("heading", { name: "Obra Moema" })).toBeInTheDocument();
      expect(screen.getByText("1 de 3 confirmados")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Marcar como feito: Atividade 1" }));
      expect(h.mutate).toHaveBeenCalledWith({ id: "1", outcome: "feito", label: "Atividade 1" });
      // A ficha abre e explica o erro, em vez de parecer vazia.
      fireEvent.click(screen.getByRole("button", { name: "Ficha da obra Obra Moema" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar a ficha desta obra.");
    });
  });

  it("dia vazio convida a programar", () => {
    h.items = [];
    renderAt();
    expect(screen.getByText("Nada programado para este dia")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Adicionar ao dia/ }).length).toBeGreaterThan(0);
  });

  describe("sem sinal", () => {
    it("o que está na fila aparece na hora, com a marca 'Aguardando envio'", () => {
      h.online = false;
      h.pending = [{ vars: { id: "1", outcome: "feito" }, submittedAt: Date.now() }];
      renderAt();
      const card = screen.getByRole("article", { name: "Atividade 1" });
      expect(card).toHaveAttribute("data-state", "feito");
      expect(within(card).getByText("Aguardando envio")).toBeInTheDocument();
      expect(screen.getByText("2 de 3 confirmados")).toBeInTheDocument();
      // Os outros cards não ficam marcados.
      expect(within(screen.getByRole("article", { name: "Atividade 2" })).queryByText("Aguardando envio")).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent("Sem sinal — 1 registro aguardando envio");
    });

    it("conta também as fotos guardadas no aparelho", () => {
      h.online = false;
      h.pending = [{ vars: { id: "1", outcome: "feito" }, submittedAt: Date.now() }];
      h.photos = [
        { id: "f1", userId: "u-me", assignmentId: "2", failed: false, blob: new Blob(["x"]) },
        { id: "f2", userId: "outra-conta", assignmentId: "2", failed: false, blob: new Blob(["x"]) },
      ];
      renderAt();
      expect(screen.getByRole("status")).toHaveTextContent("Sem sinal — 2 registros aguardando envio");
      // Miniatura marcada no card (só a desta conta).
      const card = screen.getByRole("article", { name: "Atividade 2" });
      expect(within(card).getAllByText("aguardando envio")).toHaveLength(1);
    });

    it("com sinal e fila andando: Enviando…", () => {
      h.pending = [{ vars: { id: "1", outcome: "feito" }, submittedAt: Date.now() }];
      renderAt();
      expect(screen.getByRole("status")).toHaveTextContent("Enviando 1 registro…");
    });

    it("com sinal e nada na fila: a linha não aparece", () => {
      renderAt();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("o aviso global de rede não duplica a linha desta tela", () => {
      renderAt();
      expect(h.suppress).toHaveBeenCalled();
    });

    it("dia nunca aberto neste aparelho: explica, não diz 'Nada programado'", () => {
      h.online = false;
      h.items = undefined;
      h.dayState = { isPending: true, fetchStatus: "paused" };
      renderAt();
      expect(screen.getByText("Sem sinal, e este dia ainda não foi aberto neste aparelho")).toBeInTheDocument();
      expect(screen.queryByText("Nada programado para este dia")).toBeNull();
    });

    it("enquanto o cache do aparelho é restaurado, mostra carregando (não 'Nada programado')", () => {
      h.items = undefined;
      h.dayState = { isPending: true, fetchStatus: "idle" };
      renderAt();
      expect(screen.getByText("Carregando…")).toBeInTheDocument();
      expect(screen.queryByText("Nada programado para este dia")).toBeNull();
    });

    it("envio recusado aparece na lista, com o que era e o motivo", () => {
      h.failures = [
        {
          key: "k1",
          assignmentId: "1",
          label: "Atividade 1",
          action: "Feito",
          message: "Você não tem permissão para esta ação.",
          at: 1,
        },
      ];
      renderAt();
      const list = screen.getByRole("list", { name: "Registros não enviados" });
      expect(within(list).getByText('Não enviado: "Feito" de Atividade 1')).toBeInTheDocument();
      expect(within(list).getByText(/Você não tem permissão/)).toBeInTheDocument();
    });
  });
});

describe("Tela Hoje: etapas do cronograma (começou? terminou?)", () => {
  const etapa = (over: Record<string, unknown>) => ({
    id: "e1",
    project_id: "p1",
    parent_id: null,
    client_activity_id: null,
    description: "Gesso",
    planned_start: todayISO(),
    planned_end: shiftISODate(todayISO(), 5),
    actual_start: null,
    actual_end: null,
    responsible_user_id: null,
    sort_order: 1,
    project: { name: "Obra Moema", status: "active" },
    ...over,
  });

  beforeEach(() => {
    h.items = [];
    h.online = true;
    h.pending = [];
    h.failures = [];
    h.photos = [];
    h.dayState = { isPending: false, fetchStatus: "idle" };
    h.responder.mockReset().mockReturnValue(vi.fn());
  });

  it("começa hoje: um botão 'Começou' grava o início de hoje", () => {
    h.etapas = [etapa({})];
    renderAt();
    const sec = screen.getByRole("region", { name: /começou\? terminou\?/ });
    expect(within(sec).getByText("Gesso")).toBeInTheDocument();
    fireEvent.click(within(sec).getByRole("button", { name: "Começou" }));
    expect(h.responder).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }), { actual_start: todayISO() });
  });

  it("deveria ter começado antes: oferece a data prevista ou hoje", () => {
    const antes = shiftISODate(todayISO(), -7);
    h.etapas = [etapa({ planned_start: antes })];
    renderAt();
    const dd = `${antes.slice(8, 10)}/${antes.slice(5, 7)}`;
    fireEvent.click(screen.getByRole("button", { name: `Começou em ${dd}` }));
    expect(h.responder).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }), { actual_start: antes });
    expect(screen.getByRole("button", { name: "Começou hoje" })).toBeInTheDocument();
  });

  it("em andamento: 'Terminou hoje' grava o término", () => {
    h.etapas = [etapa({ actual_start: shiftISODate(todayISO(), -2) })];
    renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Terminou hoje" }));
    expect(h.responder).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }), { actual_end: todayISO() });
  });

  it("não aparece em outro dia nem sem sinal", () => {
    h.etapas = [etapa({})];
    const { unmount } = renderAt(`?data=${shiftISODate(todayISO(), -1)}`);
    expect(screen.queryByRole("region", { name: /começou\? terminou\?/ })).toBeNull();
    unmount();
    h.online = false;
    renderAt();
    expect(screen.queryByRole("region", { name: /começou\? terminou\?/ })).toBeNull();
  });
});
