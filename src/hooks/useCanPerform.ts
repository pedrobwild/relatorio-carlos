import { useMemo } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

export type ActionKind = 'read' | 'write' | 'destructive';

export interface CanPerformResult {
  /** `true` se a ação pode ser executada agora. */
  allowed: boolean;
  /** Motivo amigável (em pt-BR) quando `allowed === false`. */
  reason?: string;
  /** Tooltip pronto para `<button title>` ou `<Tooltip>`. */
  tooltip?: string;
}

/**
 * Limite (ms) acima do qual consideramos "offline persistente". A partir
 * desse ponto bloqueamos ações destrutivas para evitar dados sujos.
 */
export const OFFLINE_PERSISTENT_THRESHOLD_MS = 30_000;

/**
 * Decide se uma ação (`read` | `write` | `destructive`) pode ser executada
 * AGORA, considerando o status de rede.
 *
 *  - `read`        → sempre permitido (cache local cobre).
 *  - `write`       → permitido offline (Supabase enfileira); bloqueia em
 *                    offline persistente para evitar perda silenciosa.
 *  - `destructive` → bloqueia assim que ficamos offline persistente
 *                    (>30s) — apagar/cancelar offline gera inconsistência.
 *
 * Combine este hook com `useCan(feature)` para roles. Eles são
 * ortogonais: roles dizem "se" o usuário pode em geral; este hook diz
 * "se agora" ele pode.
 */
export function useCanPerform(action: ActionKind): CanPerformResult {
  const { online, durationOffline } = useOnlineStatus();

  return useMemo<CanPerformResult>(() => {
    if (online) return { allowed: true };

    const persistent = durationOffline >= OFFLINE_PERSISTENT_THRESHOLD_MS;

    if (action === 'read') {
      return { allowed: true };
    }

    if (action === 'write') {
      if (persistent) {
        const reason = 'Você está offline há um tempo. Reconecte para salvar alterações.';
        return { allowed: false, reason, tooltip: reason };
      }
      return { allowed: true };
    }

    // destructive
    const reason = persistent
      ? 'Você está offline. Ações destrutivas estão desabilitadas até reconectar.'
      : 'Sem conexão. Aguarde reconectar para executar esta ação.';
    return { allowed: false, reason, tooltip: reason };
  }, [online, durationOffline, action]);
}
