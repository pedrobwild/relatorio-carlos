/**
 * Entrega das fotos guardadas ao editor do relatório: entra ao abrir, não
 * duplica, só sai da caixa depois de salvo, e não cruza usuários.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createMemoryStorage } from "@/lib/offline/idb";
import { createReportPhotoInbox, galleryIdFor, type InboxPhoto, type ReportPhotoInbox } from "@/lib/offline/reportPhotoInbox";
import { useReportPhotoInbox, useReportPhotoInboxDelivery, type InboxDeliveryTarget } from "@/hooks/useReportPhotoInbox";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";

const h = vi.hoisted(() => ({ userId: "u1" as string | undefined, toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: h.userId ? { id: h.userId } : null }) }));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));

const foto = (name = "obra.jpg") => new File(["bytes"], name, { type: "image/jpeg" });

/** Editor de mentira: guarda a galeria e dedupe por id, como o de verdade. */
function fakeEditor(initial: Array<{ id: string; url: string }> = []) {
  const gallery = [...initial];
  const addInboxPhotos = vi.fn(async (photos: Array<{ galleryId: string }>) => {
    const persisted: string[] = [];
    for (const p of photos) {
      const current = gallery.find((g) => g.id === p.galleryId);
      if (current) {
        if (!current.url.startsWith("blob:")) persisted.push(p.galleryId);
        continue;
      }
      gallery.push({ id: p.galleryId, url: "blob:local" });
    }
    return { persisted, rejected: [] as string[] };
  });
  return { gallery, addInboxPhotos };
}

describe("useReportPhotoInboxDelivery", () => {
  let storage: ReturnType<typeof createMemoryStorage<InboxPhoto>>;
  let inbox: ReportPhotoInbox;
  const novaCaixa = () => createReportPhotoInbox({ storage });

  beforeEach(() => {
    h.userId = "u1";
    h.toastSuccess.mockReset();
    h.toastError.mockReset();
    storage = createMemoryStorage<InboxPhoto>();
    inbox = novaCaixa();
  });

  const abrirRelatorio = (editor: ReturnType<typeof fakeEditor>, status: AutoSaveStatus = "idle", caixa = inbox) =>
    renderHook(
      ({ s }: { s: AutoSaveStatus }) =>
        useReportPhotoInboxDelivery(
          { gallery: [...editor.gallery], autoSaveStatus: s, addInboxPhotos: editor.addInboxPhotos } as InboxDeliveryTarget,
          "p1",
          true,
          caixa,
        ),
      { initialProps: { s: status } },
    );

  it("ao abrir o relatório, as fotos guardadas entram na galeria", async () => {
    const [a, b] = await inbox.add("u1", "p1", [foto("a.jpg"), foto("b.jpg")]);
    const editor = fakeEditor();
    abrirRelatorio(editor);

    await waitFor(() => expect(editor.gallery).toHaveLength(2));
    expect(editor.gallery.map((g) => g.id)).toEqual([galleryIdFor(a.id), galleryIdFor(b.id)]);
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("2 fotos guardadas entraram no relatório"));
    // Entregues, mas ainda na caixa até o relatório ser salvo.
    expect(await inbox.countWaiting("u1", "p1")).toBe(0);
    expect(await inbox.list("u1", "p1")).toHaveLength(2);
  });

  it("entra mesmo depois de recarregar a página (caixa nova, mesmo aparelho)", async () => {
    await inbox.add("u1", "p1", [foto()]);
    const editor = fakeEditor();
    abrirRelatorio(editor, "idle", novaCaixa());
    await waitFor(() => expect(editor.gallery).toHaveLength(1));
  });

  it("não duplica: reabrir antes de salvar entrega de novo com o mesmo id", async () => {
    await inbox.add("u1", "p1", [foto()]);
    const editor = fakeEditor();
    const primeira = abrirRelatorio(editor);
    await waitFor(() => expect(editor.gallery).toHaveLength(1));
    primeira.unmount();

    // A aba morreu antes de salvar; o rascunho local ainda tem a foto.
    abrirRelatorio(editor, "idle", novaCaixa());
    await waitFor(() => expect(editor.addInboxPhotos).toHaveBeenCalledTimes(2));
    expect(editor.gallery).toHaveLength(1);
    // Segunda entrega não avisa "entrou" de novo.
    expect(h.toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("não duplica: foto já salva no relatório sai da caixa sem entrar outra vez", async () => {
    const [a] = await inbox.add("u1", "p1", [foto()]);
    const editor = fakeEditor([{ id: galleryIdFor(a.id), url: "https://storage/foto.jpg" }]);
    abrirRelatorio(editor);

    await waitFor(async () => expect(await inbox.list("u1", "p1")).toEqual([]));
    expect(editor.gallery).toHaveLength(1);
  });

  it("só sai da caixa depois de um salvamento que inclui a foto", async () => {
    await inbox.add("u1", "p1", [foto()]);
    const editor = fakeEditor();
    // O editor já estava "salvo" de antes: isso não pode limpar a caixa.
    const view = abrirRelatorio(editor, "saved");
    await waitFor(() => expect(editor.gallery).toHaveLength(1));
    view.rerender({ s: "saved" });
    expect(await inbox.list("u1", "p1")).toHaveLength(1);

    view.rerender({ s: "pending" });
    view.rerender({ s: "saving" });
    expect(await inbox.list("u1", "p1")).toHaveLength(1);
    view.rerender({ s: "saved" });
    await waitFor(async () => expect(await inbox.list("u1", "p1")).toEqual([]));
  });

  it("isolamento por usuário: outra conta abre o relatório e não recebe as fotos", async () => {
    await inbox.add("u1", "p1", [foto()]);
    h.userId = "u2";
    const editor = fakeEditor();
    abrirRelatorio(editor);

    await act(async () => {
      await Promise.resolve();
    });
    expect(editor.addInboxPhotos).not.toHaveBeenCalled();
    expect(editor.gallery).toEqual([]);
    // E continuam guardadas para quem tirou.
    expect(await inbox.list("u1", "p1")).toHaveLength(1);
  });

  it("desligado (editor de outra semana): não entrega nada", async () => {
    await inbox.add("u1", "p1", [foto()]);
    const editor = fakeEditor();
    renderHook(() =>
      useReportPhotoInboxDelivery(
        { gallery: [], autoSaveStatus: "idle", addInboxPhotos: editor.addInboxPhotos } as InboxDeliveryTarget,
        "p1",
        false,
        inbox,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(editor.addInboxPhotos).not.toHaveBeenCalled();
  });
});

describe("useReportPhotoInbox", () => {
  beforeEach(() => {
    h.userId = "u1";
    h.toastSuccess.mockReset();
    h.toastError.mockReset();
  });

  it("guarda, avisa a pessoa e mostra quantas esperam", async () => {
    const inbox = createReportPhotoInbox({ storage: createMemoryStorage<InboxPhoto>() });
    const { result } = renderHook(() => useReportPhotoInbox("p1", inbox));
    expect(result.current.waiting).toBe(0);

    let ok = false;
    await act(async () => {
      ok = await result.current.keep("p1", [foto(), foto()]);
    });
    expect(ok).toBe(true);
    expect(h.toastSuccess).toHaveBeenCalledWith("2 fotos guardadas no aparelho");
    await waitFor(() => expect(result.current.waiting).toBe(2));
  });

  it("a contagem é só do usuário logado", async () => {
    const inbox = createReportPhotoInbox({ storage: createMemoryStorage<InboxPhoto>() });
    await inbox.add("u1", "p1", [foto()]);
    h.userId = "u2";
    const { result } = renderHook(() => useReportPhotoInbox("p1", inbox));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.waiting).toBe(0);
  });

  it("caixa cheia: avisa e não navega", async () => {
    const inbox = createReportPhotoInbox({ storage: createMemoryStorage<InboxPhoto>(), limits: { maxItems: 1 } });
    const { result } = renderHook(() => useReportPhotoInbox("p1", inbox));
    let ok = true;
    await act(async () => {
      ok = await result.current.keep("p1", [foto(), foto()]);
    });
    expect(ok).toBe(false);
    expect(h.toastError).toHaveBeenCalledWith(
      "Muitas fotos guardadas no aparelho. Abra o relatório da semana para enviá-las.",
    );
  });
});
