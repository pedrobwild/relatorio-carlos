/**
 * useSuprimentos — Onda E1
 * Requisições, itens, cotações e conversão em pedido.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  suprimentosRepo,
  type RequisitionFilters,
  type RequisitionStatus,
} from "@/infra/repositories/suprimentos.repository";
import { queryKeys } from "@/lib/queryKeys";
import type { TablesUpdate } from "@/integrations/supabase/types";

export type { RequisitionStatus };
export type {
  MaterialRequisition,
  MaterialRequisitionItem,
  RequisitionQuote,
} from "@/infra/repositories/suprimentos.repository";

export function useRequisitions(filters: RequisitionFilters = {}) {
  return useQuery({
    queryKey: queryKeys.suprimentos.requisicoes({
      projectId: filters.projectId,
      status: filters.status,
    }),
    queryFn: async () => {
      const res = await suprimentosRepo.list(filters);
      if (res.error) throw res.error;
      return res.data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useRequisition(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.suprimentos.requisicao(id),
    queryFn: async () => {
      if (!id) return null;
      const res = await suprimentosRepo.get(id);
      if (res.error) throw res.error;
      return res.data;
    },
    enabled: !!id,
  });
}

export function useRequisitionItems(requisitionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.suprimentos.itens(requisitionId),
    queryFn: async () => {
      if (!requisitionId) return [];
      const res = await suprimentosRepo.listItems(requisitionId);
      if (res.error) throw res.error;
      return res.data ?? [];
    },
    enabled: !!requisitionId,
  });
}

export function useRequisitionQuotes(requisitionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.suprimentos.cotacoes(requisitionId),
    queryFn: async () => {
      if (!requisitionId) return [];
      const res = await suprimentosRepo.listQuotes(requisitionId);
      if (res.error) throw res.error;
      return res.data ?? [];
    },
    enabled: !!requisitionId,
  });
}

function invalidateRequisicoes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.suprimentos.all });
}

export function useCreateRequisition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof suprimentosRepo.create>[0]) => {
      const res = await suprimentosRepo.create(payload);
      if (res.error) throw res.error;
      return res.data!;
    },
    onSuccess: () => {
      invalidateRequisicoes(qc);
      toast.success("Requisição criada");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao criar requisição"),
  });
}

export function useUpdateRequisition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      patch: TablesUpdate<"material_requisitions">;
    }) => {
      const res = await suprimentosRepo.update(args.id, args.patch);
      if (res.error) throw res.error;
      return res.data!;
    },
    onSuccess: () => invalidateRequisicoes(qc),
    onError: (err: Error) => toast.error(err.message || "Erro ao atualizar"),
  });
}

export function useDeleteRequisition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await suprimentosRepo.softDelete(id);
      if (res.error) throw res.error;
      return res.data!;
    },
    onSuccess: () => {
      invalidateRequisicoes(qc);
      toast.success("Requisição removida");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao remover"),
  });
}

export function useAddRequisitionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof suprimentosRepo.addItem>[0]) => {
      const res = await suprimentosRepo.addItem(payload);
      if (res.error) throw res.error;
      return res.data!;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.suprimentos.itens(vars.requisition_id),
      });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao adicionar item"),
  });
}

export function useRemoveRequisitionItem(requisitionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await suprimentosRepo.removeItem(id);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.suprimentos.itens(requisitionId),
      });
    },
  });
}

export function useAddQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof suprimentosRepo.addQuote>[0]) => {
      const res = await suprimentosRepo.addQuote(payload);
      if (res.error) throw res.error;
      return res.data!;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.suprimentos.cotacoes(vars.requisition_id),
      });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao registrar cotação"),
  });
}

export function useRemoveQuote(requisitionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await suprimentosRepo.removeQuote(id);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.suprimentos.cotacoes(requisitionId),
      });
    },
  });
}

export function useSelectQuoteWinner(requisitionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) =>
      suprimentosRepo.selectWinner(requisitionId, quoteId),
    onSuccess: () => {
      invalidateRequisicoes(qc);
      toast.success("Cotação vencedora selecionada");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao selecionar cotação"),
  });
}

export function useConvertRequisitionToPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requisitionId: string) =>
      suprimentosRepo.convertToPurchase(requisitionId),
    onSuccess: (result) => {
      invalidateRequisicoes(qc);
      qc.invalidateQueries({ queryKey: ["project-purchases"] });
      toast.success(
        `Pedido gerado com ${result.count} ${result.count === 1 ? "item" : "itens"}`,
      );
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao gerar pedido"),
  });
}
