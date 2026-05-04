import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import {
  getNcsByProject,
  getNcHistory,
  createNonConformity,
  updateNonConformity,
  updateNcEvidencePhotos,
  transitionNcStatus,
  deleteNonConformity,
} from "@/infra/repositories/ncsRepository";

// eslint-disable-next-line no-duplicate-imports
import type {
  NonConformity,
  NcHistoryEntry,
  NcSeverity,
  NcStatus,
} from "@/infra/repositories/ncsRepository";
export type { NonConformity, NcHistoryEntry, NcSeverity, NcStatus };

// ── Queries ──

export function useNonConformities(projectId: string | undefined) {
  return useQuery({
    queryKey: ["non-conformities", projectId],
    queryFn: () => getNcsByProject(projectId!),
    enabled: !!projectId,
  });
}

export function useNcHistory(ncId: string | undefined) {
  return useQuery({
    queryKey: ["nc-history", ncId],
    queryFn: () => getNcHistory(ncId!),
    enabled: !!ncId,
  });
}

// ── Mutations ──

export function useCreateNonConformity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      project_id: string;
      inspection_id?: string;
      inspection_item_id?: string;
      title: string;
      description?: string;
      severity: NcSeverity;
      responsible_user_id?: string;
      deadline?: string;
      category?: string;
      estimated_cost?: number;
    }) => {
      if (!user) throw new Error("Não autenticado");
      return createNonConformity({ ...params, created_by: user.id });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["non-conformities", data.project_id],
      });
      toast.success("Não conformidade registrada");
    },
    onError: (err: Error) => {
      toast.error("Erro: " + err.message);
    },
  });
}

export function useUpdateNcStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      nc: NonConformity;
      new_status: NcStatus;
      notes?: string;
      corrective_action?: string;
      resolution_notes?: string;
      rejection_reason?: string;
      evidence_photos_before?: string[];
      evidence_photos_after?: string[];
    }) => {
      if (!user) throw new Error("Não autenticado");
      await transitionNcStatus({
        nc_id: params.nc.id,
        new_status: params.new_status,
        notes: params.notes,
        corrective_action: params.corrective_action,
        resolution_notes: params.resolution_notes,
        rejection_reason: params.rejection_reason,
        evidence_photos_before: params.evidence_photos_before,
        evidence_photos_after: params.evidence_photos_after,
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["non-conformities", vars.nc.project_id],
      });
      queryClient.invalidateQueries({ queryKey: ["nc-history", vars.nc.id] });
      toast.success("Status atualizado");
    },
    onError: (err: Error) => {
      toast.error("Erro: " + err.message);
    },
  });
}

export function useUpdateNonConformity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      project_id: string;
      title?: string;
      description?: string | null;
      severity?: NcSeverity;
      responsible_user_id?: string | null;
      deadline?: string | null;
      category?: string;
      root_cause?: string | null;
      estimated_cost?: number | null;
      actual_cost?: number | null;
    }) => {
      await updateNonConformity(params);
      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({
        queryKey: ["non-conformities", params.project_id],
      });
      toast.success("NC atualizada");
    },
    onError: (err: Error) => {
      toast.error("Erro: " + err.message);
    },
  });
}

export function useDeleteNonConformity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; project_id: string }) => {
      await deleteNonConformity(params.id);
      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({
        queryKey: ["non-conformities", params.project_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["non-conformities", "global"],
      });
      toast.success("Não conformidade excluída");
    },
    onError: (err: Error) => {
      toast.error("Erro ao excluir: " + err.message);
    },
  });
}

export function useUpdateNcEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      project_id: string;
      evidence_photos_before?: string[];
      evidence_photos_after?: string[];
    }) => {
      await updateNcEvidencePhotos(params);
      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({
        queryKey: ["non-conformities", params.project_id],
      });
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar evidências: " + err.message);
    },
  });
}
