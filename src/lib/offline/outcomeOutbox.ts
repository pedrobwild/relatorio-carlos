/**
 * Caixa de saída dos Feito / Não feito / desfazer ainda não enviados.
 *
 * POR QUE NÃO FICA NO CACHE DAS CONSULTAS
 * ---------------------------------------
 * O cache persistido do TanStack (localStorage) é descartável: some depois
 * de 24 h com o app fechado, quando um deploy muda `QUERY_CACHE_VERSION`,
 * quando passa do tamanho máximo ou quando a cota estoura. Um registro feito
 * na obra não pode sumir junto. Por isso a fila tem o SEU armazenamento
 * (IndexedDB, com localStorage/memória de reserva), sem validade, sem versão
 * e separado por usuário.
 *
 * A caixa só guarda; quem envia é a mutação do TanStack (ver
 * opsOutcomeSync.ts), que lê daqui ao abrir o app e apaga daqui quando o
 * banco confirma (ou recusa de vez).
 *
 * A memória é a fonte da verdade durante a sessão (leituras síncronas para a
 * tela); as gravações vão para o disco em fila, na ordem em que aconteceram.
 */
import {
  createIdbStorage,
  createMemoryStorage,
  createResilientStorage,
  IDB_STORES,
  type KeyedStorage,
} from "./idb";

export interface OutboxEntry<V> {
  /** Também vai nas variáveis da mutação (`outboxId`). */
  id: string;
  /** Só esta conta envia (celular compartilhado na obra). */
  userId: string;
  /** Ordem de envio (crescente, inclusive entre sessões). */
  seq: number;
  /** Quando foi tocado — vira o "Feito às hh:mm" enquanto não sai. */
  queuedAt: number;
  vars: V;
}

export type OutboxStorage<V> = KeyedStorage<OutboxEntry<V>>;

export interface Outbox<V> {
  subscribe(listener: () => void): () => void;
  /** Todas as entradas (todas as contas), na ordem. Mesma referência até mudar. */
  getSnapshot(): readonly OutboxEntry<V>[];
  /** Lê o que ficou no aparelho (uma vez; junta com o que já foi feito nesta sessão). */
  load(): Promise<void>;
  add(userId: string, vars: V): OutboxEntry<V>;
  remove(ids: readonly string[]): void;
  forUser(userId: string): OutboxEntry<V>[];
  /** "Sair mesmo assim": apaga tudo desta conta. Devolve quantas. */
  discardUser(userId: string): number;
  /** Entradas de OUTRAS contas mais antigas que `maxAgeMs`. Devolve quantas. */
  purgeOtherUsers(currentUserId: string, maxAgeMs: number): number;
  /** Espera as gravações pendentes chegarem ao disco (testes, logout). */
  flush(): Promise<void>;
}

function defaultId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createOutbox<V>(
  storage: OutboxStorage<V>,
  opts: { now?: () => number; newId?: () => string } = {},
): Outbox<V> {
  const now = opts.now ?? Date.now;
  const newId = opts.newId ?? defaultId;

  let entries: OutboxEntry<V>[] = [];
  /** Apagadas nesta sessão: um `load()` atrasado não as ressuscita. */
  const removed = new Set<string>();
  let lastSeq = 0;
  let loading: Promise<void> | null = null;
  let chain: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  const setEntries = (next: OutboxEntry<V>[]) => {
    entries = [...next].sort((a, b) => a.seq - b.seq);
    emit();
  };
  const write = (fn: () => Promise<void>) => {
    chain = chain.then(fn).catch((err) => {
      console.warn("[FilaOffline] Falha ao gravar a fila de envio no aparelho:", err);
    });
  };
  const dropIds = (ids: readonly string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    ids.forEach((id) => removed.add(id));
    setEntries(entries.filter((e) => !set.has(e.id)));
    write(async () => {
      for (const id of ids) await storage.delete(id);
    });
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => entries,

    load() {
      if (!loading) {
        loading = (async () => {
          let stored: OutboxEntry<V>[] = [];
          try {
            stored = await storage.getAll();
          } catch (err) {
            console.warn("[FilaOffline] Não foi possível ler a fila de envio:", err);
          }
          const known = new Set(entries.map((e) => e.id));
          const fresh = stored.filter((e) => e && e.id && !known.has(e.id) && !removed.has(e.id));
          for (const e of stored) lastSeq = Math.max(lastSeq, Number(e?.seq) || 0);
          if (fresh.length > 0) setEntries([...entries, ...fresh]);
        })();
      }
      return loading;
    },

    add(userId, vars) {
      const t = now();
      lastSeq = Math.max(lastSeq + 1, t);
      const entry: OutboxEntry<V> = { id: newId(), userId, seq: lastSeq, queuedAt: t, vars };
      setEntries([...entries, entry]);
      write(() => storage.put(entry));
      return entry;
    },

    remove(ids) {
      const present = ids.filter((id) => entries.some((e) => e.id === id));
      dropIds(present);
      // Mesmo sem estar na memória (ex.: `load()` ainda não terminou), não
      // pode voltar do disco.
      ids.forEach((id) => removed.add(id));
    },

    forUser(userId) {
      return entries.filter((e) => e.userId === userId);
    },

    discardUser(userId) {
      const ids = entries.filter((e) => e.userId === userId).map((e) => e.id);
      dropIds(ids);
      // O que ainda está só no disco (antes do `load()`) também sai.
      write(async () => {
        const stored = await storage.getAll();
        for (const e of stored) if (e.userId === userId) await storage.delete(e.id);
      });
      return ids.length;
    },

    purgeOtherUsers(currentUserId, maxAgeMs) {
      const limit = now() - maxAgeMs;
      const ids = entries.filter((e) => e.userId !== currentUserId && e.queuedAt < limit).map((e) => e.id);
      dropIds(ids);
      return ids.length;
    },

    flush() {
      return chain;
    },
  };
}

// ---------------------------------------------------------------------------
// Armazenamentos
// ---------------------------------------------------------------------------

export const OUTBOX_LOCAL_STORAGE_KEY = "bwild-ops-outbox";

/**
 * Reserva quando o IndexedDB falha: uma chave própria no localStorage (o
 * cache das consultas nunca mexe nela — só apaga `bwild-query-cache-v*`).
 */
export function createLocalStorageOutboxStorage<V>(key = OUTBOX_LOCAL_STORAGE_KEY): OutboxStorage<V> {
  const read = (): OutboxEntry<V>[] => {
    if (typeof window === "undefined" || !window.localStorage) throw new Error("localStorage indisponível");
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OutboxEntry<V>[]) : [];
    } catch {
      return [];
    }
  };
  const save = (list: OutboxEntry<V>[]) => {
    if (list.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(list));
  };
  return {
    getAll: async () => read(),
    put: async (item) => save([...read().filter((e) => e.id !== item.id), item]),
    delete: async (id) => save(read().filter((e) => e.id !== id)),
  };
}

/** IndexedDB → localStorage (chave própria) → memória. */
export function createDefaultOutboxStorage<V>(): OutboxStorage<V> {
  return createResilientStorage<OutboxEntry<V>>(
    [
      createIdbStorage<OutboxEntry<V>>(IDB_STORES.outcomes),
      createLocalStorageOutboxStorage<V>(),
      createMemoryStorage<OutboxEntry<V>>(),
    ],
    "FilaOffline",
  );
}
