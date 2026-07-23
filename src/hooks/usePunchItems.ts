/**
 * usePunchItems — Onda D2, staff-only
 *
 * Wrapper de TanStack Query para a lista de pendências de entrega.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  punchItemsRepo,
  type PunchItem,
  type PunchItemFilters,
} from "@/infra/repositories/punchItems.repository";
import { queryKeys } from "@/lib/queryKeys";

export type { PunchItem };

export function usePunchItems(filters: PunchItemFilters = {}) {
  return useQuery({
    queryKey: queryKeys.qualidade.punchItems({
      projectId: filters.projectId,
      responsibleUserId: filters.responsibleUserId,
      status: filters.status,
    }),
    queryFn: async () => {
      const res = await punchItemsRepo.list(filters);
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data ?? [];
    },
    staleTime: 30_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.qualidade.all });
    qc.invalidateQueries({ queryKey: queryKeys.minhaSemana.all });
  };
}

export function useCreatePunchItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof punchItemsRepo.create>[0]) => {
      const res = await punchItemsRepo.create(payload);
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pendência registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePunchItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      payload: Parameters<typeof punchItemsRepo.update>[1];
    }) => {
      const res = await punchItemsRepo.update(params.id, params.payload);
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pendência atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolvePunchItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await punchItemsRepo.markResolved(id);
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Marcada como resolvida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVerifyPunchItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await punchItemsRepo.markVerified(id);
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Verificação confirmada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReopenPunchItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await punchItemsRepo.reopen(id);
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Reaberta");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePunchItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await punchItemsRepo.softDelete(id);
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
