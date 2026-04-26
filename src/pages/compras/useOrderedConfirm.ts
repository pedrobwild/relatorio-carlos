/**
 * Guarda transições de status para "ordered" sem `activity_id` — pede confirmação.
 *
 * Uso:
 *   const { guardedStatusChange, dialogProps } = useOrderedConfirm(
 *     purchases,
 *     handleStatusChange,
 *   );
 *   // passe `guardedStatusChange` para PurchasesTable / PurchasesKanban
 *   // renderize <OrderedConfirmDialog {...dialogProps} />
 *
 * O fluxo é "lazy": o modal só aparece quando há a tentativa real de transição.
 */
import { useCallback, useState } from 'react';
import type { ProjectPurchase, PurchaseStatus } from '@/hooks/useProjectPurchases';

interface PendingTransition {
  id: string;
  itemName: string;
}

export function useOrderedConfirm(
  purchases: ProjectPurchase[],
  apply: (id: string, status: PurchaseStatus) => void | Promise<void>,
) {
  const [pending, setPending] = useState<PendingTransition | null>(null);

  const guardedStatusChange = useCallback(
    (id: string, newStatus: PurchaseStatus) => {
      if (newStatus !== 'ordered') {
        void apply(id, newStatus);
        return;
      }
      const purchase = purchases.find((p) => p.id === id);
      if (purchase && !purchase.activity_id) {
        setPending({ id, itemName: purchase.item_name });
        return;
      }
      void apply(id, newStatus);
    },
    [apply, purchases],
  );

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    void apply(pending.id, 'ordered');
    setPending(null);
  }, [apply, pending]);

  const dialogProps = {
    open: !!pending,
    onOpenChange: (open: boolean) => {
      if (!open) setPending(null);
    },
    itemName: pending?.itemName ?? '',
    onConfirm: handleConfirm,
  };

  return { guardedStatusChange, dialogProps };
}
