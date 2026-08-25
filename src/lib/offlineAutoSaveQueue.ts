/**
 * Fila offline do autosave.
 *
 * Enquanto não há conexão (ou a gravação falha), o último snapshot editado
 * fica guardado no localStorage. Assim as alterações sobrevivem a um reload
 * ou ao descarte da aba no celular e podem ser sincronizadas quando a
 * conexão voltar. Guardamos apenas o snapshot mais recente por chave —
 * o autosave é idempotente (grava o estado inteiro), então versões
 * intermediárias não têm valor.
 */

const PREFIX = "bwild:autosave-offline:v1:";

export interface OfflineSnapshot<T> {
  data: T;
  /** ISO da última alteração enfileirada. */
  queuedAt: string;
}

const storageKey = (key: string) => `${PREFIX}${key}`;

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function enqueueOfflineSnapshot<T>(key: string, data: T): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const payload: OfflineSnapshot<T> = {
      data,
      queuedAt: new Date().toISOString(),
    };
    storage.setItem(storageKey(key), JSON.stringify(payload));
  } catch (error) {
    // Cota estourada ou modo privado: a edição continua em memória.
    console.warn("Não foi possível enfileirar o autosave offline:", error);
  }
}

export function readOfflineSnapshot<T>(key: string): OfflineSnapshot<T> | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineSnapshot<T>;
    if (!parsed || typeof parsed.queuedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineSnapshot(key: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(key));
  } catch {
    /* noop */
  }
}

/** `true` quando o navegador reporta estar sem conexão. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
