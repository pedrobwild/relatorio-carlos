/**
 * Fila de fotos tiradas sem sinal.
 *
 * A foto fica guardada no aparelho (IndexedDB) e é enviada quando houver
 * conexão, pelo mesmo caminho do envio online (upload no bucket + caminho
 * acrescentado em `photo_paths`). A lógica da fila não conhece o IndexedDB:
 * recebe um armazenamento injetável — nos testes, um Map em memória.
 *
 * Envio em duas etapas, cada uma gravada: (1) upload → guarda o caminho no
 * item; (2) vincula na alocação → apaga o item. Se o app for fechado entre as
 * duas, a retomada só vincula — não sobe a foto de novo.
 */

export interface QueuedPhoto {
  id: string;
  /** Quem tirou: só a mesma conta envia (celular compartilhado na obra). */
  userId: string;
  assignmentId: string;
  projectId: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  /** Preenchido depois do upload; falta só vincular. */
  uploadedPath?: string | null;
  /** Recusado pelo servidor (não é falta de sinal): espera a pessoa decidir. */
  failed?: boolean;
  error?: string | null;
}

export interface PhotoQueueStorage {
  getAll(): Promise<QueuedPhoto[]>;
  put(item: QueuedPhoto): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Tetos para não lotar o aparelho. As fotos já chegam comprimidas (~0,6 MB). */
export const PHOTO_QUEUE_LIMITS = {
  maxItems: 60,
  maxItemBytes: 10 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
};

export class PhotoQueueFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoQueueFullError";
  }
}

export interface PhotoQueueDeps {
  storage: PhotoQueueStorage;
  /** Sobe o arquivo e devolve o caminho no bucket. */
  upload: (item: QueuedPhoto) => Promise<string>;
  /** Acrescenta os caminhos na alocação. */
  link: (assignmentId: string, paths: string[]) => Promise<void>;
  /** Há rede agora? */
  isOnline: () => boolean;
  /**
   * Antes de enviar: a sessão está boa? Devolve o id do usuário logado, ou
   * `null` para esperar (sem rede para confirmar, ou ninguém logado).
   */
  currentUser: () => Promise<string | null>;
  /** Falta de sinal (espera) x recusa do servidor (vira falha visível). */
  isConnectionError: (err: unknown) => boolean;
  describeError: (err: unknown) => string;
  onLinked?: (item: QueuedPhoto) => void;
  onFailed?: (item: QueuedPhoto, err: unknown) => void;
  limits?: typeof PHOTO_QUEUE_LIMITS;
  newId?: () => string;
  now?: () => number;
}

export interface PhotoQueue {
  subscribe(listener: () => void): () => void;
  /** Itens na fila (inclui os recusados). Mesma referência até mudar. */
  getSnapshot(): readonly QueuedPhoto[];
  /** Está enviando agora? */
  isProcessing(): boolean;
  /** Lê o que ficou guardado (abertura do app). */
  load(): Promise<void>;
  enqueue(
    target: { userId: string; assignmentId: string; projectId: string },
    files: readonly (Blob & { name?: string })[],
  ): Promise<QueuedPhoto[]>;
  /** Envia o que der; para no primeiro sinal de falta de rede. */
  process(): Promise<void>;
  retry(id: string): Promise<void>;
  discard(id: string): Promise<void>;
}

function defaultId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPhotoQueue(deps: PhotoQueueDeps): PhotoQueue {
  const limits = deps.limits ?? PHOTO_QUEUE_LIMITS;
  const newId = deps.newId ?? defaultId;
  const now = deps.now ?? Date.now;

  let items: QueuedPhoto[] = [];
  let processing = false;
  let running: Promise<void> | null = null;
  let again = false;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  const setItems = (next: QueuedPhoto[]) => {
    items = [...next].sort((a, b) => a.createdAt - b.createdAt);
    emit();
  };
  const upsert = async (item: QueuedPhoto) => {
    await deps.storage.put(item);
    setItems([...items.filter((i) => i.id !== item.id), item]);
  };
  const remove = async (id: string) => {
    await deps.storage.delete(id);
    setItems(items.filter((i) => i.id !== id));
  };

  async function runOnce(): Promise<void> {
    if (!deps.isOnline()) return;
    const queued = items.filter((i) => !i.failed);
    if (queued.length === 0) return;

    const userId = await deps.currentUser();
    if (!userId) return;

    for (const original of queued) {
      if (original.userId !== userId) continue;
      if (!deps.isOnline()) return;
      let item = original;
      try {
        let path = item.uploadedPath ?? null;
        if (!path) {
          path = await deps.upload(item);
          item = { ...item, uploadedPath: path };
          await upsert(item);
        }
        await deps.link(item.assignmentId, [path]);
        await remove(item.id);
        deps.onLinked?.(item);
      } catch (err) {
        // Sem sinal no meio do caminho: para e espera a próxima conexão.
        if (deps.isConnectionError(err)) return;
        await upsert({ ...item, failed: true, error: deps.describeError(err) });
        deps.onFailed?.(item, err);
      }
    }
  }

  const queue: PhotoQueue = {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => items,
    isProcessing: () => processing,

    async load() {
      setItems(await deps.storage.getAll());
    },

    async enqueue(target, files) {
      const totalNow = items.reduce((s, i) => s + i.size, 0);
      const incoming = files.reduce((s, f) => s + f.size, 0);
      if (files.some((f) => f.size > limits.maxItemBytes)) {
        throw new PhotoQueueFullError("Foto grande demais para guardar no aparelho.");
      }
      if (items.length + files.length > limits.maxItems || totalNow + incoming > limits.maxTotalBytes) {
        throw new PhotoQueueFullError(
          "Muitas fotos aguardando envio neste aparelho. Conecte-se para enviar as que já estão guardadas.",
        );
      }
      const created: QueuedPhoto[] = [];
      for (const f of files) {
        const item: QueuedPhoto = {
          id: newId(),
          userId: target.userId,
          assignmentId: target.assignmentId,
          projectId: target.projectId,
          blob: f,
          name: f.name || "foto.jpg",
          type: f.type || "image/jpeg",
          size: f.size,
          createdAt: now() + created.length,
          uploadedPath: null,
          failed: false,
          error: null,
        };
        await deps.storage.put(item);
        created.push(item);
      }
      setItems([...items, ...created]);
      void queue.process();
      return created;
    },

    process() {
      if (running) {
        again = true;
        return running;
      }
      processing = true;
      emit();
      running = (async () => {
        try {
          do {
            again = false;
            await runOnce();
          } while (again);
        } finally {
          processing = false;
          running = null;
          emit();
        }
      })();
      return running;
    },

    async retry(id) {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      await upsert({ ...item, failed: false, error: null });
      await queue.process();
    },

    async discard(id) {
      await remove(id);
    },
  };

  return queue;
}

// ---------------------------------------------------------------------------
// IndexedDB (API nativa, sem dependência nova)
// ---------------------------------------------------------------------------

const DB_NAME = "bwild-offline";
const DB_VERSION = 1;
const STORE = "ops-photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir o IndexedDB"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        t.onerror = () => {
          db.close();
          reject(t.error ?? req.error ?? new Error("Falha no IndexedDB"));
        };
        t.onabort = () => {
          db.close();
          reject(t.error ?? new Error("Transação abortada no IndexedDB"));
        };
      }),
  );
}

export function createIndexedDbPhotoStorage(): PhotoQueueStorage {
  return {
    getAll: () => tx<QueuedPhoto[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedPhoto[]>),
    put: (item) => tx("readwrite", (s) => s.put(item)).then(() => undefined),
    delete: (id) => tx("readwrite", (s) => s.delete(id)).then(() => undefined),
  };
}

/** Sem IndexedDB (aba privada antiga, teste): guarda só em memória. */
export function createMemoryPhotoStorage(): PhotoQueueStorage {
  const map = new Map<string, QueuedPhoto>();
  return {
    getAll: async () => [...map.values()],
    put: async (item) => {
      map.set(item.id, item);
    },
    delete: async (id) => {
      map.delete(id);
    },
  };
}
