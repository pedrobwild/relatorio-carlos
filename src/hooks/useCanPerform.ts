/**
 * useCanPerform — combina status de rede com semântica de ação para decidir
 * se o usuário pode disparar uma ação agora.
 *
 * Categorias:
 *  - 'read':        sempre permitido (cache/queries pendentes resolvem sozinhos)
 *  - 'write':       permitido online; em offline retorna { allowed: false, reason: 'offline' }
 *  - 'destructive': permitido apenas com conexão ativa há mais de 30s
 *                   (evita perder trabalho em fluxo offline persistente)
 *
 * Use em botões que disparam delete/cancel/sign — em conjunto com tooltip
 * explicando o motivo do bloqueio.
 *
 * Não substitui checagem de role/permissão — combine com `useCan(...)`.
 */
import { useOnlineStatus } from "./useOnlineStatus";

export type PerformAction = "read" | "write" | "destructive";

export type DenyReason = "offline" | "persistent_offline";

export interface CanPerformResult {
  allowed: boolean;
  reason?: DenyReason;
  /** Mensagem humana (pt-BR) explicando o bloqueio — pronta para tooltip/toast. */
  message?: string;
}

const ALLOWED: CanPerformResult = { allowed: true };

export function useCanPerform(action: PerformAction): CanPerformResult {
  const { online, persistentOffline } = useOnlineStatus();

  if (action === "read") return ALLOWED;

  if (action === "write") {
    if (!online) {
      return {
        allowed: false,
        reason: "offline",
        message: "Você está offline. Conecte para salvar mudanças.",
      };
    }
    return ALLOWED;
  }

  // destructive
  if (persistentOffline) {
    return {
      allowed: false,
      reason: "persistent_offline",
      message:
        "Você está offline. Ações que apagam ou cancelam ficam bloqueadas até reconectar.",
    };
  }
  if (!online) {
    return {
      allowed: false,
      reason: "offline",
      message:
        "Você está offline. Aguarde a conexão voltar antes de apagar ou cancelar.",
    };
  }
  return ALLOWED;
}
