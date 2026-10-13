/**
 * Repositório do cronograma interno: tabela certa, ordem, filtros, RPC de
 * cópia e — o mais importante — nunca grava no cronograma do cliente.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { method: string; args: unknown[] };
const h = vi.hoisted(() => {
  const state = {
    calls: [] as { table: string; method: string; args: unknown[] }[],
    tables: [] as string[],
    rpc: [] as { fn: string; args: unknown }[],
    result: { data: [] as unknown, error: null as unknown, count: null as number | null },
    rpcResult: { data: 3 as unknown, error: null as unknown },
  };
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "delete", "eq", "in", "is", "or", "gte", "lte", "lt", "order", "limit", "single"]) {
      b[m] = (...args: unknown[]) => {
        state.calls.push({ table, method: m, args });
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => unknown) => resolve(state.result);
    return b;
  };
  const mockSupabase = {
    from: (t: string) => {
      state.tables.push(t);
      return builder(t);
    },
    rpc: async (fn: string, args: unknown) => {
      state.rpc.push({ fn, args });
      return state.rpcResult;
    },
  };
  return { state, mockSupabase };
});

vi.mock("../base.repository", async () => {
  const actual = await vi.importActual<typeof import("../base.repository")>("../base.repository");
  return { ...actual, supabase: h.mockSupabase };
});

import { internalScheduleRepo } from "../internalSchedule.repository";

const find = (method: string): Call[] => h.state.calls.filter((c) => c.method === method);

beforeEach(() => {
  h.state.calls = [];
  h.state.tables = [];
  h.state.rpc = [];
  h.state.result = { data: [], error: null, count: null };
  h.state.rpcResult = { data: 3, error: null };
});

describe("internalScheduleRepo", () => {
  it("listByProject lê o cronograma interno da obra na ordem, com responsável e prestador", async () => {
    await internalScheduleRepo.listByProject("p1");
    expect(h.state.tables).toEqual(["internal_schedule_items"]);
    expect(find("eq")[0].args).toEqual(["project_id", "p1"]);
    expect(find("order")[0].args[0]).toBe("sort_order");
    const sel = String(find("select")[0].args[0]);
    expect(sel).toContain("responsible:users_profile");
    expect(sel).toContain("fornecedor:fornecedores");
  });

  it("listClientDates só LÊ o cronograma do cliente (para comparar)", async () => {
    await internalScheduleRepo.listClientDates("p1");
    expect(h.state.tables).toEqual(["project_activities"]);
    expect(find("insert")).toHaveLength(0);
    expect(find("update")).toHaveLength(0);
    expect(find("delete")).toHaveLength(0);
  });

  it("create / update / remove gravam só em internal_schedule_items", async () => {
    h.state.result = { data: { id: "i1" }, error: null, count: null };
    await internalScheduleRepo.create({
      project_id: "p1",
      description: "Elétrica",
      planned_start: "2026-11-03",
      planned_end: "2026-11-14",
    });
    await internalScheduleRepo.update("i1", { actual_start: "2026-11-04" });
    await internalScheduleRepo.remove("i1");
    expect(new Set(h.state.tables)).toEqual(new Set(["internal_schedule_items"]));
    expect(find("update")[0].args[0]).toEqual({ actual_start: "2026-11-04" });
    expect(find("delete")).toHaveLength(1);
    // Quem gravou é carimbado pelo banco: o front não manda.
    const inserted = find("insert")[0].args[0] as Record<string, unknown>;
    expect(inserted).not.toHaveProperty("created_by");
  });

  it("removeChildren apaga as micro-etapas pelo parent_id", async () => {
    await internalScheduleRepo.removeChildren("root");
    expect(find("eq")[0].args).toEqual(["parent_id", "root"]);
  });

  it("reorder grava só as linhas enviadas e para no primeiro erro", async () => {
    await internalScheduleRepo.reorder([
      { id: "a", sort_order: 2 },
      { id: "b", sort_order: 1 },
    ]);
    expect(find("update").map((c) => c.args[0])).toEqual([{ sort_order: 2 }, { sort_order: 1 }]);

    h.state.calls = [];
    h.state.result = { data: null, error: { message: "permission denied", code: "42501" }, count: null };
    const res = await internalScheduleRepo.reorder([
      { id: "a", sort_order: 2 },
      { id: "b", sort_order: 1 },
    ]);
    expect(res.error).toBeTruthy();
    expect(find("update")).toHaveLength(1);
  });

  it("countOpsActivities conta as atividades da Semana penduradas nos itens", async () => {
    const none = await internalScheduleRepo.countOpsActivities([]);
    expect(none.data).toBe(0);
    expect(h.state.tables).toEqual([]);

    h.state.result = { data: null, error: null, count: 4 };
    const res = await internalScheduleRepo.countOpsActivities(["i1", "i2"]);
    expect(h.state.tables).toEqual(["ops_activities"]);
    expect(find("in")[0].args).toEqual(["stage_id", ["i1", "i2"]]);
    expect(find("select")[0].args[1]).toEqual({ count: "exact", head: true });
    expect(res.data).toBe(4);
  });

  it("copyFromClient chama a RPC com p_replace e devolve quantas linhas copiou", async () => {
    const first = await internalScheduleRepo.copyFromClient("p1", false);
    expect(h.state.rpc[0]).toEqual({
      fn: "copy_client_schedule_to_internal",
      args: { p_project_id: "p1", p_replace: false },
    });
    expect(first.data).toBe(3);

    await internalScheduleRepo.copyFromClient("p1", true);
    expect(h.state.rpc[1].args).toEqual({ p_project_id: "p1", p_replace: true });
  });

  it("copyFromClient devolve o erro já com mensagem em português", async () => {
    h.state.rpcResult = { data: null, error: { message: "permission denied", code: "42501" } };
    const res = await internalScheduleRepo.copyFromClient("p1", true);
    expect(res.error?.userError.userMessage).toBeTruthy();
  });

  it("leituras de carteira usam os filtros certos", async () => {
    await internalScheduleRepo.listInRange("2026-11-02", "2026-11-08");
    expect(String(find("or")[0].args[0])).toContain("planned_start.lte.2026-11-08");
    expect(String(find("select")[0].args[0])).toContain("project_customers");

    h.state.calls = [];
    await internalScheduleRepo.listStartingBetween("2026-11-02", "2026-11-16", 500);
    expect(find("gte")[0].args).toEqual(["planned_start", "2026-11-02"]);
    expect(find("is")[0].args).toEqual(["actual_end", null]);
    expect(find("limit")[0].args).toEqual([500]);

    h.state.calls = [];
    await internalScheduleRepo.listOpenByResponsible("u1");
    expect(find("eq")[0].args).toEqual(["responsible_user_id", "u1"]);

    h.state.calls = [];
    await internalScheduleRepo.listUnassignedStarting("2026-11-02", "2026-11-16");
    expect(find("is")[0].args).toEqual(["responsible_user_id", null]);

    h.state.calls = [];
    await internalScheduleRepo.listOpenEndingBefore("2026-11-02");
    expect(find("lt")[0].args).toEqual(["planned_end", "2026-11-02"]);

    h.state.calls = [];
    const empty = await internalScheduleRepo.listByProjects([]);
    expect(empty.data).toEqual([]);
    expect(find("in")).toHaveLength(0);

    expect(h.state.tables.every((t) => t === "internal_schedule_items")).toBe(true);
  });
});
