/**
 * usePurchaseReceipts — Onda E2 (aditivo, staff-only)
 *
 * Hooks TanStack Query para listar e mutar recebimentos de uma compra.
 * Não altera nada no fluxo de `useProjectPurchases`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { purchaseReceiptsRepo, type PurchaseReceipt } from "@/infra/repositories/purchaseReceipts.repository";
import { toast } from "@/hooks/use-toast";

export function usePurchaseReceipts(purchaseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.purchaseReceipts.byPurchase(purchaseId),
    enabled: !!purchaseId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await purchaseReceiptsRepo.listByPurchase(purchaseId!);
      if (res.error) throw res.error;
      return (res.data ?? []) as PurchaseReceipt[];
    },
  });
}

export function usePurchaseReceiptsBatch(purchaseIds: string[]) {
  const key = queryKeys.purchaseReceipts.byPurchaseIds(purchaseIds);
  return useQuery({
    queryKey: key,
    enabled: purchaseIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await purchaseReceiptsRepo.listByPurchaseIds(purchaseIds);
      if (res.error) throw res.error;
      return (res.data ?? []) as PurchaseReceipt[];
    },
  });
}

export function useCreatePurchaseReceipt(purchaseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      received_on: string;
      quantidade?: number | null;
      valor?: number | null;
      notes?: string | null;
      photo_path?: string | null;
    }) => {
      if (!purchaseId) throw new Error("Compra não informada");
      const res = await purchaseReceiptsRepo.create({
        purchase_id: purchaseId,
        ...payload,
      });
      if (res.error) throw res.error;
      return res.data!;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.purchaseReceipts.byPurchase(purchaseId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.purchaseReceipts.all });
      qc.invalidateQueries({ queryKey: queryKeys.minhaSemana.all });
      toast({ title: "Recebimento registrado" });
    },
    onError: (err) => {
      toast({
        title: "Não foi possível registrar",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    },
  });
}

export function useDeletePurchaseReceipt(purchaseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await purchaseReceiptsRepo.softDelete(id);
      if (res.error) throw res.error;
      return res.data!;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.purchaseReceipts.byPurchase(purchaseId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.purchaseReceipts.all });
      qc.invalidateQueries({ queryKey: queryKeys.minhaSemana.all });
      toast({ title: "Recebimento removido" });
    },
    onError: (err) => {
      toast({
        title: "Não foi possível remover",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    },
  });
}
