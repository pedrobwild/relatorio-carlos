/**
 * Leituras de carteira da tela Obras: tabelas/views certas, filtros e lotes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const state = {
    queries: [] as { table: string; calls: { method: string; args: unknown[] }[] }[],
    error: null as unknown,
    /** Quando definido, simula uma tabela com este total de linhas (para paginação). */
    total: null as number | null,
  };
  const mockSupabase = {
    from: (table: string) => {
      const q = { table, calls: [] as { method: string; args: unknown[] }[] };
      state.queries.push(q);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "in", "eq", "neq", "not", "gte", "lte", "order", "range"]) {
        b[m] = (...args: unknown[]) => {
          q.calls.push({ method: m, args });
          return b;
        };
      }
      b.then = (resolve: (v: unknown) => unknown) => {
        const ids = (q.calls.find((c) => c.method === "in")?.args[1] ?? []) as string[];
        const range = q.calls.find((c) => c.method === "range")?.args as [number, number] | undefined;
        if (state.total != null && range && !state.error) {
          const n = Math.max(0, Math.min(range[1], state.total - 1) - range[0] + 1);
          return resolve({ data: Array.from({ length: n }, (_, i) => ({ id: `r${range[0] + i}`, project_id: ids[0] })), error: null });
        }
        return resolve({ data: state.error ? null : ids.map((id) => ({ project_id: id })), error: state.error });
      };
      return b;
    },
  };
  return { state, mockSupabase };
});

vi.mock("../base.repository", async () => {
  const actual = await vi.importActual<typeof import("../base.repository")>("../base.repository");
  return { ...actual, supabase: h.mockSupabase };
});

import { chunk, obrasPanelRepo, PAGE_SIZE, PORTFOLIO_CHUNK } from "../obrasPanel.repository";

const call = (i: number, m: string) => h.state.queries[i].calls.find((c) => c.method === m)?.args;

describe("obrasPanelRepo", () => {
  beforeEach(() => {
    h.state.queries = [];
    h.state.error = null;
    h.state.total = null;
  });

  it("sem obras não consulta nada", async () => {
    const res = await obrasPanelRepo.listStages([]);
    expect(res).toEqual({ data: [], error: null });
    expect(h.state.queries).toHaveLength(0);
  });

  it("divide em lotes, remove repetidos e junta o resultado", async () => {
    const ids = Array.from({ length: PORTFOLIO_CHUNK + 3 }, (_, i) => `p${i}`);
    const res = await obrasPanelRepo.listStages([...ids, "p0"]);
    expect(h.state.queries).toHaveLength(2);
    expect(h.state.queries.every((q) => q.table === "internal_schedule_items")).toBe(true);
    expect((call(0, "in")![1] as string[]).length).toBe(PORTFOLIO_CHUNK);
    expect((call(1, "in")![1] as string[]).length).toBe(3);
    expect(res.data).toHaveLength(ids.length);
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });

  it("atividades: só abertas, da view", async () => {
    await obrasPanelRepo.listActivities(["p1"]);
    expect(h.state.queries[0].table).toBe("v_ops_activities");
    expect(call(0, "not")).toEqual(["status", "in", "(aprovada,concluida)"]);
  });

  it("material: só o que não está na obra", async () => {
    await obrasPanelRepo.listOpenMaterials(["p1"]);
    expect(h.state.queries[0].table).toBe("ops_materials");
    expect(call(0, "neq")).toEqual(["status", "na_obra"]);
  });

  it("dias marcados: filtra pela semana", async () => {
    await obrasPanelRepo.listAssignments(["p1"], "2026-10-12", "2026-10-17");
    expect(h.state.queries[0].table).toBe("ops_assignments");
    expect(call(0, "gte")).toEqual(["work_date", "2026-10-12"]);
    expect(call(0, "lte")).toEqual(["work_date", "2026-10-17"]);
  });

  it("dias marcados: lê todas as páginas quando passa de 1000 linhas (nada cortado em silêncio)", async () => {
    h.state.total = PAGE_SIZE * 2 + 5;
    const res = await obrasPanelRepo.listAssignments(["p1"], "2026-10-05", "2026-10-18");
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(PAGE_SIZE * 2 + 5);
    expect(new Set(res.data.map((r) => r.id)).size).toBe(PAGE_SIZE * 2 + 5);
    expect(h.state.queries).toHaveLength(3);
    expect(call(0, "range")).toEqual([0, PAGE_SIZE - 1]);
    expect(call(2, "range")).toEqual([PAGE_SIZE * 2, PAGE_SIZE * 3 - 1]);
    // Ordem estável entre as páginas.
    expect(call(0, "order")).toEqual(["id", { ascending: true }]);
  });

  it("dias marcados: total múltiplo exato de 1000 faz mais uma leitura (vazia) e para", async () => {
    h.state.total = PAGE_SIZE;
    const res = await obrasPanelRepo.listAssignments(["p1"], "2026-10-05", "2026-10-18");
    expect(res.data).toHaveLength(PAGE_SIZE);
    expect(h.state.queries).toHaveLength(2);
  });

  it("fechamentos: pela segunda-feira, dentro do intervalo", async () => {
    await obrasPanelRepo.listClosings(["p1"], "2026-10-05", "2026-10-12");
    expect(h.state.queries[0].table).toBe("ops_week_closings");
    expect(call(0, "gte")).toEqual(["week_start", "2026-10-05"]);
    expect(call(0, "lte")).toEqual(["week_start", "2026-10-12"]);
    // Motivos do não feito: usados pelo Resumo da semana.
    expect(String(call(0, "select")?.[0])).toContain("reasons");
  });

  it("erro em qualquer lote vira erro do resultado", async () => {
    h.state.error = { message: "boom", code: "500" };
    const res = await obrasPanelRepo.listStages(["p1"]);
    expect(res.error).toBeTruthy();
    expect(res.data).toEqual([]);
  });
});
