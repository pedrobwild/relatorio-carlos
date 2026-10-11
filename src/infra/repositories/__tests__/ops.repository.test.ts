/**
 * Repositório da camada de Operação: garante as tabelas/views certas, os
 * filtros e as regras de payload (project_id vem do trigger; "Não feito"
 * leva motivo; "Feito" limpa motivo).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { method: string; args: unknown[] };
const h = vi.hoisted(() => {
  const state = {
    calls: [] as { method: string; args: unknown[] }[],
    tables: [] as string[],
    result: { data: [] as unknown, error: null as unknown },
  };
  const builder = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "delete", "eq", "gte", "lte", "order", "single"]) {
      b[m] = (...args: unknown[]) => {
        state.calls.push({ method: m, args });
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => unknown) => resolve(state.result);
    return b;
  };
  const mockSupabase = {
    from: (t: string) => {
      state.tables.push(t);
      return builder();
    },
  };
  return { state, mockSupabase };
});

vi.mock("../base.repository", async () => {
  const actual = await vi.importActual<typeof import("../base.repository")>("../base.repository");
  return { ...actual, supabase: h.mockSupabase };
});

import { opsRepo } from "../ops.repository";

const find = (m: string): Call[] => h.state.calls.filter((c) => c.method === m);

describe("opsRepo", () => {
  beforeEach(() => {
    h.state.calls = [];
    h.state.tables = [];
    h.state.result = { data: [], error: null };
  });

  it("listActivities lê a view com contadores, filtrando a obra e ordenando por etapa", async () => {
    await opsRepo.listActivities("p1");
    expect(h.state.tables).toEqual(["v_ops_activities"]);
    expect(find("eq")[0].args).toEqual(["project_id", "p1"]);
    expect(find("order").map((c) => c.args[0])).toEqual(["stage_sort_order", "sort_order"]);
  });

  it("listDay filtra o dia e, opcionalmente, a pessoa", async () => {
    await opsRepo.listDay("2026-10-14");
    expect(h.state.tables).toEqual(["ops_assignments"]);
    expect(find("eq").map((c) => c.args)).toEqual([["work_date", "2026-10-14"]]);
    h.state.calls = [];
    await opsRepo.listDay("2026-10-14", "u1");
    expect(find("eq").map((c) => c.args)).toEqual([
      ["work_date", "2026-10-14"],
      ["user_id", "u1"],
    ]);
  });

  it("listAssignments usa a janela de datas", async () => {
    await opsRepo.listAssignments("p1", "2026-10-12", "2026-10-16");
    expect(find("gte")[0].args).toEqual(["work_date", "2026-10-12"]);
    expect(find("lte")[0].args).toEqual(["work_date", "2026-10-16"]);
  });

  it("createAssignment não envia project_id (vem do trigger)", async () => {
    h.state.result = { data: { id: "a" }, error: null };
    await opsRepo.createAssignment({ activity_id: "act", work_date: "2026-10-14", worker_name: "João" });
    const payload = find("insert")[0].args[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("project_id");
    expect(payload).toMatchObject({ activity_id: "act", worker_name: "João" });
  });

  it("setOutcome: 'Não feito' leva o motivo; 'Feito' e desfazer limpam o motivo", async () => {
    h.state.result = { data: { id: "x" }, error: null };
    await opsRepo.setOutcome("x", "nao_feito", { reason: "material", notes: "Massa não chegou" });
    expect(find("update")[0].args[0]).toEqual({ outcome: "nao_feito", not_done_reason: "material", notes: "Massa não chegou" });
    h.state.calls = [];
    await opsRepo.setOutcome("x", "feito", { reason: "material" });
    expect(find("update")[0].args[0]).toEqual({ outcome: "feito", not_done_reason: null });
    h.state.calls = [];
    await opsRepo.setOutcome("x", null);
    expect(find("update")[0].args[0]).toEqual({ outcome: null, not_done_reason: null });
  });

  it("createReview grava em ops_reviews (retrabalho é criado no banco)", async () => {
    h.state.result = { data: { id: "r" }, error: null };
    await opsRepo.createReview({ activity_id: "act", result: "refazer", notes: "Fora de nível" });
    expect(h.state.tables).toEqual(["ops_reviews"]);
    expect(find("insert")[0].args[0]).toEqual({ activity_id: "act", result: "refazer", notes: "Fora de nível" });
  });

  it("listStageRollup lê a ponte por etapa", async () => {
    await opsRepo.listStageRollup("p1");
    expect(h.state.tables).toEqual(["v_stage_rollup"]);
  });

  it("propaga erro com mensagem amigável", async () => {
    h.state.result = { data: null, error: { message: "new row violates row-level security policy", code: "42501", details: "", hint: "" } };
    const res = await opsRepo.createActivity({ project_id: "p1", stage_id: "s1", title: "X" });
    expect(res.error).toBeTruthy();
    expect(res.error?.userError).toBeDefined();
  });
});
