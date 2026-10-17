/**
 * useContractDeadline — Fase 1 (staff-only).
 * Prazo contratual calculado no banco + mutação dos termos do contrato.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  contractDeadlineRepo,
  type ContractAmendment,
  type ContractAmendmentInput,
  type ContractAmendmentStatus,
  type ContractTermsInput,
  type ProjectDeadline,
} from "@/infra/repositories/contractDeadline.repository";
import { trackAmplitude } from "@/lib/amplitude";

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

/** Prazos contratuais de todas as obras em execução (usado no Painel). */
export function useObraDeadlines() {
  return useQuery({
    queryKey: queryKeys.contractDeadline.list(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await contractDeadlineRepo.listObras();
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

/** Aditivos de prazo da obra (todos os status; staff-only pela RLS). */
export function useContractAmendments(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contractDeadline.amendments(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!projectId) return [] as ContractAmendment[];
      const res = await contractDeadlineRepo.listAmendments(projectId);
      if (res.error) throw res.error;
      return (res.data ?? []) as ContractAmendment[];
    },
  });
}

/**
 * Registra um rascunho de aditivo. A foto nova (opcional) sobe antes; se a
 * foto falhar, nada é gravado.
 */
export function useCreateAmendmentDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContractAmendmentInput & { photo?: File | null }) => {
      const { photo, ...row } = input;
      const evidence = [...(row.evidence_urls ?? [])];
      if (photo) {
        const up = await contractDeadlineRepo.uploadEvidence(row.project_id, photo);
        if (up.error) throw up.error;
        if (up.data) evidence.push(up.data);
      }
      const res = await contractDeadlineRepo.createAmendment({ ...row, evidence_urls: evidence });
      if (res.error) throw res.error;
      return res.data as ContractAmendment;
    },
    onSuccess: (saved) => {
      trackAmplitude("ops_amendment_drafted", {
        reason: saved.reason,
        days: saved.business_days_added,
        evidence: saved.evidence_urls?.length ?? 0,
      });
      qc.invalidateQueries({ queryKey: queryKeys.contractDeadline.all });
    },
  });
}

export function useUpdateAmendmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: ContractAmendmentStatus }) => {
      const res = await contractDeadlineRepo.updateAmendmentStatus(input.id, input.status);
      if (res.error) throw res.error;
      return res.data as ContractAmendment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contractDeadline.all });
    },
  });
}

export function useDeleteAmendmentDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await contractDeadlineRepo.deleteDraftAmendment(id);
      if (res.error) throw res.error;
      return null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contractDeadline.all });
    },
  });
}
