/**
 * Fila persistente de uploads de fotos/vídeos dos relatórios semanais.
 *
 * Os bytes do arquivo são gravados em IndexedDB assim que o usuário seleciona
 * a mídia. Assim, se a aba for descartada pelo sistema (comum no celular),
 * o app fechar ou o usuário navegar para outra tela, o envio é retomado do
 * ponto onde parou na próxima vez que o editor for aberto — sem depender do
 * `blob:` URL, que morre junto com a página.
 */

const DB_NAME = "bwild-uploads";
const DB_VERSION = 1;
const STORE = "pending-report-photos";

export interface PendingPhotoUpload {
  /** Id da foto na galeria (chave primária). */
  id: string;
  projectId: string;
  weekNumber: number;
  mimeType: string;
  fileName?: string;
  blob: Blob;
  attempts: number;
  lastError?: string;
  createdAt: number;
  /** Timestamp a partir do qual uma nova tentativa é permitida. */
  nextAttemptAt: number;
}

export type PendingPhotoUploadMeta = Omit<PendingPhotoUpload, "blob">;

/** Backoff das tentativas automáticas (ms). */
export const UPLOAD_RETRY_DELAYS_MS = [
  10_000, 30_000, 60_000, 120_000, 300_000,
];
export const MAX_AUTO_ATTEMPTS = UPLOAD_RETRY_DELAYS_MS.length;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("byProject", ["projectId", "weekNumber"]);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn("IndexedDB indisponível para a fila de uploads");
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function enqueuePhotoUpload(entry: {
  id: string;
  projectId: string;
  weekNumber: number;
  blob: Blob;
  mimeType?: string;
  fileName?: string;
}): Promise<void> {
  const record: PendingPhotoUpload = {
    id: entry.id,
    projectId: entry.projectId,
    weekNumber: entry.weekNumber,
    mimeType: entry.mimeType || entry.blob.type || "application/octet-stream",
    fileName: entry.fileName,
    blob: entry.blob,
    attempts: 0,
    createdAt: Date.now(),
    nextAttemptAt: Date.now(),
  };
  await withStore("readwrite", (store) => store.put(record));
}

export async function listPendingUploads(filter?: {
  projectId?: string;
  weekNumber?: number;
}): Promise<PendingPhotoUpload[]> {
  const all =
    (await withStore<PendingPhotoUpload[]>("readonly", (store) =>
      store.getAll(),
    )) ?? [];
  if (!filter?.projectId) return all;
  return all.filter(
    (r) =>
      r.projectId === filter.projectId &&
      (filter.weekNumber === undefined || r.weekNumber === filter.weekNumber),
  );
}

export async function removePendingUpload(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function markUploadFailure(
  id: string,
  message: string,
): Promise<void> {
  const record = await withStore<PendingPhotoUpload>("readonly", (store) =>
    store.get(id),
  );
  if (!record) return;
  const attempts = record.attempts + 1;
  const delay =
    UPLOAD_RETRY_DELAYS_MS[Math.min(attempts, UPLOAD_RETRY_DELAYS_MS.length) - 1];
  await withStore("readwrite", (store) =>
    store.put({
      ...record,
      attempts,
      lastError: message,
      nextAttemptAt: Date.now() + delay,
    } satisfies PendingPhotoUpload),
  );
}

/** Zera o backoff de todos os itens (usado no "Reenviar agora"). */
export async function resetPendingBackoff(ids: string[]): Promise<void> {
  for (const id of ids) {
    const record = await withStore<PendingPhotoUpload>("readonly", (store) =>
      store.get(id),
    );
    if (!record) continue;
    await withStore("readwrite", (store) =>
      store.put({ ...record, attempts: 0, nextAttemptAt: Date.now() }),
    );
  }
}
