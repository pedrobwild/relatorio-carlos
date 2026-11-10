/**
 * Caixa de entrada de fotos do relatório: guardar no aparelho, por usuário e
 * por obra, sem perder nem misturar. O armazenamento é injetado (memória); a
 * "recarga" é uma caixa nova sobre o MESMO armazenamento.
 */
import { describe, it, expect } from "vitest";
import { createMemoryStorage } from "@/lib/offline/idb";
import {
  createReportPhotoInbox,
  galleryIdFor,
  inboxIdFromGalleryId,
  ReportInboxFullError,
  type InboxPhoto,
} from "@/lib/offline/reportPhotoInbox";

const foto = (name = "obra.jpg") => new File(["bytes"], name, { type: "image/jpeg" });

function setup() {
  const storage = createMemoryStorage<InboxPhoto>();
  let n = 0;
  const open = () => createReportPhotoInbox({ storage, newId: () => `id${++n}`, now: () => 1000 + n });
  return { storage, open };
}

describe("reportPhotoInbox", () => {
  it("sobrevive a recarregar: a foto guardada continua lá numa caixa nova", async () => {
    const { open } = setup();
    await open().add("u1", "p1", [foto("a.jpg"), foto("b.jpg")]);

    const depoisDeRecarregar = open();
    const itens = await depoisDeRecarregar.list("u1", "p1");
    expect(itens.map((i) => i.name)).toEqual(["a.jpg", "b.jpg"]);
    expect(itens[0].blob).toBeInstanceOf(Blob);
    expect(await depoisDeRecarregar.countWaiting("u1", "p1")).toBe(2);
  });

  it("isola por usuário: outra conta no mesmo aparelho não vê nem conta as fotos", async () => {
    const { open } = setup();
    const inbox = open();
    await inbox.add("u1", "p1", [foto()]);

    expect(await inbox.list("u2", "p1")).toEqual([]);
    expect(await inbox.countWaiting("u2", "p1")).toBe(0);
    await inbox.add("u2", "p1", [foto("da-outra.jpg")]);
    expect((await inbox.list("u1", "p1")).map((i) => i.name)).toEqual(["obra.jpg"]);
    expect((await inbox.list("u2", "p1")).map((i) => i.name)).toEqual(["da-outra.jpg"]);
  });

  it("isola por obra", async () => {
    const { open } = setup();
    const inbox = open();
    await inbox.add("u1", "p1", [foto()]);
    expect(await inbox.list("u1", "p2")).toEqual([]);
    expect(await inbox.countWaiting("u1", "p2")).toBe(0);
  });

  it("entregue deixa de contar como esperando, mas só sai ao remover", async () => {
    const { open } = setup();
    const inbox = open();
    const [a] = await inbox.add("u1", "p1", [foto()]);
    await inbox.markDelivered([a.id]);
    expect(await inbox.countWaiting("u1", "p1")).toBe(0);
    expect(await open().list("u1", "p1")).toHaveLength(1);
    await inbox.remove([a.id]);
    expect(await open().list("u1", "p1")).toEqual([]);
  });

  it("o id na galeria é fixo por foto (base para não duplicar)", async () => {
    const { open } = setup();
    const [a] = await open().add("u1", "p1", [foto()]);
    expect(galleryIdFor(a.id)).toBe(galleryIdFor(a.id));
    expect(inboxIdFromGalleryId(galleryIdFor(a.id))).toBe(a.id);
    expect(inboxIdFromGalleryId("photo-123-0")).toBeNull();
  });

  it("avisa quem está ouvindo quando a caixa muda", async () => {
    const { open } = setup();
    const inbox = open();
    let chamadas = 0;
    const parar = inbox.subscribe(() => chamadas++);
    const [a] = await inbox.add("u1", "p1", [foto()]);
    await inbox.remove([a.id]);
    parar();
    await inbox.add("u1", "p1", [foto()]);
    expect(chamadas).toBe(2);
  });

  it("recusa acima do teto por usuário, sem guardar pela metade", async () => {
    const storage = createMemoryStorage<InboxPhoto>();
    const inbox = createReportPhotoInbox({ storage, limits: { maxItems: 2 } });
    await inbox.add("u1", "p1", [foto(), foto()]);
    await expect(inbox.add("u1", "p2", [foto()])).rejects.toBeInstanceOf(ReportInboxFullError);
    expect(await storage.getAll()).toHaveLength(2);
    // O teto é por usuário: outra conta ainda guarda.
    await expect(inbox.add("u2", "p1", [foto()])).resolves.toHaveLength(1);
  });
});
