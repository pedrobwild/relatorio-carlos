/**
 * Feito / Não feito sem sinal: fila persistida, retomada em ordem, último
 * toque vale, recusa do servidor vira aviso (e a tela volta ao salvo).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MutationObserver,
  QueryClient,
  dehydrate,
  hydrate,
  onlineManager,
} from "@tanstack/react-query";
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
  applyPendingOutcomes,
  collapseQueuedOutcomes,
  registerOpsOfflineDefaults,
  shouldPersistMutation,
  syncFailures,
  type PendingOutcome,
  type SetOutcomeVars,
} from "@/lib/offline/opsOutcomeSync";

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

/** Mesmo caminho do hook: descarta o que não saiu e enfileira. */
function tap(qc: QueryClient, vars: SetOutcomeVars) {
  collapseQueuedOutcomes(qc, vars.id);
  const obs = new MutationObserver<unknown, unknown, SetOutcomeVars>(qc, { mutationKey: KEY });
  obs.mutate(vars).catch(() => undefined);
  return obs;
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

  it("persiste a fila e retoma depois de recarregar, na ordem", async () => {
    onlineManager.setOnline(false);
    const qc = makeClient();
    tap(qc, { id: "a", outcome: "feito" });
    tap(qc, { id: "b", outcome: "nao_feito", reason: "clima" });
    await flush();

    // "Fecha o app": só a fila offline vai para o aparelho, e via JSON.
    const saved = JSON.parse(JSON.stringify(dehydrate(qc, { shouldDehydrateMutation: shouldPersistMutation })));
    expect(saved.mutations).toHaveLength(2);
    qc.unmount();
    qc.getMutationCache().clear();

    // "Reabre": cliente novo, defaults registrados ANTES de hidratar.
    const qc2 = makeClient();
    hydrate(qc2, saved);
    expect(pending(qc2)).toHaveLength(2);

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
    void qc2.resumePausedMutations();
    await flush();
    // Um de cada vez: "b" só começa depois que "a" terminar.
    expect(order).toEqual(["start:a"]);
    releaseFirst();
    await flush(20);
    expect(order).toEqual(["start:a", "end:a", "start:b", "end:b"]);
    expect(h.setOutcome).toHaveBeenNthCalledWith(2, "b", "nao_feito", expect.objectContaining({ reason: "clima" }));
    expect(pending(qc2)).toHaveLength(0);
  });

  it("outras mutações (sem fila offline) não vão para o aparelho", () => {
    expect(
      shouldPersistMutation({ options: { meta: undefined }, state: { status: "pending" } }),
    ).toBe(false);
    expect(
      shouldPersistMutation({ options: { meta: { offlineQueue: true } }, state: { status: "error" } }),
    ).toBe(false);
    expect(
      shouldPersistMutation({ options: { meta: { offlineQueue: true } }, state: { status: "pending" } }),
    ).toBe(true);
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
