/**
 * useContractDeadline — Fase 1 (staff-only).
 * Prazo contratual calculado no banco + mutação dos termos do contrato.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  contractDeadlineRepo,
  type ContractTermsInput,
  type ProjectDeadline,
} from "@/infra/repositories/contractDeadline.repository";

export function useProjectDeadline(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contractDeadline.byProject(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!projectId) return null;
      const res = await contractDeadlineRepo.getByProject(projectId);
      if (res.error) throw res.error;
      return (res.data ?? null) as ProjectDeadline | null;
    },
  });
}

export function useActiveDeadlines() {
  return useQuery({
    queryKey: queryKeys.contractDeadline.list(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await contractDeadlineRepo.listActive();
      if (res.error) throw res.error;
      return (res.data ?? []) as ProjectDeadline[];
    },
  });
}

export function useUpdateContractTerms(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContractTermsInput) => {
      if (!projectId) throw new Error("Obra não informada");
      const res = await contractDeadlineRepo.updateTerms(projectId, input);
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contractDeadline.all });
    },
  });
}
