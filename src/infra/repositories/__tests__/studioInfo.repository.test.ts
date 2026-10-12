/**
 * Repositório da Ficha da obra: tabela certa, uma linha por obra, e o salvar
 * manda só os campos alterados (o resto fica como está no banco).
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
    for (const m of ["select", "upsert", "eq", "single", "maybeSingle"]) {
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

import { studioInfoRepo } from "../studioInfo.repository";

const call = (m: string) => h.state.calls.find((c) => c.method === m);

describe("studioInfoRepo", () => {
  beforeEach(() => {
    h.state.calls = [];
    h.state.tables = [];
    h.state.result = { data: null, error: null };
  });

  it("getStudioInfo lê a linha da obra; obra sem ficha não é erro", async () => {
    const res = await studioInfoRepo.getStudioInfo("p1");
    expect(h.state.tables).toEqual(["project_studio_info"]);
    expect(call("eq")?.args).toEqual(["project_id", "p1"]);
    // maybeSingle (e não single): zero linhas devolve null sem erro.
    expect(call("maybeSingle")).toBeDefined();
    expect(call("single")).toBeUndefined();
    expect(res).toEqual({ data: null, error: null });
  });

  it("getStudioInfo devolve o erro do banco com a mensagem para o usuário", async () => {
    h.state.result = { data: null, error: { message: "permission denied", code: "42501", details: "", hint: "" } };
    const res = await studioInfoRepo.getStudioInfo("p1");
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe("42501");
    expect(res.error?.userError.userMessage).toBeTruthy();
  });

  it("upsertStudioInfo manda só o patch + a obra, em conflito por project_id", async () => {
    h.state.result = { data: { project_id: "p1", concierge_phone: "(11) 3333-4444" }, error: null };
    const res = await studioInfoRepo.upsertStudioInfo("p1", { concierge_phone: "(11) 3333-4444", key_location: null });
    expect(h.state.tables).toEqual(["project_studio_info"]);
    expect(call("upsert")?.args).toEqual([
      { concierge_phone: "(11) 3333-4444", key_location: null, project_id: "p1" },
      { onConflict: "project_id" },
    ]);
    expect(call("single")).toBeDefined();
    expect(res.data).toEqual({ project_id: "p1", concierge_phone: "(11) 3333-4444" });
  });

  it("a obra do patch nunca troca a obra informada", async () => {
    // Um patch montado errado (com project_id de outra obra) não pode gravar na obra errada.
    await studioInfoRepo.upsertStudioInfo("p1", { project_id: "outra" } as never);
    expect((call("upsert")?.args[0] as { project_id: string }).project_id).toBe("p1");
  });
});
