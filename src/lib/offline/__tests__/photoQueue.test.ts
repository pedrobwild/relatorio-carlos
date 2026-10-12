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
});
