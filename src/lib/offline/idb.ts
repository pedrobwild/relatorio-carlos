/**
 * IndexedDB do modo offline (API nativa, sem dependência nova).
 *
 * Um banco só (`bwild-offline`) com um store por fila:
 *  - `ops-photos`   — fotos tiradas sem sinal (photoQueue);
 *  - `ops-outcomes` — Feito / Não feito / desfazer ainda não enviados
 *    (outcomeOutbox).
 *
 * É separado do cache das consultas (localStorage) de propósito: aquele cache
 * pode ser descartado a qualquer momento (24 h, versão nova, cota cheia) e o
 * que a pessoa registrou na obra não pode ir junto.
 */

const DB_NAME = "bwild-offline";
/** v1: ops-photos. v2: + ops-outcomes. */
const DB_VERSION = 2;

export const IDB_STORES = {
  photos: "ops-photos",
  outcomes: "ops-outcomes",
} as const;

export type IdbStoreName = (typeof IDB_STORES)[keyof typeof IDB_STORES];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of Object.values(IDB_STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir o IndexedDB"));
  });
}

function tx<T>(store: IdbStoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
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

/** Armazenamento chave → registro (com `id`) usado pelas filas offline. */
export interface KeyedStorage<T extends { id: string }> {
  getAll(): Promise<T[]>;
  put(item: T): Promise<void>;
  delete(id: string): Promise<void>;
}

export function createIdbStorage<T extends { id: string }>(store: IdbStoreName): KeyedStorage<T> {
  return {
    getAll: () => tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
    put: (item) => tx(store, "readwrite", (s) => s.put(item)).then(() => undefined),
    delete: (id) => tx(store, "readwrite", (s) => s.delete(id)).then(() => undefined),
  };
}

export function createMemoryStorage<T extends { id: string }>(): KeyedStorage<T> {
  const map = new Map<string, T>();
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

/**
 * Tenta cada armazenamento na ordem; no primeiro erro de um, passa para o
 * seguinte e não volta mais (ex.: IndexedDB indisponível numa aba privada).
 */
export function createResilientStorage<T extends { id: string }>(
  chain: readonly KeyedStorage<T>[],
  label: string,
): KeyedStorage<T> {
  let index = 0;
  const attempt = async <R,>(fn: (s: KeyedStorage<T>) => Promise<R>): Promise<R> => {
    for (;;) {
      const current = chain[index];
      try {
        return await fn(current);
      } catch (err) {
        if (index >= chain.length - 1) throw err;
        console.warn(`[${label}] Armazenamento indisponível; usando o próximo.`, err);
        index += 1;
      }
    }
  };
  return {
    getAll: () => attempt((s) => s.getAll()),
    put: (item) => attempt((s) => s.put(item)),
    delete: (id) => attempt((s) => s.delete(id)),
  };
}
