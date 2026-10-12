/**
 * Fila de fotos da tela Hoje ligada ao app: IndexedDB + repositório da
 * operação + estado de rede do TanStack. Um único processador para o app
 * inteiro, que roda mesmo fora da tela Hoje (a pessoa sai da obra, o sinal
 * volta no elevador, as fotos sobem).
 */
import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { opsRepo } from "@/infra/repositories/ops.repository";
import { checkSessionForWrite } from "@/lib/authRecovery";
import { mapError } from "@/lib/errorMapping";
import {
  createIndexedDbPhotoStorage,
  createMemoryPhotoStorage,
  createPhotoQueue,
  type PhotoQueue,
  type PhotoQueueStorage,
  type QueuedPhoto,
} from "./photoQueue";
import { invalidateOps, isRetryableSyncError } from "./opsOutcomeSync";

/** Usa o IndexedDB; se ele falhar (aba privada antiga), cai para memória. */
function resilientStorage(): PhotoQueueStorage {
  const idb = createIndexedDbPhotoStorage();
  const memory = createMemoryPhotoStorage();
  let useMemory = false;
  const attempt = async <T,>(fn: (s: PhotoQueueStorage) => Promise<T>): Promise<T> => {
    if (!useMemory) {
      try {
        return await fn(idb);
      } catch (err) {
        console.warn("[FotosOffline] IndexedDB indisponível; fotos ficam só nesta sessão.", err);
        useMemory = true;
      }
    }
    return fn(memory);
  };
  return {
    getAll: () => attempt((s) => s.getAll()),
    put: (item) => attempt((s) => s.put(item)),
    delete: (id) => attempt((s) => s.delete(id)),
  };
}

let queue: PhotoQueue | null = null;
let client: QueryClient | null = null;

export function getOpsPhotoQueue(): PhotoQueue {
  if (queue) return queue;
  queue = createPhotoQueue({
    storage: resilientStorage(),
    isOnline: () => onlineManager.isOnline(),
    currentUser: async () => {
      const { outcome, userId } = await checkSessionForWrite();
      return outcome === "recovered" ? userId : null;
    },
    upload: async (item: QueuedPhoto) => {
      const file = new File([item.blob], item.name, { type: item.type });
      // Caminho derivado do id do item: repetir não duplica o arquivo.
      const res = await opsRepo.uploadPhoto(item.projectId, item.assignmentId, file, item.id);
      if (res.error) throw res.error;
      return res.data as string;
    },
    link: async (assignmentId, paths) => {
      const res = await opsRepo.appendPhotos(assignmentId, paths);
      if (res.error) throw res.error;
    },
    isConnectionError: isRetryableSyncError,
    describeError: (err) => mapError(err).userMessage,
    onLinked: () => {
      if (client) void invalidateOps(client);
    },
    onFailed: (_item, err) => {
      toast.error("Não foi possível enviar uma foto", { description: mapError(err).userMessage });
    },
  });
  return queue;
}

let started = false;

/** Liga o processador: lê o que ficou guardado e envia quando houver rede. */
export function startOpsPhotoSync(qc: QueryClient) {
  client = qc;
  if (started || typeof window === "undefined") return;
  started = true;
  const q = getOpsPhotoQueue();
  void q
    .load()
    .then(() => q.process())
    .catch((err) => console.warn("[FotosOffline] Falha ao ler a fila:", err));
  onlineManager.subscribe((online) => {
    if (online) void q.process();
  });
}
