import { describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "../idb";
import { createDiarioOutbox, payloadComFotos, type DiarioOutboxDeps, type DiarioPendente } from "../diarioOutbox";
import type { DiarioPayload } from "@/lib/diarioObra/regras";

const payload: DiarioPayload = {
  client_id: "c1",
  project_id: "p1",
  report_date: "2026-11-20",
  reporter_function: "gestor",
  no_progress: false,
  team_count: 2,
  team_names: "Ana, Beto",
  third_parties: [],
  sent_offline: false,
  etapas: [
    {
      item_id: "e1",
      status: "andamento",
      photo_path: null,
      foto_id: "f1",
      medicao_tipo: null,
      medicao_agendada: false,
      medicao_data: null,
      medicao_fornecedor_id: null,
      texto_cliente: "Piso em andamento.",
    },
  ],
  pendencias: [],
  materiais: [
    {
      item: "Porcelanato",
      purchase_id: null,
      chegou: "sim",
      confere: "div",
      divergencia_foto_path: null,
      foto_id: "f2",
      divergencia_descricao: "pedido x recebido",
    },
  ],
  prazo: null,
};

const item = (over: Partial<DiarioPendente> = {}): DiarioPendente => ({
  id: "c1",
  userId: "u1",
  projectId: "p1",
  projectName: "Obra 1",
  weekNumber: 3,
  payload,
  fotos: [
    { id: "f1", kind: "etapa", blob: new Blob(["a"]), type: "image/jpeg" },
    { id: "f2", kind: "divergencia", blob: new Blob(["b"]), type: "image/jpeg" },
  ],
  createdAt: 1,
  ...over,
});

const offline = Object.assign(new Error("Failed to fetch"), { offline: true });

function setup(over: Partial<DiarioOutboxDeps> = {}) {
  const storage = createMemoryStorage<DiarioPendente>();
  const state = { online: true, user: "u1" as string | null };
  const uploadFoto = vi.fn(async (_i: DiarioPendente, f: { id: string }) => `p1/${f.id}.jpg`);
  const enviar = vi.fn(async (_p: Record<string, unknown>) => undefined);
  const deps: DiarioOutboxDeps = {
    storage,
    uploadFoto,
    enviar,
    isOnline: () => state.online,
    currentUser: async () => state.user,
    isConnectionError: (e) => (e as { offline?: boolean }).offline === true,
    describeError: (e) => (e as Error).message,
    ...over,
  };
  return { storage, state, uploadFoto, enviar, deps, outbox: createDiarioOutbox(deps) };
}

describe("caixa de saída do diário de obra", () => {
  it("troca os ids das fotos pelos caminhos no payload", () => {
    const p = payloadComFotos(
      item({ fotos: item().fotos.map((f) => ({ ...f, path: `x/${f.id}.jpg` })) }),
    ) as unknown as DiarioPayload;
    expect(p.etapas[0]).toMatchObject({ photo_path: "x/f1.jpg" });
    expect(p.etapas[0]).not.toHaveProperty("foto_id");
    expect(p.materiais[0]).toMatchObject({ divergencia_foto_path: "x/f2.jpg" });
  });

  it("com sinal: sobe as fotos, envia e esvazia a fila", async () => {
    const t = setup();
    expect(await t.outbox.enqueue(item())).toEqual({ status: "enviado" });
    expect(t.uploadFoto).toHaveBeenCalledTimes(2);
    expect(t.enviar).toHaveBeenCalledTimes(1);
    expect(t.enviar.mock.calls[0][0]).toMatchObject({ client_id: "c1" });
    expect(await t.storage.getAll()).toEqual([]);
    expect(t.outbox.getSnapshot()).toEqual([]);
  });

  it("sem sinal: guarda no aparelho e envia quando a rede volta", async () => {
    const t = setup();
    t.state.online = false;
    expect(await t.outbox.enqueue(item())).toEqual({ status: "na_fila" });
    expect(t.uploadFoto).not.toHaveBeenCalled();
    expect(await t.storage.getAll()).toHaveLength(1);

    t.state.online = true;
    await t.outbox.process();
    expect(t.enviar).toHaveBeenCalledTimes(1);
    expect(await t.storage.getAll()).toEqual([]);
  });

  it("queda no meio: não sobe de novo a foto que já subiu", async () => {
    const t = setup();
    t.uploadFoto.mockImplementationOnce(async () => "p1/f1.jpg").mockImplementationOnce(async () => {
      throw offline;
    });
    expect(await t.outbox.enqueue(item())).toEqual({ status: "na_fila" });
    const [guardado] = await t.storage.getAll();
    expect(guardado.fotos.map((f) => f.path ?? null)).toEqual(["p1/f1.jpg", null]);

    // "Reabre o app": outra instância lê o mesmo armazenamento.
    const depois = createDiarioOutbox({ ...t.deps, uploadFoto: t.uploadFoto });
    await depois.process();
    expect(t.uploadFoto).toHaveBeenCalledTimes(3); // f1, f2 (falhou), f2
    expect(t.uploadFoto.mock.calls[2][1]).toMatchObject({ id: "f2" });
    expect(t.enviar).toHaveBeenCalledTimes(1);
  });

  it("recusa do servidor: marca como falha e não reenvia sozinho", async () => {
    const onFailed = vi.fn();
    const t = setup({ onFailed });
    t.enviar.mockRejectedValueOnce(new Error("Etapa impedida precisa de pendência"));
    expect(await t.outbox.enqueue(item())).toEqual({
      status: "recusado",
      message: "Etapa impedida precisa de pendência",
    });
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(t.outbox.getSnapshot()[0]).toMatchObject({ failed: true });

    await t.outbox.process();
    expect(t.enviar).toHaveBeenCalledTimes(1);

    expect(await t.outbox.retry("c1")).toEqual({ status: "enviado" });
    expect(t.outbox.getSnapshot()).toEqual([]);
  });

  it("celular compartilhado: só a conta que relatou envia", async () => {
    const t = setup();
    t.state.online = false;
    await t.outbox.enqueue(item());
    t.state.online = true;
    t.state.user = "u2";
    await t.outbox.process();
    expect(t.enviar).not.toHaveBeenCalled();
    t.state.user = "u1";
    await t.outbox.process();
    expect(t.enviar).toHaveBeenCalledTimes(1);
  });

  it("sessão não confirmada: espera", async () => {
    const t = setup();
    t.state.user = null;
    expect(await t.outbox.enqueue(item())).toEqual({ status: "na_fila" });
    expect(t.enviar).not.toHaveBeenCalled();
  });
});
