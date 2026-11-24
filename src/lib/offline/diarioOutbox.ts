/**
 * Caixa de saída do Diário de obra.
 *
 * Todo relato passa por aqui, com ou sem sinal: fica guardado no aparelho
 * (IndexedDB, com as fotos) e sai em duas etapas, cada uma gravada —
 * (1) sobe cada foto e guarda o caminho; (2) chama `diario_obra_enviar`.
 * Se o app fechar no meio, a retomada não sobe a mesma foto de novo, e o
 * `client_id` do relato impede que o banco grave duas vezes.
 *
 * - Sem sinal (ou sessão não confirmada): espera, não perde nada.
 * - Recusa do servidor (regra, permissão): o relato fica marcado como falha,
 *   à espera da pessoa — nunca é reenviado em laço.
 * - Por usuário: num celular compartilhado, só a conta que relatou envia.
 *
 * A lógica não conhece IndexedDB nem Supabase: recebe tudo injetado (nos
 * testes, um Map em memória e funções falsas).
 */
import { createIdbStorage, createMemoryStorage, createResilientStorage, IDB_STORES, type KeyedStorage } from "./idb";
import type { DiarioPayload } from "@/lib/diarioObra/regras";

export interface FotoPendente {
  id: string;
  kind: "etapa" | "divergencia";
  blob: Blob;
  type: string;
  /** Preenchido depois do upload. */
  path?: string | null;
}

export interface DiarioPendente {
  /** O `client_id` do relato. */
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  /** Semana do relatório semanal (só organiza a pasta das fotos). */
  weekNumber: number;
  payload: DiarioPayload;
  fotos: FotoPendente[];
  createdAt: number;
  failed?: boolean;
  error?: string | null;
}

export type ResultadoEnvio =
  | { status: "enviado" }
  /** Sem sinal ou sessão não confirmada: continua na fila. */
  | { status: "na_fila" }
  /** O servidor recusou: precisa da pessoa. */
  | { status: "recusado"; message: string };

export interface DiarioOutboxDeps {
  storage: KeyedStorage<DiarioPendente>;
  /** Sobe a foto e devolve o caminho. Idempotente por `foto.id`. */
  uploadFoto: (item: DiarioPendente, foto: FotoPendente) => Promise<string>;
  enviar: (payload: Record<string, unknown>) => Promise<void>;
  isOnline: () => boolean;
  /** Id de quem está logado, ou null para esperar. */
  currentUser: () => Promise<string | null>;
  isConnectionError: (err: unknown) => boolean;
  describeError: (err: unknown) => string;
  onSent?: (item: DiarioPendente) => void;
  onFailed?: (item: DiarioPendente, err: unknown) => void;
}

export interface DiarioOutbox {
  load(): Promise<void>;
  /** Guarda o relato e tenta enviar agora. */
  enqueue(item: DiarioPendente): Promise<ResultadoEnvio>;
  /** Tenta enviar tudo o que é do usuário logado. */
  process(): Promise<void>;
  retry(id: string): Promise<ResultadoEnvio>;
  discard(id: string): Promise<void>;
  getSnapshot(): readonly DiarioPendente[];
  subscribe(listener: () => void): () => void;
}

/** Payload final: caminhos das fotos no lugar dos ids locais. */
export function payloadComFotos(item: DiarioPendente): Record<string, unknown> {
  const path = (id: string | null) => (id ? (item.fotos.find((f) => f.id === id)?.path ?? null) : null);
  return {
    ...item.payload,
    etapas: item.payload.etapas.map(({ foto_id, ...e }) => ({ ...e, photo_path: path(foto_id) })),
    materiais: item.payload.materiais.map(({ foto_id, ...m }) => ({ ...m, divergencia_foto_path: path(foto_id) })),
  };
}

export function createDiarioOutbox(deps: DiarioOutboxDeps): DiarioOutbox {
  let items: DiarioPendente[] = [];
  let loaded = false;
  let running: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    items = [...items];
    for (const l of listeners) l();
  };
  const upsert = async (item: DiarioPendente) => {
    await deps.storage.put(item);
    items = items.some((i) => i.id === item.id) ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item];
    emit();
  };
  const remove = async (id: string) => {
    await deps.storage.delete(id);
    items = items.filter((i) => i.id !== id);
    emit();
  };

  async function sendOne(id: string, userId: string): Promise<ResultadoEnvio> {
    let item = items.find((i) => i.id === id);
    if (!item || item.userId !== userId) return { status: "na_fila" };
    try {
      for (const foto of item.fotos) {
        if (foto.path) continue;
        const path = await deps.uploadFoto(item, foto);
        item = { ...item, fotos: item.fotos.map((f) => (f.id === foto.id ? { ...f, path } : f)) };
        await upsert(item);
      }
      await deps.enviar(payloadComFotos(item));
      await remove(item.id);
      deps.onSent?.(item);
      return { status: "enviado" };
    } catch (err) {
      if (deps.isConnectionError(err)) return { status: "na_fila" };
      const message = deps.describeError(err);
      await upsert({ ...item, failed: true, error: message });
      deps.onFailed?.(item, err);
      return { status: "recusado", message };
    }
  }

  async function ready(): Promise<string | null> {
    if (!deps.isOnline()) return null;
    return deps.currentUser();
  }

  const api: DiarioOutbox = {
    async load() {
      if (loaded) return;
      items = (await deps.storage.getAll()).sort((a, b) => a.createdAt - b.createdAt);
      loaded = true;
      emit();
    },

    async enqueue(item) {
      await api.load();
      await upsert({ ...item, failed: false, error: null });
      if (running) await running.catch(() => undefined);
      const userId = await ready();
      if (!userId) return { status: "na_fila" };
      return sendOne(item.id, userId);
    },

    process() {
      if (running) return running;
      running = (async () => {
        await api.load();
        const userId = await ready();
        if (!userId) return;
        for (const item of [...items]) {
          if (item.failed || item.userId !== userId) continue;
          const res = await sendOne(item.id, userId);
          if (res.status === "na_fila") return; // sem sinal: para e espera
        }
      })().finally(() => {
        running = null;
      });
      return running;
    },

    async retry(id) {
      const item = items.find((i) => i.id === id);
      if (!item) return { status: "na_fila" };
      await upsert({ ...item, failed: false, error: null });
      const userId = await ready();
      if (!userId) return { status: "na_fila" };
      return sendOne(id, userId);
    },

    discard: (id) => remove(id),
    getSnapshot: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return api;
}

export const createDiarioStorage = (): KeyedStorage<DiarioPendente> =>
  createResilientStorage<DiarioPendente>(
    [createIdbStorage<DiarioPendente>(IDB_STORES.diario), createMemoryStorage<DiarioPendente>()],
    "DiarioOffline",
  );
