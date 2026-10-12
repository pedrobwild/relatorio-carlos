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
    for (const m of ["select", "insert", "update", "upsert", "delete", "eq", "in", "gte", "lte", "order", "limit", "single"]) {
      b[m] = (...args: unknown[]) => {
        state.calls.push({ method: m, args });
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => unknown) => resolve(state.result);
    return b;
  };
  const storage = {
    buckets: [] as string[],
    uploads: [] as { path: string; contentType?: string }[],
    uploadError: null as unknown,
  };
  const mockSupabase = {
    from: (t: string) => {
      state.tables.push(t);
      return builder();
    },
    storage: {
      from: (bucket: string) => {
        storage.buckets.push(bucket);
        return {
          upload: async (path: string, _file: unknown, opts?: { contentType?: string }) => {
            storage.uploads.push({ path, contentType: opts?.contentType });
            return { data: storage.uploadError ? null : { path }, error: storage.uploadError };
          },
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })),
            error: null,
          }),
        };
      },
    },
  };
  return { state, storage, mockSupabase };
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
    h.storage.buckets = [];
    h.storage.uploads = [];
    h.storage.uploadError = null;
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

  it("setOutcome: 'Não feito' leva o motivo; 'Feito' e desfazer limpam o motivo; desfazer limpa a observação", async () => {
    h.state.result = { data: { id: "x" }, error: null };
    await opsRepo.setOutcome("x", "nao_feito", { reason: "material", notes: "Massa não chegou" });
    expect(find("update")[0].args[0]).toEqual({ outcome: "nao_feito", not_done_reason: "material", notes: "Massa não chegou" });
    h.state.calls = [];
    await opsRepo.setOutcome("x", "feito", { reason: "material" });
    expect(find("update")[0].args[0]).toEqual({ outcome: "feito", not_done_reason: null });
    h.state.calls = [];
    await opsRepo.setOutcome("x", null);
    // Desfazer apaga também a observação do "Não feito".
    expect(find("update")[0].args[0]).toEqual({ outcome: null, not_done_reason: null, notes: null });
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

  it("listDay traz obra, etapa e prestador numa consulta só", async () => {
    await opsRepo.listDay("2026-10-14");
    const sel = String(find("select")[0].args[0]);
    expect(sel).toContain("project:projects(id, name)");
    expect(sel).toContain("stage:project_activities(description)");
    expect(sel).toContain("fornecedor:fornecedores(nome)");
  });

  it("listReadiness: sem atividades não consulta; com atividades usa IN", async () => {
    const empty = await opsRepo.listReadiness([]);
    expect(empty.data).toEqual([]);
    expect(h.state.tables).toEqual([]);
    await opsRepo.listReadiness(["a1", "a2"]);
    expect(h.state.tables).toEqual(["v_ops_activities"]);
    expect(find("in")[0].args).toEqual(["id", ["a1", "a2"]]);
  });

  it("listStages lê as etapas do cronograma na ordem", async () => {
    await opsRepo.listStages("p1");
    expect(h.state.tables).toEqual(["project_activities"]);
    expect(find("order")[0].args[0]).toBe("sort_order");
  });

  it("uploadPhoto grava no bucket privado com o project_id na frente do caminho", async () => {
    const file = new File(["x"], "IMG 01.JPEG", { type: "image/jpeg" });
    const res = await opsRepo.uploadPhoto("p1", "as1", file);
    expect(h.storage.buckets).toEqual(["ops-photos"]);
    expect(res.data).toMatch(/^p1\/as1\/\d+-[a-z0-9]+\.jpeg$/);
    expect(h.storage.uploads[0].contentType).toBe("image/jpeg");
  });

  it("uploadPhoto devolve o erro do storage", async () => {
    h.storage.uploadError = { message: "denied" };
    const res = await opsRepo.uploadPhoto("p1", "as1", new File(["x"], "a.jpg"));
    expect(res.data).toBeNull();
    expect(res.error).toEqual({ message: "denied" });
  });

  it("setPhotos só mexe nas fotos", async () => {
    h.state.result = { data: { id: "as1" }, error: null };
    await opsRepo.setPhotos("as1", ["p1/as1/a.jpg"]);
    expect(find("update")[0].args[0]).toEqual({ photo_paths: ["p1/as1/a.jpg"] });
  });

  it("getPhotoUrls assina os caminhos", async () => {
    const res = await opsRepo.getPhotoUrls(["p1/as1/a.jpg"]);
    expect(res.data).toEqual([{ path: "p1/as1/a.jpg", url: "https://signed/p1/as1/a.jpg" }]);
  });

  it("createAssignments grava em lote sem project_id e não consulta se vazio", async () => {
    const empty = await opsRepo.createAssignments([]);
    expect(empty.data).toEqual([]);
    expect(h.state.tables).toEqual([]);
    await opsRepo.createAssignments([
      { activity_id: "a", work_date: "2026-10-20", worker_name: "João" },
      { activity_id: "a", work_date: "2026-10-21", worker_name: "João" },
    ]);
    expect(h.state.tables).toEqual(["ops_assignments"]);
    const rows = find("insert")[0].args[0] as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => "project_id" in r)).toBe(false);
  });

  it("updateAssignmentPlan muda só dia e quem", async () => {
    h.state.result = { data: { id: "x" }, error: null };
    await opsRepo.updateAssignmentPlan("x", { work_date: "2026-10-21", user_id: null, worker_name: "Ana" });
    expect(find("update")[0].args[0]).toEqual({ work_date: "2026-10-21", user_id: null, worker_name: "Ana" });
    expect(find("eq")[0].args).toEqual(["id", "x"]);
  });

  it("listStages traz as datas previstas da etapa", async () => {
    await opsRepo.listStages("p1");
    expect(String(find("select")[0].args[0])).toContain("planned_start, planned_end");
  });

  it("listAssignmentsByActivity e listMaterialsByProject filtram certo", async () => {
    await opsRepo.listAssignmentsByActivity("a1");
    expect(find("eq")[0].args).toEqual(["activity_id", "a1"]);
    h.state.calls = [];
    await opsRepo.listMaterialsByProject("p1");
    expect(h.state.tables.at(-1)).toBe("ops_materials");
    expect(find("eq")[0].args).toEqual(["project_id", "p1"]);
  });

  it("closeWeek manda só obra, semana e observação (os números são do banco) e atualiza se já existe", async () => {
    h.state.result = { data: { id: "c1", planned: 5, done: 4 }, error: null };
    const res = await opsRepo.closeWeek({ project_id: "p1", week_start: "2026-10-05", notes: "chuva" });
    expect(h.state.tables.at(-1)).toBe("ops_week_closings");
    expect(find("upsert")[0].args).toEqual([
      { project_id: "p1", week_start: "2026-10-05", notes: "chuva" },
      { onConflict: "project_id,week_start" },
    ]);
    expect(res.data).toMatchObject({ planned: 5, done: 4 });

    h.state.calls = [];
    await opsRepo.closeWeek({ project_id: "p1", week_start: "2026-10-05" });
    expect((find("upsert")[0].args[0] as { notes: unknown }).notes).toBeNull();
  });

  it("listWeekClosings traz o fechamento da semana e os anteriores; reopenWeek apaga o fechamento", async () => {
    await opsRepo.listWeekClosings("p1", "2026-10-05");
    expect(h.state.tables.at(-1)).toBe("ops_week_closings");
    expect(find("eq")[0].args).toEqual(["project_id", "p1"]);
    // Parte da semana exibida: ela vem sempre, por mais antiga que seja.
    expect(find("lte")[0].args).toEqual(["week_start", "2026-10-05"]);
    expect(find("order")[0].args).toEqual(["week_start", { ascending: false }]);
    expect(find("limit")[0].args).toEqual([6]);

    h.state.calls = [];
    await opsRepo.reopenWeek("c1");
    expect(find("delete")).toHaveLength(1);
    expect(find("eq")[0].args).toEqual(["id", "c1"]);
  });
});
