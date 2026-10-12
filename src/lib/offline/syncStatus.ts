/**
 * A linha de estado da fila offline (tela Hoje), como função pura.
 */

export type SyncTone = "offline" | "sending" | "done";

export interface SyncStatusInput {
  online: boolean;
  /** Registros (confirmações + fotos) ainda não enviados. */
  pending: number;
  /** A fila acabou de esvaziar (mostra "Tudo enviado" por alguns segundos). */
  justFlushed: boolean;
}

export interface SyncStatus {
  tone: SyncTone;
  text: string;
}

export function pendingPhrase(n: number): string {
  return n === 1 ? "1 registro aguardando envio" : `${n} registros aguardando envio`;
}

/** `null` = nada a dizer (online e sem fila): a linha some. */
export function syncStatusFor({ online, pending, justFlushed }: SyncStatusInput): SyncStatus | null {
  if (!online) {
    return {
      tone: "offline",
      text:
        pending > 0
          ? `Sem sinal — ${pendingPhrase(pending)}`
          : "Sem sinal — o que você marcar fica guardado e é enviado quando a conexão voltar",
    };
  }
  if (pending > 0) {
    return { tone: "sending", text: pending === 1 ? "Enviando 1 registro…" : `Enviando ${pending} registros…` };
  }
  if (justFlushed) return { tone: "done", text: "Tudo enviado" };
  return null;
}

// ---------------------------------------------------------------------------
// Coordenação com o aviso global de rede
// ---------------------------------------------------------------------------

let suppressors = 0;
const listeners = new Set<() => void>();

/**
 * Telas que mostram o próprio estado de rede (Hoje) pedem para o aviso global
 * (`NetworkStatusBanner`) não repetir a mesma coisa. Devolve a função que
 * desfaz o pedido.
 */
export const networkBannerSuppression = {
  acquire(): () => void {
    suppressors += 1;
    listeners.forEach((l) => l());
    let released = false;
    return () => {
      if (released) return;
      released = true;
      suppressors -= 1;
      listeners.forEach((l) => l());
    };
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  isSuppressed: () => suppressors > 0,
};
