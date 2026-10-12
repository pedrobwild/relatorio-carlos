/**
 * Fotos tiradas sem sinal: guardadas no aparelho, enviadas quando houver
 * conexão pelo caminho de sempre (upload + vínculo), sem perder nem duplicar.
 * O armazenamento é injetado (memória) — a lógica é a mesma do IndexedDB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMemoryPhotoStorage,
  createPhotoQueue,
  PhotoQueueFullError,
  type PhotoQueueDeps,
  type PhotoQueueStorage,
} from "@/lib/offline/photoQueue";

const netError = Object.assign(new Error("Failed to fetch"), { kind: "net" });
const isConnectionError = (e: unknown) => e === netError;

function setup(over: Partial<PhotoQueueDeps> = {}) {
  let online = true;
  let n = 0;
  const storage: PhotoQueueStorage = createMemoryPhotoStorage();
  const upload = vi.fn(async (item: { id: string }) => `p1/a1/${item.id}.jpg`);
  const link = vi.fn(async () => undefined);
  const onFailed = vi.fn();
  const q = createPhotoQueue({
    storage,
    upload,
    link,
    isOnline: () => online,
    currentUser: async () => "u1",
    isConnectionError,
    describeError: (e) => (e instanceof Error ? e.message : "erro"),
    onFailed,
    newId: () => `id${++n}`,
    now: () => 1000 + n,
    ...over,
  });
  return { q, storage, upload, link, onFailed, setOnline: (v: boolean) => (online = v) };
}

const photo = (size = 100, name = "f.jpg") => Object.assign(new Blob(["x".repeat(size)], { type: "image/jpeg" }), { name });
const target = { userId: "u1", assignmentId: "a1", projectId: "p1" };

describe("fila de fotos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem sinal: guarda no aparelho e não tenta enviar", async () => {
    const s = setup();
    s.setOnline(false);
    await s.q.enqueue(target, [photo()]);
    await s.q.process();
    expect(s.upload).not.toHaveBeenCalled();
    expect(await s.storage.getAll()).toHaveLength(1);
    expect(s.q.getSnapshot()[0]).toMatchObject({ assignmentId: "a1", failed: false });
  });

  it("com sinal: sobe, vincula na alocação e sai da fila", async () => {
    const s = setup();
    s.setOnline(false);
    await s.q.enqueue(target, [photo(), photo()]);
    s.setOnline(true);
    await s.q.process();
    expect(s.upload).toHaveBeenCalledTimes(2);
    expect(s.link).toHaveBeenNthCalledWith(1, "a1", ["p1/a1/id1.jpg"]);
    expect(s.link).toHaveBeenNthCalledWith(2, "a1", ["p1/a1/id2.jpg"]);
    expect(await s.storage.getAll()).toHaveLength(0);
    expect(s.q.getSnapshot()).toHaveLength(0);
  });

  it("app reaberto: lê o que ficou guardado", async () => {
    const s = setup();
    s.setOnline(false);
    await s.q.enqueue(target, [photo()]);
    const reopened = setup({ storage: s.storage });
    await reopened.q.load();
    expect(reopened.q.getSnapshot()).toHaveLength(1);
    await reopened.q.process();
    expect(reopened.link).toHaveBeenCalledTimes(1);
  });

  it("sinal cai no meio: para, mantém na fila e não marca como falha", async () => {
    const s = setup();
    s.upload.mockRejectedValueOnce(netError);
    s.setOnline(false);
    await s.q.enqueue(target, [photo(), photo()]);
    s.setOnline(true);
    await s.q.process();
    expect(s.upload).toHaveBeenCalledTimes(1);
    expect(s.q.getSnapshot()).toHaveLength(2);
    expect(s.q.getSnapshot().every((i) => !i.failed)).toBe(true);
    expect(s.onFailed).not.toHaveBeenCalled();
  });

  it("subiu mas não vinculou: na retomada só vincula (não sobe de novo)", async () => {
    const s = setup();
    s.link.mockRejectedValueOnce(netError);
    s.setOnline(false);
    await s.q.enqueue(target, [photo()]);
    s.setOnline(true);
    await s.q.process();
    expect(s.q.getSnapshot()[0].uploadedPath).toBe("p1/a1/id1.jpg");
    await s.q.process();
    expect(s.upload).toHaveBeenCalledTimes(1);
    expect(s.link).toHaveBeenLastCalledWith("a1", ["p1/a1/id1.jpg"]);
    expect(s.q.getSnapshot()).toHaveLength(0);
  });

  it("recusa do servidor: fica visível como falha, não repete sozinha; 'tentar de novo' reenvia", async () => {
    const s = setup();
    s.upload.mockRejectedValueOnce(new Error("Você não tem permissão"));
    s.setOnline(false);
    await s.q.enqueue(target, [photo()]);
    s.setOnline(true);
    await s.q.process();
    expect(s.q.getSnapshot()[0]).toMatchObject({ failed: true, error: "Você não tem permissão" });
    expect(s.onFailed).toHaveBeenCalledTimes(1);
    await s.q.process();
    expect(s.upload).toHaveBeenCalledTimes(1);
    await s.q.retry("id1");
    expect(s.upload).toHaveBeenCalledTimes(2);
    expect(s.q.getSnapshot()).toHaveLength(0);
  });

  it("descartar remove do aparelho", async () => {
    const s = setup();
    s.setOnline(false);
    await s.q.enqueue(target, [photo()]);
    await s.q.discard("id1");
    expect(await s.storage.getAll()).toHaveLength(0);
  });

  it("foto de outra conta neste aparelho não é enviada com a sessão atual", async () => {
    const s = setup({ currentUser: async () => "u2" });
    s.setOnline(false);
    await s.q.enqueue(target, [photo()]);
    s.setOnline(true);
    await s.q.process();
    expect(s.upload).not.toHaveBeenCalled();
    expect(s.q.getSnapshot()).toHaveLength(1);
  });

  it("sessão não confirmada (sem rede para renovar): espera", async () => {
    const s = setup({ currentUser: async () => null });
    await s.q.enqueue(target, [photo()]);
    await s.q.process();
    expect(s.upload).not.toHaveBeenCalled();
  });

  it("tetos: foto grande demais e fila cheia", async () => {
    const limits = { maxItems: 2, maxItemBytes: 500, maxTotalBytes: 1000 };
    const s = setup({ limits });
    s.setOnline(false);
    await expect(s.q.enqueue(target, [photo(600)])).rejects.toBeInstanceOf(PhotoQueueFullError);
    await s.q.enqueue(target, [photo(), photo()]);
    await expect(s.q.enqueue(target, [photo()])).rejects.toThrow(/Muitas fotos/);
  });

  it("resposta do upload perdida: a nova tentativa usa o mesmo item (mesmo caminho no bucket)", async () => {
    const s = setup();
    // O arquivo chegou ao bucket, mas a resposta se perdeu no caminho.
    s.upload.mockRejectedValueOnce(netError);
    s.setOnline(false);
    await s.q.enqueue(target, [photo()]);
    s.setOnline(true);
    await s.q.process();
    expect(s.q.getSnapshot()[0]).toMatchObject({ id: "id1", failed: false, uploadedPath: null });
    await s.q.process();
    expect(s.upload).toHaveBeenCalledTimes(2);
    // Mesmo id nas duas tentativas → o caminho (derivado do id) é o mesmo.
    expect(s.upload.mock.calls.map((c) => c[0].id)).toEqual(["id1", "id1"]);
    expect(s.link).toHaveBeenCalledWith("a1", ["p1/a1/id1.jpg"]);
  });

  it("fotos de OUTRAS contas são apagadas do aparelho depois de 7 dias", async () => {
    const day = 86_400_000;
    let clock = Date.parse("2026-10-01T10:00:00Z");
    const s = setup({ now: () => clock, currentUser: async () => "u1" });
    s.setOnline(false);
    await s.q.enqueue({ ...target, userId: "u2" }, [photo()]); // id1, de outra conta
    clock += 6 * day;
    await s.q.enqueue({ ...target, userId: "u2" }, [photo()]); // id2, de outra conta
    await s.q.enqueue(target, [photo()]); // id3, minha
    clock += 2 * day; // id1 com 8 dias, id2 com 2

    expect(await s.q.purgeOtherUsers("u1", 7 * day)).toBe(1);
    expect((await s.storage.getAll()).map((i) => i.id).sort()).toEqual(["id2", "id3"]);
    expect(s.q.getSnapshot().map((i) => i.id)).toEqual(["id2", "id3"]);
    // As minhas nunca entram na limpeza, por mais antigas que sejam.
    clock += 30 * day;
    expect(await s.q.purgeOtherUsers("u1", 7 * day)).toBe(1);
    expect(s.q.getSnapshot().map((i) => i.id)).toEqual(["id3"]);
  });

  it("Sair mesmo assim: apaga as fotos desta conta, inclusive as recusadas", async () => {
    const s = setup();
    s.setOnline(false);
    await s.q.enqueue(target, [photo(), photo()]);
    await s.q.enqueue({ ...target, userId: "u2" }, [photo()]);
    expect(await s.q.discardUser("u1")).toBe(2);
    expect((await s.storage.getAll()).map((i) => i.userId)).toEqual(["u2"]);
    expect(s.q.getSnapshot()).toHaveLength(1);
  });
});
