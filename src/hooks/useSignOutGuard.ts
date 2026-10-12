/**
 * "Sair" que protege o que ainda não foi enviado (ver SignOutConfirmDialog).
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePendingWorkCount } from "@/hooks/useOpsOffline";
import { discardPendingWork } from "@/lib/offline/opsOfflineSession";

export function unsentPhrase(n: number): string {
  return n === 1 ? "1 registro ainda não foi enviado" : `${n} registros ainda não foram enviados`;
}

/**
 * Liga um botão "Sair" à confirmação. `request()` sai direto quando não há
 * nada pendente (ou, com `alwaysConfirm`, sempre pergunta); com pendências,
 * abre o aviso.
 */
export function useSignOutGuard({
  userId,
  signOut,
  alwaysConfirm = false,
}: {
  userId: string | null | undefined;
  signOut: () => Promise<void> | void;
  alwaysConfirm?: boolean;
}) {
  const qc = useQueryClient();
  const pendingCount = usePendingWorkCount(userId);
  const [open, setOpen] = useState(false);

  const request = useCallback(() => {
    if (alwaysConfirm || pendingCount > 0) setOpen(true);
    else void signOut();
  }, [alwaysConfirm, pendingCount, signOut]);

  const onSignOut = useCallback(() => {
    setOpen(false);
    void signOut();
  }, [signOut]);

  const onDiscardAndSignOut = useCallback(() => {
    setOpen(false);
    void (async () => {
      if (userId) await discardPendingWork(qc, userId);
      await signOut();
    })();
  }, [qc, signOut, userId]);

  return {
    request,
    pendingCount,
    dialogProps: { open, onOpenChange: setOpen, pendingCount, onSignOut, onDiscardAndSignOut },
  };
}
