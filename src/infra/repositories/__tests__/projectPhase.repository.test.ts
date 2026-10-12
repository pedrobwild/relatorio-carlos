/**
 * Repositório da fase de projeto: tabela e filtros certos, upsert só com os
 * campos enviados, leitura de carteira em lotes e páginas, e a RPC de mover.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { method: string; args: unknown[] };
type Result = { data: unknown; error: unknown };

const h = vi.hoisted(() => {
  const state = {
    calls: [] as { method: string; args: unknown[] }[],
    tables: [] as string[],
    rpcs: [] as { fn: string; args: unknown }[],
    /** Resposta de cada consulta; recebe as chamadas feitas no builder. */
    respond: ((_calls: { method: string; args: unknown[] }[]) => ({ data: [], error: null })) as (
      calls: { method: string; args: unknown[] }[],
    ) => { data: unknown; error: unknown },
    rpcResult: { data: null as unknown, error: null as unknown },
  };
  const builder = (): Record<string, unknown> => {
    const own: { method: string; args: unknown[] }[] = [];
    const b: Record<string, unknown> = {};
    for (const m of ["select", "upsert", "eq", "in", "order", "range", "single"]) {
      b[m] = (...args: unknown[]) => {
        const call = { method: m, args };
        own.push(call);
        state.calls.push(call);
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => unknown) => resolve(state.respond(own));
    return b;
  };
  const mockSupabase = {
    from: (t: string) => {
      state.tables.push(t);
      return builder();
    },
    rpc: async (fn: string, args: unknown) => {
      state.rpcs.push({ fn, args });
      return state.rpcResult;
    },
  };
  return { state, mockSupabase };
});

vi.mock("../base.repository", async () => {
  const actual = await vi.importActual<typeof import("../base.repository")>("../base.repository");
  return { ...actual, supabase: h.mockSupabase };
});

import { projectPhaseRepo } from "../projectPhase.repository";
import { PAGE_SIZE, PORTFOLIO_CHUNK } from "../obrasPanel.repository";

const find = (m: string): Call[] => h.state.calls.filter((c) => c.method === m);
const ok = (data: unknown): Result => ({ data, error: null });

describe("projectPhaseRepo", () => {
  beforeEach(() => {
    h.state.calls = [];
    h.state.tables = [];
    h.state.rpcs = [];
    h.state.respond = () => ok([]);
    h.state.rpcResult = { data: null, error: null };
  });

  describe("listSteps", () => {
    it("lê as etapas da obra, na ordem do fluxo", async () => {
      const rows = [{ id: "s1", project_id: "p1", step: "projeto_3d" }];
      h.state.respond = () => ok(rows);
      const res = await projectPhaseRepo.listSteps("p1");
      expect(h.state.tables).toEqual(["project_phase_steps"]);
      expect(find("eq")[0].args).toEqual(["project_id", "p1"]);
      expect(find("order")[0].args).toEqual(["step", { ascending: true }]);
      expect(res).toEqual({ data: rows, error: null });
    });

    it("obra sem nada registrado: lista vazia, sem erro", async () => {
      h.state.respond = () => ok(null);
      expect(await projectPhaseRepo.listSteps("p1")).toEqual({ data: [], error: null });
    });

    it("erro do banco volta com a mensagem para o usuário", async () => {
      h.state.respond = () => ({ data: null, error: { message: "permission denied for table x", code: "42501" } });
      const res = await projectPhaseRepo.listSteps("p1");
      expect(res.data).toEqual([]);
      expect(res.error?.code).toBe("42501");
      expect(res.error?.userError.kind).toBe("forbidden");
    });
  });

  describe("listStepsForProjects", () => {
    it("lista vazia de obras não consulta o banco", async () => {
      expect(await projectPhaseRepo.listStepsForProjects([])).toEqual({ data: [], error: null });
      expect(h.state.tables).toEqual([]);
    });

    it("uma consulta para as obras, sem ids repetidos ou vazios", async () => {
      const rows = [
        { id: "s1", project_id: "p1", step: "projeto_3d" },
        { id: "s2", project_id: "p2", step: "projeto_3d" },
      ];
      h.state.respond = () => ok(rows);
      const res = await projectPhaseRepo.listStepsForProjects(["p1", "p2", "p1", ""]);
      expect(h.state.tables).toEqual(["project_phase_steps"]);
      expect(find("in")[0].args).toEqual(["project_id", ["p1", "p2"]]);
      // Paginação estável: ordena por id e pede a primeira página.
      expect(find("order")[0].args).toEqual(["id", { ascending: true }]);
      expect(find("range")[0].args).toEqual([0, PAGE_SIZE - 1]);
      expect(res).toEqual({ data: rows, error: null });
    });

    it("muitas obras: ids em lotes, e junta as respostas", async () => {
      const ids = Array.from({ length: PORTFOLIO_CHUNK * 2 + 3 }, (_, i) => `p${i}`);
      h.state.respond = (calls) => {
        const lot = calls.find((c) => c.method === "in")?.args[1] as string[];
        return ok(lot.map((project_id) => ({ id: `s-${project_id}`, project_id, step: "projeto_3d" })));
      };
      const res = await projectPhaseRepo.listStepsForProjects(ids);
      const lots = find("in").map((c) => (c.args[1] as string[]).length);
      expect(lots).toEqual([PORTFOLIO_CHUNK, PORTFOLIO_CHUNK, 3]);
      expect(res.error).toBeNull();
      expect(res.data.map((r) => r.project_id).sort()).toEqual([...ids].sort());
    });

    it("resposta cheia (1000 linhas): busca a página seguinte em vez de cortar em silêncio", async () => {
      const full = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `a${i}`, project_id: "p1", step: "projeto_3d" }));
      const rest = [{ id: "z", project_id: "p1", step: "projeto_executivo" }];
      h.state.respond = (calls) => {
        const from = calls.find((c) => c.method === "range")?.args[0];
        return ok(from === 0 ? full : rest);
      };
      const res = await projectPhaseRepo.listStepsForProjects(["p1"]);
      expect(find("range").map((c) => c.args)).toEqual([
        [0, PAGE_SIZE - 1],
        [PAGE_SIZE, PAGE_SIZE * 2 - 1],
      ]);
      expect(res.data).toHaveLength(PAGE_SIZE + 1);
      expect(res.error).toBeNull();
    });

    it("erro num lote: devolve o erro e nenhuma linha (carteira pela metade enganaria a tela)", async () => {
      const ids = Array.from({ length: PORTFOLIO_CHUNK + 1 }, (_, i) => `p${i}`);
      h.state.respond = (calls) => {
        const lot = calls.find((c) => c.method === "in")?.args[1] as string[];
        return lot.length === 1
          ? { data: null, error: { message: "statement timeout", code: "57014" } }
          : ok([{ id: "s1", project_id: "p0", step: "projeto_3d" }]);
      };
      const res = await projectPhaseRepo.listStepsForProjects(ids);
      expect(res.data).toEqual([]);
      expect(res.error?.code).toBe("57014");
    });
  });

  describe("saveStep", () => {
    it("upsert pela chave obra+etapa, devolvendo a linha gravada", async () => {
      const saved = { id: "s1", project_id: "p1", step: "emissao_art", due_date: "2026-10-20" };
      h.state.respond = () => ok(saved);
      const res = await projectPhaseRepo.saveStep({ project_id: "p1", step: "emissao_art", due_date: "2026-10-20" });
      expect(h.state.tables).toEqual(["project_phase_steps"]);
      expect(find("upsert")[0].args).toEqual([
        { project_id: "p1", step: "emissao_art", due_date: "2026-10-20" },
        { onConflict: "project_id,step" },
      ]);
      expect(find("single")).toHaveLength(1);
      expect(res).toEqual({ data: saved, error: null });
    });

    it("envia só os campos presentes: o que não veio não é sobrescrito", async () => {
      await projectPhaseRepo.saveStep({ project_id: "p1", step: "projeto_3d", done_at: "2026-10-01" });
      const payload = find("upsert")[0].args[0] as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(["done_at", "project_id", "step"]);
    });

    it("undefined não é enviado; null é (limpa o campo / reabre a etapa)", async () => {
      await projectPhaseRepo.saveStep({
        project_id: "p1",
        step: "projeto_3d",
        done_at: null,
        due_date: undefined,
        responsible_user_id: null,
        notes: "",
      });
      expect(find("upsert")[0].args[0]).toEqual({
        project_id: "p1",
        step: "projeto_3d",
        done_at: null,
        responsible_user_id: null,
        notes: "",
      });
    });

    it("não deixa passar campos que a tela não pode gravar", async () => {
      const input = {
        project_id: "p1",
        step: "projeto_3d" as const,
        notes: "ok",
        updated_by: "outra-pessoa",
        id: "forjado",
        created_at: "2020-01-01",
      };
      await projectPhaseRepo.saveStep(input);
      expect(find("upsert")[0].args[0]).toEqual({ project_id: "p1", step: "projeto_3d", notes: "ok" });
    });

    it("recusa do banco (conclusão no futuro) volta com o texto em português", async () => {
      h.state.respond = () => ({
        data: null,
        error: { message: "A data de conclusão não pode ser no futuro", code: "23514", details: null, hint: null },
      });
      const res = await projectPhaseRepo.saveStep({ project_id: "p1", step: "projeto_3d", done_at: "2099-01-01" });
      expect(res.data).toBeNull();
      expect(res.error?.userError.userMessage).toBe("A data de conclusão não pode ser no futuro");
    });
  });

  describe("moveToStep", () => {
    it("chama a RPC com a obra e a etapa", async () => {
      const res = await projectPhaseRepo.moveToStep("p1", "medicao_fina");
      expect(h.state.rpcs).toEqual([
        { fn: "move_project_to_phase_step", args: { p_project_id: "p1", p_step: "medicao_fina" } },
      ]);
      expect(h.state.tables).toEqual([]); // nada de gravar direto na tabela
      expect(res).toEqual({ data: null, error: null });
    });

    it("sem permissão / obra fora da fase de projeto: o motivo da RPC chega legível", async () => {
      h.state.rpcResult = { data: null, error: { message: "Sem acesso a esta obra", code: "42501", details: null, hint: null } };
      const denied = await projectPhaseRepo.moveToStep("p1", "medicao_fina");
      expect(denied.error?.userError).toMatchObject({ kind: "forbidden", userMessage: "Sem acesso a esta obra" });

      const outOfPhase = "Esta obra já saiu da fase de projeto: as etapas de projeto não podem mais ser alteradas";
      h.state.rpcResult = { data: null, error: { message: outOfPhase, code: "23514", details: null, hint: null } };
      const refused = await projectPhaseRepo.moveToStep("p1", "medicao_fina");
      expect(refused.error?.userError).toMatchObject({ kind: "validation", userMessage: outOfPhase });
    });
  });
});
