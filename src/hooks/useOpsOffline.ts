/**
 * Estado da fila offline da tela Hoje para os componentes: rede, o que ainda
 * não foi enviado, falhas e fotos guardadas no aparelho.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { onlineManager, useMutationState } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  syncFailures,
  type PendingOutcome,
  type SetOutcomeVars,
  type SyncFailure,
} from "@/lib/offline/opsOutcomeSync";
import { getOpsPhotoQueue } from "@/lib/offline/opsPhotoSync";
import type { QueuedPhoto } from "@/lib/offline/photoQueue";
import { networkBannerSuppression, syncStatusFor, type SyncStatus } from "@/lib/offline/syncStatus";

/** Há rede? (o mesmo estado que pausa/retoma as consultas e envios.) */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Feito / Não feito ainda não confirmados pelo banco, na ordem do toque. */
export function usePendingOutcomes(): PendingOutcome[] {
  const states = useMutationState({
    filters: { mutationKey: queryKeys.ops.setOutcomeMutation, status: "pending" },
    select: (m) => ({
      vars: m.state.variables as SetOutcomeVars,
      submittedAt: m.state.submittedAt,
    }),
  });
  return useMemo(() => states.filter((p) => !!p.vars?.id), [states]);
}

export function useSyncFailures(): readonly SyncFailure[] {
  return useSyncExternalStore(syncFailures.subscribe, syncFailures.getSnapshot, syncFailures.getSnapshot);
}

/** Fotos guardadas no aparelho (todas as contas; filtre por usuário). */
export function useQueuedPhotos(): readonly QueuedPhoto[] {
  const q = getOpsPhotoQueue();
  return useSyncExternalStore(q.subscribe, q.getSnapshot, q.getSnapshot);
}

/** Enquanto a tela estiver aberta, o aviso global de rede fica quieto. */
export function useSuppressNetworkBanner() {
  useEffect(() => networkBannerSuppression.acquire(), []);
}

const FLUSHED_VISIBLE_MS = 4000;

/**
 * A linha de estado: "Sem sinal — 3 registros aguardando envio" / "Enviando…"
 * / "Tudo enviado" (por alguns segundos depois de esvaziar a fila).
 */
export function useSyncStatus(pending: number): SyncStatus | null {
  const online = useIsOnline();
  const [justFlushed, setJustFlushed] = useState(false);
  const prev = useRef(pending);

  useEffect(() => {
    const before = prev.current;
    prev.current = pending;
    if (before > 0 && pending === 0 && online) setJustFlushed(true);
    else if (pending > 0) setJustFlushed(false);
  }, [pending, online]);

  useEffect(() => {
    if (!justFlushed) return undefined;
    const t = setTimeout(() => setJustFlushed(false), FLUSHED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [justFlushed]);

  return useMemo(() => syncStatusFor({ online, pending, justFlushed }), [online, pending, justFlushed]);
}
