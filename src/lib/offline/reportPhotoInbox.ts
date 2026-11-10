/**
 * Caixa de entrada de fotos do relatório da semana.
 *
 * A foto tirada no hub da obra ou na gaveta Registrar é guardada aqui, no
 * aparelho (IndexedDB, o mesmo banco das filas offline), até entrar no
 * relatório da semana. Sobrevive a recarregar a página e a fechar a aba.
 *
 * - Por usuário e por obra: num celular compartilhado, só a conta que tirou a
 *   foto a vê e a entrega (como na fila de fotos do Hoje).
 * - Entrega sem perder nem duplicar: a foto entra na galeria com um id
 *   derivado do id daqui (`galleryIdFor`), é marcada como entregue e só sai
 *   da caixa quando o relatório foi salvo com ela (ou quando a pessoa a
 *   remove da galeria). Se a aba morrer no meio, a próxima abertura entrega
 *   de novo, e o id igual impede a cópia.
 *
 * A lógica não conhece o IndexedDB: recebe um armazenamento injetável (nos
 * testes, um Map em memória compartilhado entre "recargas").
 */
import { createIdbStorage, createMemoryStorage, createResilientStorage, IDB_STORES, type KeyedStorage } from "./idb";

export interface InboxPhoto {
  id: string;
  /** Quem tirou: só esta conta vê e entrega. */
  userId: string;
  projectId: string;
  blob: Blob;
  name: string;
  type: string;
  createdAt: number;
  /** Já entrou na galeria do editor; falta o relatório ser salvo com ela. */
  deliveredAt?: number | null;
}

export const REPORT_INBOX_LIMITS = {
  /** Fotos guardadas por usuário, para não lotar o aparelho. */
  maxItems: 60,
};

export class ReportInboxFullError extends Error {
  constructor() {
    super("Muitas fotos guardadas no aparelho. Abra o relatório da semana para enviá-las.");
    this.name = "ReportInboxFullError";
  }
}

const GALLERY_PREFIX = "photo-inbox-";

/** Id da foto na galeria do relatório: sempre o mesmo para a mesma foto. */
export const galleryIdFor = (inboxId: string) => `${GALLERY_PREFIX}${inboxId}`;

/** Id da caixa a partir do id da galeria; null se a foto não veio da caixa. */
export const inboxIdFromGalleryId = (galleryId: string): string | null =>
  galleryId.startsWith(GALLERY_PREFIX) ? galleryId.slice(GALLERY_PREFIX.length) : null;

export interface ReportPhotoInboxDeps {
  storage: KeyedStorage<InboxPhoto>;
  newId?: () => string;
  now?: () => number;
  limits?: typeof REPORT_INBOX_LIMITS;
}

export function createReportPhotoInbox(deps: ReportPhotoInboxDeps) {
  const { storage } = deps;
  const newId =
    deps.newId ??
    (() =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const now = deps.now ?? (() => Date.now());
  const limits = deps.limits ?? REPORT_INBOX_LIMITS;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const mine = async (userId: string, projectId?: string) =>
    (await storage.getAll())
      .filter((p) => p.userId === userId && (!projectId || p.projectId === projectId))
      .sort((a, b) => a.createdAt - b.createdAt);

  return {
    /** Guarda as fotos. Lança `ReportInboxFullError` se passar do teto. */
    async add(userId: string, projectId: string, files: readonly File[]): Promise<InboxPhoto[]> {
      if (files.length === 0) return [];
      const current = await mine(userId);
      if (current.length + files.length > limits.maxItems) throw new ReportInboxFullError();
      const added: InboxPhoto[] = [];
      for (const file of files) {
        const item: InboxPhoto = {
          id: newId(),
          userId,
          projectId,
          blob: file,
          name: file.name || "foto.jpg",
          type: file.type || "image/jpeg",
          createdAt: now(),
          deliveredAt: null,
        };
        await storage.put(item);
        added.push(item);
      }
      emit();
      return added;
    },

    /** Tudo o que este usuário guardou para a obra (entregue ou não). */
    list: (userId: string, projectId: string) => mine(userId, projectId),

    /** Quantas ainda esperam entrar no relatório. */
    async countWaiting(userId: string, projectId: string): Promise<number> {
      return (await mine(userId, projectId)).filter((p) => !p.deliveredAt).length;
    },

    /** A foto entrou na galeria do editor (ainda não necessariamente salva). */
    async markDelivered(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return;
      const wanted = new Set(ids);
      for (const item of await storage.getAll()) {
        if (wanted.has(item.id) && !item.deliveredAt) await storage.put({ ...item, deliveredAt: now() });
      }
      emit();
    },

    /** O relatório foi salvo com a foto, ou a pessoa a removeu: sai da caixa. */
    async remove(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return;
      for (const id of ids) await storage.delete(id);
      emit();
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ReportPhotoInbox = ReturnType<typeof createReportPhotoInbox>;

/** A caixa do app: IndexedDB; sem ele (aba privada antiga), só em memória. */
export const reportPhotoInbox: ReportPhotoInbox = createReportPhotoInbox({
  storage: createResilientStorage<InboxPhoto>(
    [createIdbStorage<InboxPhoto>(IDB_STORES.reportInbox), createMemoryStorage<InboxPhoto>()],
    "report-photo-inbox",
  ),
});
