/**
 * Hooks da integração com o Bwild Compras (cópia somente leitura + vínculo).
 * Só equipe: o banco não devolve nada disso ao cliente, e as consultas nem
 * são feitas sem a permissão `purchases:view`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invokeFunction, readFunctionError } from "@/infra/edgeFunctions";
import { comprasSyncRepo } from "@/infra/repositories/comprasSync.repository";
import { useCanFeature } from "@/hooks/useCan";
import { mapError } from "@/lib/errorMapping";
import { queryKeys } from "@/lib/queryKeys";

const unwrap = <T,>(res: { data: T | null; error: unknown }): T => {
  if (res.error) throw res.error;
  return res.data as T;
};

export function useComprasVinculos() {
  const enabled = useCanFeature("purchases:view");
  return useQuery({
    queryKey: queryKeys.comprasSync.vinculos(),
    queryFn: async () => unwrap(await comprasSyncRepo.listVinculos()),
    enabled,
    staleTime: 30_000,
  });
}

export function useObrasWorkflowParaVinculo(enabled: boolean) {
  const pode = useCanFeature("compras:conciliar");
  return useQuery({
    queryKey: queryKeys.comprasSync.obras(),
    queryFn: async () => unwrap(await comprasSyncRepo.listObrasWorkflow()),
    enabled: enabled && pode,
    staleTime: 5 * 60_000,
  });
}

export function useComprasUltimaExecucao() {
  const enabled = useCanFeature("purchases:view");
  return useQuery({
    queryKey: queryKeys.comprasSync.ultimaExecucao(),
    queryFn: async () => unwrap(await comprasSyncRepo.ultimaExecucao()),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useDecidirVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      vinculoId: string;
      acao: "confirmar" | "desfazer" | "ignorar";
      projectId?: string;
    }) => unwrap(await comprasSyncRepo.decidirVinculo(input.vinculoId, input.acao, input.projectId)),
    onSuccess: (_d, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.comprasSync.all });
      toast.success(
        input.acao === "confirmar"
          ? "Obra vinculada"
          : input.acao === "ignorar"
            ? "Obra ignorada"
            : "Vínculo desfeito",
      );
    },
    onError: (err) => {
      toast.error(mapError(err).userMessage);
    },
  });
}

export function useAtualizarCompras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeFunction<{ ok?: boolean; pulado?: boolean; error?: string }>(
        "sync-compras-pull",
        { origem: "manual" },
      );
      if (error) throw new Error(await readFunctionError(error, "Não foi possível atualizar"));
      if (data && data.ok === false) throw new Error(data.error ?? "Não foi possível atualizar");
      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: queryKeys.comprasSync.all });
      toast.success(data?.pulado ? "Já estava atualizado" : "Compras atualizado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar");
    },
  });
}
