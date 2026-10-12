/**
 * Liga as filas offline da tela Hoje à sessão.
 *
 * - Ao saber quem está logado (inclusive abrindo o app sem sinal: a sessão
 *   vem do aparelho), lê a caixa de saída e retoma, na ordem, os Feito /
 *   Não feito DESTA conta. Os de outra conta ficam guardados (não aparecem e
 *   não são enviados) e somem depois de 7 dias, junto com as fotos.
 * - "Sair mesmo assim": apaga o que esta conta não enviou.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  discardQueuedOutcomes,
  getOutboxUser,
  getOutcomeOutbox,
  restoreQueuedOutcomes,
  setOutboxUser,
} from "./opsOutcomeSync";
import { getOpsPhotoQueue } from "./opsPhotoSync";

/** Registros de OUTRAS contas neste aparelho são apagados depois disso. */
export const OTHER_USER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A conta `userId` está ativa neste aparelho: lê a caixa de saída, apaga o
 * que é de outras contas há mais de 7 dias e retoma o envio desta. Pode ser
 * chamada várias vezes (cada evento de sessão) — não duplica envio.
 */
export async function activateOfflineUser(qc: QueryClient, userId: string | null): Promise<void> {
  setOutboxUser(userId);
  if (!userId) return;
  const outbox = getOutcomeOutbox();
  await outbox.load();
  // Trocou de conta enquanto lia: quem vale é a mais recente.
  if (getOutboxUser() !== userId) return;
  outbox.purgeOtherUsers(userId, OTHER_USER_RETENTION_MS);
  restoreQueuedOutcomes(qc, userId);
  const photos = getOpsPhotoQueue();
  try {
    await photos.purgeOtherUsers(userId, OTHER_USER_RETENTION_MS);
  } catch (err) {
    console.warn("[FilaOffline] Falha ao limpar fotos antigas de outras contas:", err);
  }
  void photos.process();
}

let started = false;

export function startOpsOfflineSession(qc: QueryClient) {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user?.id ?? null;
    // Fora do callback: chamar o supabase.auth dentro dele trava o cliente
    // (o envio confere a sessão antes de sair).
    setTimeout(() => {
      void activateOfflineUser(qc, userId).catch((err) =>
        console.warn("[FilaOffline] Falha ao retomar a fila de envio:", err),
      );
    }, 0);
  });
}

/** "Sair mesmo assim": apaga deste aparelho o que esta conta não enviou. */
export async function discardPendingWork(qc: QueryClient, userId: string): Promise<number> {
  const outcomes = discardQueuedOutcomes(qc, userId);
  let photos = 0;
  try {
    photos = await getOpsPhotoQueue().discardUser(userId);
  } catch (err) {
    console.warn("[FilaOffline] Falha ao apagar as fotos guardadas:", err);
  }
  await getOutcomeOutbox().flush();
  return outcomes + photos;
}
