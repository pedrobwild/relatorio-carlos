/**
 * Hooks da caixa de entrada de fotos do relatório da semana
 * (`@/lib/offline/reportPhotoInbox`).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  galleryIdFor,
  inboxIdFromGalleryId,
  reportPhotoInbox,
  ReportInboxFullError,
  type InboxPhoto,
  type ReportPhotoInbox,
} from "@/lib/offline/reportPhotoInbox";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";
import { equipeMobileLabels } from "@/content/equipeMobileLabels";

const L = equipeMobileLabels.fotosGuardadas;

/**
 * Guardar fotos e saber quantas esperam para a obra. `waiting` é do usuário
 * logado: outra conta no mesmo aparelho não vê nem conta estas fotos.
 */
export function useReportPhotoInbox(projectId: string | undefined, inbox: ReportPhotoInbox = reportPhotoInbox) {
  const { user } = useAuth();
  const userId = user?.id;
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!userId || !projectId) {
        setWaiting(0);
        return;
      }
      inbox
        .countWaiting(userId, projectId)
        .then((n) => alive && setWaiting(n))
        .catch(() => alive && setWaiting(0));
    };
    refresh();
    const unsubscribe = inbox.subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [inbox, userId, projectId]);

  /** Guarda no aparelho e avisa. Devolve false se não deu para guardar. */
  const keep = useCallback(
    async (targetProjectId: string, files: readonly File[]): Promise<boolean> => {
      if (!userId || files.length === 0) return false;
      try {
        await inbox.add(userId, targetProjectId, files);
        toast.success(L.guardada(files.length));
        return true;
      } catch (err) {
        toast.error(err instanceof ReportInboxFullError ? L.cheia : L.erro);
        return false;
      }
    },
    [inbox, userId],
  );

  return { waiting, keep };
}

/** O que o hook de entrega precisa do editor do relatório. */
export interface InboxDeliveryTarget {
  gallery: ReadonlyArray<{ id: string }>;
  autoSaveStatus: AutoSaveStatus | undefined;
  addInboxPhotos: (
    photos: Array<{ galleryId: string; blob: Blob; name: string; type: string }>,
  ) => Promise<{ persisted: string[]; rejected: string[] }>;
}

/**
 * Entrega ao editor aberto as fotos guardadas para a obra e as tira da caixa
 * quando o relatório foi salvo com elas.
 */
export function useReportPhotoInboxDelivery(
  target: InboxDeliveryTarget,
  projectId: string | undefined,
  enabled: boolean,
  inbox: ReportPhotoInbox = reportPhotoInbox,
) {
  const { user } = useAuth();
  const userId = user?.id;
  const { addInboxPhotos } = target;
  const addRef = useRef(addInboxPhotos);
  addRef.current = addInboxPhotos;
  /** Fotos da caixa que estão no editor, esperando o relatório ser salvo. */
  const inEditor = useRef(new Set<string>());
  /** Dessas, as que já viram o editor "sujo" (um salvamento depois as cobre). */
  const awaitingSave = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !userId || !projectId) return;
    let alive = true;
    const deliver = async () => {
      let items: InboxPhoto[];
      try {
        items = await inbox.list(userId, projectId);
      } catch {
        return;
      }
      if (!alive) return;
      const fresh = items.filter((p) => !inEditor.current.has(p.id));
      if (fresh.length === 0) return;
      fresh.forEach((p) => inEditor.current.add(p.id));
      const result = await addRef.current(
        fresh.map((p) => ({ galleryId: galleryIdFor(p.id), blob: p.blob, name: p.name, type: p.type })),
      );
      // Já salvas num relatório anterior (a caixa não chegou a ser limpa) ou
      // em formato que o relatório não aceita: saem da caixa agora.
      const done = [...result.persisted, ...result.rejected]
        .map((galleryId) => inboxIdFromGalleryId(galleryId))
        .filter((id): id is string => !!id);
      done.forEach((id) => inEditor.current.delete(id));
      await inbox.remove(done).catch(() => undefined);
      const doneSet = new Set(done);
      const novas = fresh.filter((p) => !p.deliveredAt && !doneSet.has(p.id));
      await inbox.markDelivered(novas.map((p) => p.id)).catch(() => undefined);
      if (alive && novas.length > 0) toast.success(L.entraram(novas.length));
    };
    void deliver();
    // Foto guardada com o relatório já aberto também entra.
    const unsubscribe = inbox.subscribe(() => void deliver());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [enabled, userId, projectId, inbox]);

  // A foto só sai da caixa depois de um salvamento que a inclui: primeiro o
  // editor fica "sujo" com ela na galeria, depois chega em "salvo".
  const { gallery, autoSaveStatus } = target;
  useEffect(() => {
    if (!enabled || !autoSaveStatus) return;
    const naGaleria = gallery
      .map((p) => inboxIdFromGalleryId(p.id))
      .filter((id): id is string => !!id && inEditor.current.has(id));
    if (autoSaveStatus !== "saved") {
      // Só "pending" conta: é o estado que antecede um salvamento com o que
      // está na tela agora (um salvamento já em curso pode não ter a foto).
      if (autoSaveStatus === "pending") naGaleria.forEach((id) => awaitingSave.current.add(id));
      return;
    }
    const saved = naGaleria.filter((id) => awaitingSave.current.has(id));
    if (saved.length === 0) return;
    saved.forEach((id) => {
      inEditor.current.delete(id);
      awaitingSave.current.delete(id);
    });
    void inbox.remove(saved).catch(() => undefined);
  }, [enabled, autoSaveStatus, gallery, inbox]);
}
