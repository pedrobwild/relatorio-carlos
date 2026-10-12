/**
 * Criação de compra: um caminho só (tela Compras e "Pedir compra" da Semana).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const state = {
    calls: [] as { method: string; args: unknown[] }[],
    tables: [] as string[],
    result: { data: null as unknown, error: null as unknown },
  };
  const builder = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "insert", "single"]) {
      b[m] = (...args: unknown[]) => {
        state.calls.push({ method: m, args });
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => unknown) => resolve(state.result);
    return b;
  };
  return {
    state,
    mockSupabase: {
      from: (t: string) => {
        state.tables.push(t);
        return builder();
      },
    },
  };
});

vi.mock("../base.repository", async () => {
  const actual = await vi.importActual<typeof import("../base.repository")>("../base.repository");
  return { ...actual, supabase: h.mockSupabase };
});

import { purchasesRepo } from "../purchases.repository";

describe("purchasesRepo.create", () => {
  beforeEach(() => {
    h.state.calls = [];
    h.state.tables = [];
    h.state.result = { data: { id: "c1" }, error: null };
  });

  it("insere em project_purchases com quem criou e devolve a linha", async () => {
    const res = await purchasesRepo.create(
      { project_id: "p1", item_name: "Massa corrida", quantity: 2, unit: "lata", required_by_date: "2026-10-20", lead_time_days: 7 },
      "u1",
    );
    expect(h.state.tables).toEqual(["project_purchases"]);
    expect(h.state.calls.find((c) => c.method === "insert")?.args[0]).toEqual({
      project_id: "p1",
      item_name: "Massa corrida",
      quantity: 2,
      unit: "lata",
      required_by_date: "2026-10-20",
      lead_time_days: 7,
      created_by: "u1",
    });
    expect(h.state.calls.some((c) => c.method === "single")).toBe(true);
    expect(res.data).toEqual({ id: "c1" });
  });

  it("devolve o erro do banco", async () => {
    h.state.result = { data: null, error: { code: "42501", message: "rls", details: "", hint: "" } };
    const res = await purchasesRepo.create(
      { project_id: "p1", item_name: "x", quantity: 1, unit: "un", required_by_date: "2026-10-20", lead_time_days: 7 },
      "u1",
    );
    expect(res.error?.code).toBe("42501");
  });
});
