/**
 * Telas da equipe que passaram a ler/gravar o CRONOGRAMA INTERNO
 * (internal_schedule_items) em vez do cronograma do cliente:
 * Calendário (useWeekActivities + micro-etapas), Lookahead, Minha semana
 * (minhas atividades), exceções do Painel, período do Painel, obras com
 * etapa anterior em aberto e etapa atual. E as gravações relendo Semana /
 * Hoje / Painel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const h = vi.hoisted(() => {
  const tables: string[] = [];
  const builder = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "or", "not", "gte", "lte", "lt", "gt", "order", "limit", "single", "maybeSingle"]) {
      b[m] = () => b;
    }
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
    return b;
  };
  return {
    tables,
    supabase: {
      from: (t: string) => {
        tables.push(t);
        return builder();
      },
      rpc: async () => ({ data: null, error: null }),
    },
    repo: {
      listInRange: vi.fn(),
      listStartingBetween: vi.fn(),
      listOpenByResponsible: vi.fn(),
      listUnassignedStarting: vi.fn(),
      listOverlapping: vi.fn(),
      listOpenEndingBefore: vi.fn(),
      listByProjects: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      removeChildren: vi.fn(),
      listByProject: vi.fn(),
      listClientDates: vi.fn(),
      create: vi.fn(),
      reorder: vi.fn(),
      copyFromClient: vi.fn(),
      countOpsActivities: vi.fn(),
      mirrorToClientActivity: vi.fn(),
      getClientActivityState: vi.fn(),
    },
    toastError: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: h.supabase }));
vi.mock("@/infra/repositories/internalSchedule.repository", () => ({ internalScheduleRepo: h.repo }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: h.toastError, info: vi.fn() } }));

import { useWeekActivities, toWeekActivity } from "../useWeekActivities";
import { useLookahead } from "../useLookahead";
import { useMinhaSemana } from "../useMinhaSemana";
import { usePainelExcecoes } from "../usePainelExcecoes";
import { usePainelPeriodActivities } from "../usePainelPeriodActivities";
import { useProjectsWithOverduePrevious } from "../useProjectsWithOverduePrevious";
import { useCurrentStages } from "../useCurrentStages";
import { CLIENT_NOT_UPDATED_MESSAGE, useInternalScheduleMutations } from "../useInternalSchedule";
import { queryKeys } from "@/lib/queryKeys";
import { todayISO, shiftISODate } from "@/lib/hojeDia";
import { startTodayChange } from "@/lib/internalScheduleActions";

const ok = <T,>(data: T) => Promise.resolve({ data, error: null });

const row = (p: Record<string, unknown> & { id: string }) => ({
  project_id: "p1",
  parent_id: null,
  client_activity_id: null,
  description: p.id,
  etapa: "Elétrica",
  detailed_description: null,
  planned_start: "2026-11-02",
  planned_end: "2026-11-06",
  actual_start: null,
  actual_end: null,
  weight: 20,
  sort_order: 4,
  predecessor_ids: [],
  responsible_user_id: null,
  fornecedor_id: null,
  notes: null,
  created_at: "",
  updated_at: "",
  created_by: null,
  updated_by: null,
  responsible: null,
  fornecedor: null,
  project: { id: "p1", name: "Ap. 12", status: "active", project_customers: [{ customer_name: "Marina" }] },
  ...p,
});

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  h.tables.length = 0;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  for (const fn of Object.values(h.repo)) fn.mockImplementation(() => ok([]));
});

describe("Calendário de obras (useWeekActivities)", () => {
  it("lê o cronograma interno e mapeia micro-etapa por parent_id", async () => {
    h.repo.listInRange.mockImplementation(() =>
      ok([row({ id: "a" }), row({ id: "a1", parent_id: "a", client_activity_id: null })]),
    );
    const { result } = renderHook(() => useWeekActivities("2026-11-02", "2026-11-08"), { wrapper });
    await waitFor(() => expect(result.current.activities).toHaveLength(2));
    expect(h.repo.listInRange).toHaveBeenCalledWith("2026-11-02", "2026-11-08");
    expect(result.current.activities[1].parent_activity_id).toBe("a");
    expect(h.tables).not.toContain("project_activities");
  });

  it("toWeekActivity: obra, cliente, responsável e prestador; sem linha de base", () => {
    const a = toWeekActivity(
      row({
        id: "a",
        client_activity_id: "c1",
        responsible: { id: "u1", nome: "Ana" },
        fornecedor: { id: "f1", nome: "Silva" },
      }) as never,
    );
    expect(a).toMatchObject({
      project_name: "Ap. 12",
      client_name: "Marina",
      responsible_name: "Ana",
      fornecedor_nome: "Silva",
      client_activity_id: "c1",
      baseline_start: null,
      parent_activity_id: null,
    });
  });

  it("quebrar em micro-etapas cria itens filhos no cronograma interno, herdando da mãe", async () => {
    h.repo.createMany.mockImplementation(() => ok([]));
    const { result } = renderHook(() => useWeekActivities("2026-11-02", "2026-11-08"), { wrapper });
    const parent = toWeekActivity(row({ id: "a", responsible_user_id: "u9", fornecedor_id: "f9" }) as never);
    await act(async () => {
      await result.current.breakIntoSubActivities(parent, [
        { description: " Tubulação ", planned_start: "2026-11-02", planned_end: "2026-11-03" },
        { description: "Fiação", planned_start: "2026-11-04", planned_end: "2026-11-06", fornecedor_id: null },
      ]);
    });
    const rows = h.repo.createMany.mock.calls[0][0];
    expect(rows).toEqual([
      expect.objectContaining({ parent_id: "a", description: "Tubulação", weight: 10, sort_order: 5, etapa: "Elétrica", responsible_user_id: "u9", fornecedor_id: "f9" }),
      expect.objectContaining({ parent_id: "a", description: "Fiação", sort_order: 6, fornecedor_id: null }),
    ]);
    expect(rows[0]).not.toHaveProperty("parent_activity_id");
    expect(h.tables).not.toContain("project_activities");
  });

  it("micro-etapa não pode ser dividida de novo (2 níveis)", async () => {
    const { result } = renderHook(() => useWeekActivities("2026-11-02", "2026-11-08"), { wrapper });
    const child = toWeekActivity(row({ id: "a1", parent_id: "a" }) as never);
    await expect(
      act(() => result.current.breakIntoSubActivities(child, [{ description: "x", planned_start: "2026-11-02", planned_end: "2026-11-02" }])),
    ).rejects.toThrow(/2 níveis/);
    expect(h.repo.createMany).not.toHaveBeenCalled();
  });

  describe("datas reais e responsável: item do cliente grava também no cliente", () => {
    const clientRow = { actual_start: "2026-10-30", actual_end: null, planned_start: "2026-10-28", responsible_user_id: "uc" };
    const load = async () => {
      h.repo.listInRange.mockImplementation(() =>
        ok([
          // Interno sem início real; o cliente já tem início (30/10).
          row({ id: "top", client_activity_id: "c1", planned_start: "2026-11-02" }),
          row({ id: "micro", parent_id: "top", client_activity_id: "c1m" }),
          row({ id: "solo", client_activity_id: null }),
        ]),
      );
      h.repo.update.mockImplementation(() => ok({}));
      h.repo.mirrorToClientActivity.mockImplementation(() => ok(null));
      h.repo.getClientActivityState.mockImplementation(() => ok(clientRow));
      const hook = renderHook(() => useWeekActivities("2026-11-02", "2026-11-08"), { wrapper });
      await waitFor(() => expect(hook.result.current.activities).toHaveLength(3));
      return hook.result;
    };

    it("só o término mudou: o cliente recebe só o término e mantém o início dele", async () => {
      const result = await load();
      await act(async () => {
        await result.current.updateDates("top", { actual_end: "2026-11-05" });
      });
      expect(h.repo.update).toHaveBeenCalledWith("top", { actual_end: "2026-11-05" });
      expect(h.repo.getClientActivityState).toHaveBeenCalledWith("c1");
      expect(h.repo.mirrorToClientActivity).toHaveBeenCalledWith("c1", { actual_end: "2026-11-05" });
    });

    it("'Concluir' sem início: cada lado usa o início previsto/real da PRÓPRIA linha", async () => {
      const result = await load();
      await act(async () => {
        await result.current.updateDates("top", {
          actual_end: "2026-11-05",
          actual_start: (r) => (r.actual_start ? undefined : r.planned_start),
        });
      });
      // Interno sem início → previsto do interno.
      expect(h.repo.update).toHaveBeenCalledWith("top", { actual_end: "2026-11-05", actual_start: "2026-11-02" });
      // Cliente já iniciado → só o término; o início do cliente fica.
      expect(h.repo.mirrorToClientActivity).toHaveBeenCalledWith("c1", { actual_end: "2026-11-05" });
    });

    it("'Iniciou hoje' com o cliente já iniciado: só o interno recebe o início", async () => {
      const result = await load();
      await act(async () => {
        await result.current.updateDates("top", startTodayChange("2026-11-05"));
      });
      expect(h.repo.update).toHaveBeenCalledWith("top", { actual_start: "2026-11-05" });
      expect(h.repo.getClientActivityState).toHaveBeenCalledWith("c1");
      // O cliente já tinha 30/10: nada é gravado nele.
      expect(h.repo.mirrorToClientActivity).not.toHaveBeenCalled();
    });

    it("responsável e datas escolhidos pela pessoa vão iguais para os dois", async () => {
      const result = await load();
      const patch = { actual_start: "2026-11-03", responsible_user_id: "u2" };
      await act(async () => {
        await result.current.updateDates("top", patch);
      });
      expect(h.repo.update).toHaveBeenCalledWith("top", patch);
      expect(h.repo.mirrorToClientActivity).toHaveBeenCalledWith("c1", patch);
    });

    it("micro-etapa e item só interno gravam só no interno", async () => {
      const result = await load();
      await act(async () => {
        await result.current.updateDates("micro", { actual_start: "2026-11-03" });
        await result.current.updateDates("solo", { actual_end: "2026-11-04" });
      });
      expect(h.repo.update).toHaveBeenCalledTimes(2);
      expect(h.repo.getClientActivityState).not.toHaveBeenCalled();
      expect(h.repo.mirrorToClientActivity).not.toHaveBeenCalled();
    });

    it("falha no cliente: avisa e não desfaz o interno", async () => {
      const result = await load();
      h.repo.mirrorToClientActivity.mockImplementation(() =>
        Promise.resolve({ data: null, error: { message: "permission denied" } }),
      );
      await act(async () => {
        await result.current.updateDates("top", { actual_start: "2026-11-03" });
      });
      expect(h.toastError).toHaveBeenCalledWith(CLIENT_NOT_UPDATED_MESSAGE);
      // Uma gravação no interno e nenhuma tentativa de desfazer.
      expect(h.repo.update).toHaveBeenCalledTimes(1);
      expect(h.repo.update).toHaveBeenCalledWith("top", { actual_start: "2026-11-03" });
    });
  });

  it("datas, mesclar e remover micro-etapa gravam no cronograma interno", async () => {
    h.repo.update.mockImplementation(() => ok({}));
    h.repo.removeChildren.mockImplementation(() => ok(null));
    h.repo.remove.mockImplementation(() => ok(null));
    h.repo.listInRange.mockImplementation(() => ok([row({ id: "a" })]));
    const { result } = renderHook(() => useWeekActivities("2026-11-02", "2026-11-08"), { wrapper });
    await waitFor(() => expect(result.current.activities).toHaveLength(1));
    await act(async () => {
      await result.current.updateDates("a", { actual_start: "2026-11-03" });
      await result.current.mergeSubActivities("a");
      await result.current.removeSubActivity("a1");
    });
    expect(h.repo.update).toHaveBeenCalledWith("a", { actual_start: "2026-11-03" });
    expect(h.repo.removeChildren).toHaveBeenCalledWith("a");
    expect(h.repo.remove).toHaveBeenCalledWith("a1");
  });
});

describe("Lookahead", () => {
  it("lê os itens internos que começam na janela, com obra, responsável e vínculo do cliente", async () => {
    const start = todayISO();
    h.repo.listStartingBetween.mockImplementation(() =>
      ok([row({ id: "a", planned_start: start, responsible_user_id: "u1", responsible: { id: "u1", nome: "Ana" }, client_activity_id: "c1" })]),
    );
    const { result } = renderHook(() => useLookahead(14), { wrapper });
    await waitFor(() => expect(result.current.totalCount).toBe(1));
    expect(h.repo.listStartingBetween).toHaveBeenCalledWith(start, shiftISODate(start, 14), 500);
    const a = result.current.weeks[0].activities[0];
    expect(a).toMatchObject({ project_name: "Ap. 12", responsible_name: "Ana", client_activity_id: "c1", hasResponsible: true });
    expect(h.tables).not.toContain("project_activities");
    expect(h.tables).not.toContain("users_profile");
  });
});

describe("Minha semana", () => {
  it("minhas atividades vêm do cronograma interno e abrem o cronograma interno", async () => {
    h.repo.listOpenByResponsible.mockImplementation(() => ok([row({ id: "a", description: "Elétrica" })]));
    const { result } = renderHook(() => useMinhaSemana(), { wrapper });
    await waitFor(() => expect(result.current.total).toBeGreaterThan(0));
    expect(h.repo.listOpenByResponsible).toHaveBeenCalledWith("u1", 200);
    const all = Object.values(result.current.buckets).flat();
    const item = all.find((i) => i.id === "atv-a");
    expect(item?.href).toBe("/obra/p1/cronograma-interno");
  });
});

describe("Painel", () => {
  it("exceção 'sem responsável' olha o cronograma interno", async () => {
    h.repo.listUnassignedStarting.mockImplementation(() => ok([{ project_id: "p1" }, { project_id: "p1" }]));
    const { result } = renderHook(() => usePainelExcecoes(), { wrapper });
    await waitFor(() => expect(result.current.counts.atv).toBe(1));
    expect(h.repo.listUnassignedStarting).toHaveBeenCalledWith(todayISO(), expect.any(String));
  });

  it("período: programado no intervalo e etapa anterior em aberto, do cronograma interno", async () => {
    h.repo.listOverlapping.mockImplementation(() => ok([row({ id: "a", planned_start: "2026-11-02", planned_end: "2026-11-06" })]));
    h.repo.listOpenEndingBefore.mockImplementation(() => ok([row({ id: "b", planned_start: "2026-10-20", planned_end: "2026-10-30" })]));
    const { result } = renderHook(() => usePainelPeriodActivities("2026-11-02", "2026-11-08"), { wrapper });
    await waitFor(() => expect(result.current.byProject.get("p1")).toBeTruthy());
    const bucket = result.current.byProject.get("p1")!;
    expect(bucket.scheduled.map((a) => a.id)).toEqual(["a"]);
    expect(bucket.overduePrior.map((a) => a.id)).toEqual(["b"]);
    expect(h.repo.listOpenEndingBefore).toHaveBeenCalledWith("2026-11-02");
  });

  it("obras com etapa anterior em aberto (Calendário)", async () => {
    h.repo.listOpenEndingBefore.mockImplementation(() =>
      ok([row({ id: "a", planned_end: "2026-10-20" }), row({ id: "b", planned_end: "2026-10-28" })]),
    );
    const { result } = renderHook(() => useProjectsWithOverduePrevious("2026-11-02"), { wrapper });
    await waitFor(() => expect(result.current.data.ids.has("p1")).toBe(true));
    expect(result.current.data.latestByProject.get("p1")).toBe("2026-10-28");
  });

  it("etapa atual de cada obra vem do cronograma interno", async () => {
    h.repo.listByProjects.mockImplementation(() =>
      ok([
        row({ id: "a", description: "Demolição", planned_start: "2020-01-01", actual_end: "2020-01-05", sort_order: 1 }),
        row({ id: "b", description: "Elétrica", planned_start: "2020-01-06", sort_order: 2 }),
      ]),
    );
    const { result } = renderHook(() => useCurrentStages(["p1"]), { wrapper });
    await waitFor(() => expect(result.current.data?.get("p1")).toBeTruthy());
    expect(result.current.data?.get("p1")).toEqual({ description: "Elétrica", isAwaitingStart: false });
  });
});

describe("gravações no cronograma interno relêem Semana, Hoje e Painel", () => {
  it("invalida cronograma interno, operação, Painel, Lookahead e Minha semana — nunca o do cliente", async () => {
    h.repo.update.mockImplementation(() => ok({ id: "a" }));
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useInternalScheduleMutations("p1"), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({ id: "a", patch: { actual_start: "2026-11-03" } });
    });
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(queryKeys.internalSchedule.all),
        JSON.stringify(queryKeys.ops.all),
        JSON.stringify(queryKeys.obrasPanel.all),
        JSON.stringify(queryKeys.lookahead.all),
        JSON.stringify(queryKeys.minhaSemana.all),
      ]),
    );
    expect(keys.some((k) => k.startsWith(JSON.stringify(queryKeys.activities.all).slice(0, -1)))).toBe(false);
  });

  it("copiar do cliente chama a RPC com substituir quando pedido", async () => {
    h.repo.copyFromClient.mockImplementation(() => ok(5));
    const { result } = renderHook(() => useInternalScheduleMutations("p1"), { wrapper });
    await act(async () => {
      await result.current.copyFromClient.mutateAsync(true);
    });
    expect(h.repo.copyFromClient).toHaveBeenCalledWith("p1", true);
  });
});
