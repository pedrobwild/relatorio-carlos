import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import {
  getNcsByProject,
  getNcHistory,
  createNonConformity,
  updateNonConformity,
  transitionNcStatus,
} from '@/infra/repositories/ncsRepository';

// Re-export types from repository for consumer convenience
export type {
  NonConformity,
  NcHistoryEntry,
  NcSeverity,
  NcStatus,
} from '@/infra/repositories/ncsRepository';

import type { NonConformity, NcSeverity, NcStatus } from '@/infra/repositories/ncsRepository';

// ── Queries ──

export function useNonConformities(projectId: string | undefined) {
  return useQuery({
    queryKey: ['non-conformities', projectId],
    queryFn: () => getNcsByProject(projectId!),
    enabled: !!projectId,
  });
}

export function useNcHistory(ncId: string | undefined) {
  return useQuery({
    queryKey: ['nc-history', ncId],
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
    }) => {
      if (!user) throw new Error('Não autenticado');
      return createNonConformity({ ...params, created_by: user.id });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['non-conformities', data.project_id] });
      toast.success('Não conformidade registrada');
    },
    onError: (err: Error) => {
      toast.error('Erro: ' + err.message);
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
      evidence_photo_paths?: string[];
    }) => {
      if (!user) throw new Error('Não autenticado');
      await transitionNcStatus({
        nc_id: params.nc.id,
        new_status: params.new_status,
        notes: params.notes,
        corrective_action: params.corrective_action,
        resolution_notes: params.resolution_notes,
        rejection_reason: params.rejection_reason,
        evidence_photo_paths: params.evidence_photo_paths,
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['non-conformities', vars.nc.project_id] });
      queryClient.invalidateQueries({ queryKey: ['nc-history', vars.nc.id] });
      toast.success('Status atualizado');
    },
    onError: (err: Error) => {
      toast.error('Erro: ' + err.message);
    },
  });
}
