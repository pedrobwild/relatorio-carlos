/**
 * Feito / Não feito sem sinal: caixa de saída própria (fora do cache das
 * consultas), retomada em ordem, sem envio em dobro, último toque vale,
 * recusa do servidor vira aviso (e a tela volta ao salvo).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, dehydrate, hydrate, onlineManager } from "@tanstack/react-query";
import type { OpsDayAssignment } from "@/infra/repositories/ops.repository";

const h = vi.hoisted(() => ({
  setOutcome: vi.fn(),
  session: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {}, from: vi.fn() } }));
vi.mock("@/infra/repositories/ops.repository", () => ({ opsRepo: { setOutcome: h.setOutcome } }));
vi.mock("@/lib/authRecovery", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/authRecovery")>()),
  checkSessionForWrite: h.session,
}));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: vi.fn() } }));

import { queryKeys } from "@/lib/queryKeys";
import {
  __setOutcomeOutboxForTests,
  applyPendingOutcomes,
  discardQueuedOutcomes,
  enqueueOutcome,
  getOutcomeOutbox,
  registerOpsOfflineDefaults,
  restoreQueuedOutcomes,
  setOutboxUser,
  syncFailures,
  type PendingOutcome,
  type SetOutcomeVars,
} from "@/lib/offline/opsOutcomeSync";
import {
  createLocalStorageOutboxStorage,
  createOutbox,
  type OutboxStorage,
} from "@/lib/offline/outcomeOutbox";
import { createMemoryStorage } from "@/lib/offline/idb";
import { createQueryPersister, QUERY_CACHE_VERSION } from "@/lib/queryPersister";

const KEY = queryKeys.ops.setOutcomeMutation;

const clients: QueryClient[] = [];

function makeClient() {
  const qc = new QueryClient();
  // Como o QueryClientProvider: escuta a rede e retoma a fila ao reconectar.
  qc.mount();
  clients.push(qc);
  registerOpsOfflineDefaults(qc);
  // Sem esperar o backoff real nos testes.
  qc.setMutationDefaults(KEY, { ...qc.getMutationDefaults(KEY), retryDelay: 0 });
  return qc;
}

/** Mesmo caminho do hook: descarta o que não saiu, guarda e enfileira. */
function tap(qc: QueryClient, vars: SetOutcomeVars) {
  return enqueueOutcome(qc, vars);
}

/** Caixa de saída com armazenamento "do aparelho" (sobrevive à reabertura). */
let disk: OutboxStorage<SetOutcomeVars>;
function openOutbox(user: string | null = "u1", storage = disk) {
  const box = createOutbox<SetOutcomeVars>(storage);
  __setOutcomeOutboxForTests(box, user);
  return box;
}

/** "Fecha e reabre o app": memória zerada, só o que está no disco volta. */
async function reopen(prev: QueryClient, user = "u1", storage = disk) {
  await getOutcomeOutbox().flush();
  prev.unmount();
  prev.getMutationCache().clear();
  const box = openOutbox(user, storage);
  await box.load();
  return makeClient();
}

const pending = (qc: QueryClient) =>
  qc.getMutationCache().findAll({ mutationKey: KEY, status: "pending" });

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

const row = (id: string, outcome: string | null) => ({
  data: { id, outcome, not_done_reason: null, notes: null, done_at: outcome ? "2026-10-12T10:00:00Z" : null },
  error: null,
});

function day(over: Partial<OpsDayAssignment> & { id: string }): OpsDayAssignment {
  return {
    activity_id: "a",
    created_at: "",
    created_by: null,
    done_at: null,
    done_by: null,
    fornecedor_id: null,
    not_done_reason: null,
    notes: null,
    outcome: null,
    photo_paths: [],
    project_id: "p1",
    updated_at: "",
    user_id: null,
    work_date: "2026-10-12",
    worker_name: null,
    activity: null,
    project: null,
    fornecedor: null,
    ...over,
  } as OpsDayAssignment;
}

beforeEach(() => {
  disk = createMemoryStorage();
  openOutbox();
  localStorage.clear();
  h.setOutcome.mockReset();
  h.session.mockReset().mockResolvedValue({ outcome: "recovered", userId: "u1" });
  h.toastError.mockReset();
  syncFailures.clear();
  onlineManager.setOnline(true);
});

afterEach(() => {
  clients.splice(0).forEach((c) => c.unmount());
  onlineManager.setOnline(true);
});

describe("fila do Feito / Não feito", () => {
  it("sem sinal: fica pausada, não chama o banco", async () => {
    onlineManager.setOnline(false);
    const qc = makeClient();
    tap(qc, { id: "x", outcome: "feito" });
    await flush();
    const [m] = pending(qc);
    expect(m.state.isPaused).toBe(true);
    expect(h.setOutcome).not.toHaveBeenCalled();
  });

  it("guarda na caixa de saída e retoma depois de reabrir o app, na ordem", async () => {
    onlineManager.setOnline(false);
    const qc = makeClient();
    tap(qc, { id: "a", outcome: "feito" });
    tap(qc, { id: "b", outcome: "nao_feito", reason: "clima" });
    await flush();
    expect((await disk.getAll()).map((e) => e.vars.id).sort()).toEqual(["a", "b"]);

    const qc2 = await reopen(qc);
    expect(restoreQueuedOutcomes(qc2, "u1")).toBe(2);
    expect(pending(qc2)).toHaveLength(2);
    // A hora do toque sobrevive à reabertura.
    expect((pending(qc2)[0].state.variables as SetOutcomeVars).queuedAt).toEqual(expect.any(Number));

    const order: string[] = [];
    let releaseFirst!: () => void;
    h.setOutcome.mockImplementation((id: string, outcome: string | null) => {
      order.push(`start:${id}`);
      if (id === "a") {
        return new Promise((r) => {
          releaseFirst = () => {
            order.push("end:a");
            r(row(id, outcome));
          };
        });
      }
      order.push(`end:${id}`);
      return Promise.resolve(row(id, outcome));
    });

    onlineManager.setOnline(true);
    await flush();
    // Um de cada vez: "b" só começa depois que "a" terminar.
    expect(order).toEqual(["start:a"]);
    releaseFirst();
    await flush(20);
    expect(order).toEqual(["start:a", "end:a", "start:b", "end:b"]);
    expect(h.setOutcome).toHaveBeenNthCalledWith(2, "b", "nao_feito", expect.objectContaining({ reason: "clima" }));
    expect(pending(qc2)).toHaveLength(0);
    // Confirmado pelo banco: sai da caixa (memória e disco).
    await getOutcomeOutbox().flush();
    expect(getOutcomeOutbox().getSnapshot()).toHaveLength(0);
    expect(await disk.getAll()).toHaveLength(0);
  });

  it("restaurar de novo (outro evento de sessão) não duplica o envio", async () => {
    onlineManager.setOnline(false);
    const qc = makeClient();
    tap(qc, { id: "a", outcome: "feito" });
    const qc2 = await reopen(qc);
    expect(restoreQueuedOutcomes(qc2, "u1")).toBe(1);
    expect(restoreQueuedOutcomes(qc2, "u1")).toBe(0);
    expect(pending(qc2)).toHaveLength(1);
    // Já saindo (requisição no ar): também não recria.
    let release!: () => void;
    h.setOutcome.mockImplementation(
      (id: string, outcome: string | null) => new Promise((r) => (release = () => r(row(id, outcome)))),
    );
    onlineManager.setOnline(true);
    await flush();
    expect(h.setOutcome).toHaveBeenCalledTimes(1);
    expect(restoreQueuedOutcomes(qc2, "u1")).toBe(0);
    release();
    await flush(20);
    expect(restoreQueuedOutcomes(qc2, "u1")).toBe(0);
    expect(h.setOutcome).toHaveBeenCalledTimes(1);
  });

  it("cache das consultas com mutação antiga + caixa de saída: envia uma vez só", async () => {
    onlineManager.setOnline(false);
    const qc = makeClient();
    tap(qc, { id: "a", outcome: "feito" });
    await flush();
    // Um cache gravado por uma versão anterior, que ainda guardava a mutação.
    const legacy = JSON.parse(
      JSON.stringify(dehydrate(qc, { shouldDehydrateMutation: () => true, shouldDehydrateQuery: () => false })),
    );
    expect(legacy.mutations).toHaveLength(1);
    localStorage.setItem(
      `bwild-query-cache-v${QUERY_CACHE_VERSION}`,
      JSON.stringify({ timestamp: Date.now(), buster: String(QUERY_CACHE_VERSION), clientState: legacy }),
    );

    const qc2 = await reopen(qc);
    const persister = createQueryPersister()!;
    const restored = await persister.restoreClient();
    expect(restored?.clientState.mutations).toEqual([]);
    hydrate(qc2, restored!.clientState);
    void qc2.resumePausedMutations();
    restoreQueuedOutcomes(qc2, "u1");

    h.setOutcome.mockImplementation((id: string, outcome: string | null) => Promise.resolve(row(id, outcome)));
    onlineManager.setOnline(true);
    await flush(20);
    expect(h.setOutcome).toHaveBeenCalledTimes(1);

    // E o que vai para o cache agora não leva mutação nenhuma.
    tap(qc2, { id: "b", outcome: "feito" });
    await persister.persistClient({
      timestamp: Date.now(),
      buster: "",
      clientState: dehydrate(qc2, { shouldDehydrateMutation: () => true }),
    });
    const saved = JSON.parse(localStorage.getItem(`bwild-query-cache-v${QUERY_CACHE_VERSION}`)!);
    expect(saved.clientState.mutations).toEqual([]);
  });

  describe("a caixa de saída sobrevive ao descarte do cache das consultas", () => {
    const cacheKey = `bwild-query-cache-v${QUERY_CACHE_VERSION}`;

    async function queueOfflineWithLocalStorage() {
      const storage = createLocalStorageOutboxStorage<SetOutcomeVars>();
      openOutbox("u1", storage);
      onlineManager.setOnline(false);
      const qc = makeClient();
      tap(qc, { id: "a", outcome: "feito" });
      tap(qc, { id: "b", outcome: "nao_feito", reason: "material" });
      await getOutcomeOutbox().flush();
      return { qc, storage };
    }

    async function expectRestoredAndSent(qc: QueryClient, storage: OutboxStorage<SetOutcomeVars>) {
      const qc2 = await reopen(qc, "u1", storage);
      expect(restoreQueuedOutcomes(qc2, "u1")).toBe(2);
      h.setOutcome.mockImplementation((id: string, outcome: string | null) => Promise.resolve(row(id, outcome)));
      onlineManager.setOnline(true);
      await flush(20);
      expect(h.setOutcome.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    }

    it("app fechado por mais de 24 h (maxAge)", async () => {
      const { qc, storage } = await queueOfflineWithLocalStorage();
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ timestamp: Date.now() - 48 * 3600_000, buster: "", clientState: { queries: [], mutations: [] } }),
      );
      expect(await createQueryPersister()!.restoreClient()).toBeUndefined();
      expect(localStorage.getItem(cacheKey)).toBeNull();
      await expectRestoredAndSent(qc, storage);
    });

    it("deploy com QUERY_CACHE_VERSION novo (buster)", async () => {
      const { qc, storage } = await queueOfflineWithLocalStorage();
      localStorage.setItem("bwild-query-cache-v1", "{}");
      createQueryPersister(); // limpa as versões antigas do cache
      expect(localStorage.getItem("bwild-query-cache-v1")).toBeNull();
      await expectRestoredAndSent(qc, storage);
    });

    it("cota do localStorage estourada ao gravar o cache", async () => {
      const { qc, storage } = await queueOfflineWithLocalStorage();
      localStorage.setItem(cacheKey, "{}");
      const realSet = Storage.prototype.setItem;
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k, v) {
        if (k === cacheKey) throw new DOMException("cheio", "QuotaExceededError");
        return realSet.call(this, k, v);
      });
      try {
        await createQueryPersister()!.persistClient({
          timestamp: Date.now(),
          buster: "",
          clientState: { queries: [], mutations: [] },
        });
      } finally {
        spy.mockRestore();
      }
      expect(localStorage.getItem(cacheKey)).toBeNull(); // o cache foi embora…
      await expectRestoredAndSent(qc, storage); // …a fila não.
    });
  });

  it("registros de outra conta: não aparecem nem são enviados com a sessão atual", async () => {
    onlineManager.setOnline(false);
    const qc = makeClient();
    tap(qc, { id: "a", outcome: "feito" }); // u1
    const qc2 = await reopen(qc, "u2");
    expect(restoreQueuedOutcomes(qc2, "u2")).toBe(0);
    expect(pending(qc2)).toHaveLength(0);
    expect(getOutcomeOutbox().forUser("u1")).toHaveLength(1);
  });

  it("sessão de outra conta na hora do envio: não envia e continua guardado", async () => {
    const qc = makeClient();
    h.session.mockResolvedValue({ outcome: "recovered", userId: "u2" });
    tap(qc, { id: "a", outcome: "feito", label: "Piso" });
    await flush(20);
    expect(h.setOutcome).not.toHaveBeenCalled();
    expect(syncFailures.getSnapshot()).toHaveLength(0);
    expect(getOutcomeOutbox().forUser("u1")).toHaveLength(1);
    // A conta dona entra de novo: sai.
    h.session.mockResolvedValue({ outcome: "recovered", userId: "u1" });
    h.setOutcome.mockImplementation((id: string, outcome: string | null) => Promise.resolve(row(id, outcome)));
    expect(restoreQueuedOutcomes(qc, "u1")).toBe(1);
    await flush(20);
    expect(h.setOutcome).toHaveBeenCalledTimes(1);
    expect(getOutcomeOutbox().forUser("u1")).toHaveLength(0);
  });

  it("sem sessão (recusada): não descarta, sai quando a pessoa entrar de novo", async () => {
    const qc = makeClient();
    h.session.mockResolvedValue({ outcome: "rejected", userId: null });
    tap(qc, { id: "a", outcome: "feito" });
    await flush(20);
    expect(h.setOutcome).not.toHaveBeenCalled();
    expect(getOutcomeOutbox().forUser("u1")).toHaveLength(1);
    expect(syncFailures.getSnapshot()).toHaveLength(0);
  });

  it("Sair mesmo assim: apaga a caixa desta conta (e só dela)", async () => {
    onlineManager.setOnline(false);
    const qc = makeClient();
    tap(qc, { id: "a", outcome: "feito" });
    setOutboxUser("u2");
    tap(qc, { id: "b", outcome: "feito" });
    setOutboxUser("u1");
    await flush();
    expect(discardQueuedOutcomes(qc, "u1")).toBe(1);
    await getOutcomeOutbox().flush();
    expect((await disk.getAll()).map((e) => e.userId)).toEqual(["u2"]);
    expect(pending(qc).map((m) => (m.state.variables as SetOutcomeVars).id)).toEqual(["b"]);
  });

  it("entradas de outras contas somem depois de 7 dias", () => {
    let now = Date.parse("2026-10-01T10:00:00Z");
    const box = createOutbox<SetOutcomeVars>(createMemoryStorage(), { now: () => now });
    box.add("u2", { id: "velho", outcome: "feito" });
    now += 6 * 86_400_000;
    box.add("u2", { id: "novo", outcome: "feito" });
    box.add("u1", { id: "meu", outcome: "feito" });
    now += 2 * 86_400_000; // velho: 8 dias; novo: 2 dias
    expect(box.purgeOtherUsers("u1", 7 * 86_400_000)).toBe(1);
    expect(box.getSnapshot().map((e) => e.vars.id)).toEqual(["novo", "meu"]);
  });

  it("último toque vale: Feito → Desfazer → Não feito sem sinal envia só o último", async () => {
    onlineManager.setOnline(false);
    const qc = makeClient();
    tap(qc, { id: "x", outcome: "feito" });
    tap(qc, { id: "x", outcome: null });
    tap(qc, { id: "y", outcome: "feito" });
    tap(qc, { id: "x", outcome: "nao_feito", reason: "material" });
    await flush();
    expect(pending(qc).map((m) => (m.state.variables as SetOutcomeVars).id)).toEqual(["y", "x"]);
    expect(getOutcomeOutbox().getSnapshot().map((e) => e.vars.id)).toEqual(["y", "x"]);

    h.setOutcome.mockImplementation((id: string, outcome: string | null) => Promise.resolve(row(id, outcome)));
    onlineManager.setOnline(true);
    await flush(20);
    expect(h.setOutcome).toHaveBeenCalledTimes(2);
    expect(h.setOutcome).toHaveBeenLastCalledWith("x", "nao_feito", expect.objectContaining({ reason: "material" }));
  });

  it("aplica a fila por cima dos dados do servidor (otimista), último toque vale", () => {
    const list = [day({ id: "x" }), day({ id: "y", outcome: "feito", done_at: "2026-10-12T09:00:00Z" })];
    const queue: PendingOutcome[] = [
      { vars: { id: "x", outcome: "feito" }, submittedAt: Date.parse("2026-10-12T11:00:00Z") },
      { vars: { id: "y", outcome: null }, submittedAt: 1 },
      { vars: { id: "x", outcome: "nao_feito", reason: "clima", notes: "chuva" }, submittedAt: 2 },
    ];
    const out = applyPendingOutcomes(list, queue)!;
    expect(out[0]).toMatchObject({ outcome: "nao_feito", not_done_reason: "clima", notes: "chuva" });
    expect(out[1]).toMatchObject({ outcome: null, done_at: null });
    // Sem fila: devolve a lista do servidor como está.
    expect(applyPendingOutcomes(list, [])).toBe(list);
  });

  it("recusa no envio (RLS): sai da fila (a tela volta ao salvo) e vira aviso", async () => {
    const qc = makeClient();
    h.setOutcome.mockResolvedValue({
      data: null,
      error: { message: "new row violates row-level security policy", code: "42501", details: "", hint: "" },
    });
    tap(qc, { id: "x", outcome: "feito", label: "Pintura da sala" });
    await flush(20);
    expect(h.setOutcome).toHaveBeenCalledTimes(1); // recusa não é repetida
    expect(pending(qc)).toHaveLength(0);
    expect(getOutcomeOutbox().getSnapshot()).toHaveLength(0);
    // Sem nada na fila, a sobreposição não muda mais o dia: rollback.
    const list = [day({ id: "x" })];
    expect(applyPendingOutcomes(list, [])![0].outcome).toBeNull();
    const [f] = syncFailures.getSnapshot();
    expect(f).toMatchObject({ assignmentId: "x", label: "Pintura da sala", action: "Feito" });
    expect(h.toastError).toHaveBeenCalledWith(
      'Não foi possível enviar "Feito" de Pintura da sala',
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it("alocação apagada no meio do caminho (0 linhas) também vira aviso", async () => {
    const qc = makeClient();
    h.setOutcome.mockResolvedValue({
      data: null,
      error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116", details: "", hint: "" },
    });
    tap(qc, { id: "x", outcome: null, label: "Gesso" });
    await flush(20);
    expect(syncFailures.getSnapshot()[0]).toMatchObject({ action: "Desfazer", label: "Gesso" });
  });

  it("falha de rede no envio: continua na fila e tenta de novo (não é falha)", async () => {
    const qc = makeClient();
    h.setOutcome
      .mockResolvedValueOnce({ data: null, error: { message: "TypeError: Failed to fetch", code: "", details: "", hint: "" } })
      .mockImplementation((id: string, outcome: string | null) => Promise.resolve(row(id, outcome)));
    tap(qc, { id: "x", outcome: "feito" });
    await flush(20);
    expect(h.setOutcome).toHaveBeenCalledTimes(2);
    expect(syncFailures.getSnapshot()).toHaveLength(0);
    expect(pending(qc)).toHaveLength(0);
    expect(getOutcomeOutbox().getSnapshot()).toHaveLength(0);
  });

  it("sessão impossível de confirmar (sem rede): não envia com chave anônima, espera", async () => {
    const qc = makeClient();
    h.session
      .mockResolvedValueOnce({ outcome: "unknown", userId: null })
      .mockResolvedValue({ outcome: "recovered", userId: "u1" });
    h.setOutcome.mockImplementation((id: string, outcome: string | null) => Promise.resolve(row(id, outcome)));
    tap(qc, { id: "x", outcome: "feito" });
    await flush(20);
    expect(h.session).toHaveBeenCalledTimes(2);
    expect(h.setOutcome).toHaveBeenCalledTimes(1);
    expect(syncFailures.getSnapshot()).toHaveLength(0);
  });

  it("confirmado pelo banco: a linha devolvida entra no cache do dia", async () => {
    const qc = makeClient();
    const dayKey = queryKeys.ops.day("2026-10-12");
    qc.setQueryData(dayKey, [day({ id: "x", activity: { title: "Piso" } as OpsDayAssignment["activity"] })]);
    h.setOutcome.mockResolvedValue(row("x", "feito"));
    tap(qc, { id: "x", outcome: "feito" });
    await flush(20);
    const [x] = qc.getQueryData<OpsDayAssignment[]>(dayKey)!;
    expect(x.outcome).toBe("feito");
    expect(x.activity?.title).toBe("Piso"); // relações preservadas
  });

  it("as leituras da operação não são recolhidas antes do maxAge do cache (24 h)", () => {
    const qc = makeClient();
    const opts = qc.defaultQueryOptions({ queryKey: queryKeys.ops.day("2026-10-12") });
    expect(opts.gcTime).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
  });
});
