import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type InspectionStatus = 'draft' | 'in_progress' | 'completed';
export type InspectionItemResult = 'approved' | 'rejected' | 'not_applicable' | 'pending';
export type NcSeverity = 'low' | 'medium' | 'high' | 'critical';
export type NcStatus = 'open' | 'in_treatment' | 'pending_verification' | 'pending_approval' | 'closed' | 'reopened';

export interface Inspection {
  id: string;
  project_id: string;
  activity_id: string | null;
  inspector_id: string;
  inspection_date: string;
  status: InspectionStatus;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  activity_description?: string;
  inspector_name?: string;
  items_count?: number;
  rejected_count?: number;
}

export interface InspectionItem {
  id: string;
  inspection_id: string;
  description: string;
  result: InspectionItemResult;
  notes: string | null;
  photo_paths: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NonConformity {
  id: string;
  project_id: string;
  inspection_id: string | null;
  inspection_item_id: string | null;
  title: string;
  description: string | null;
  severity: NcSeverity;
  status: NcStatus;
  responsible_user_id: string | null;
  deadline: string | null;
  corrective_action: string | null;
  evidence_photo_paths: string[] | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NcHistoryEntry {
  id: string;
  nc_id: string;
  action: string;
  old_status: NcStatus | null;
  new_status: NcStatus | null;
  notes: string | null;
  actor_id: string;
  created_at: string;
}

// ── Inspections queries ──

export function useInspections(projectId: string | undefined) {
  return useQuery({
    queryKey: ['inspections', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('project_id', projectId)
        .order('inspection_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Inspection[];
    },
    enabled: !!projectId,
  });
}

export function useInspection(inspectionId: string | undefined) {
  return useQuery({
    queryKey: ['inspection', inspectionId],
    queryFn: async () => {
      if (!inspectionId) return null;
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('id', inspectionId)
        .single();
      if (error) throw error;
      return data as Inspection;
    },
    enabled: !!inspectionId,
  });
}

export function useInspectionItems(inspectionId: string | undefined) {
  return useQuery({
    queryKey: ['inspection-items', inspectionId],
    queryFn: async () => {
      if (!inspectionId) return [];
      const { data, error } = await supabase
        .from('inspection_items')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InspectionItem[];
    },
    enabled: !!inspectionId,
  });
}

// ── Mutations ──

export function useCreateInspection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      project_id: string;
      activity_id?: string;
      inspection_date?: string;
      notes?: string;
      items: { description: string; sort_order: number }[];
    }) => {
      if (!user) throw new Error('Não autenticado');

      // Create inspection
      const { data: inspection, error: insError } = await supabase
        .from('inspections')
        .insert({
          project_id: params.project_id,
          activity_id: params.activity_id || null,
          inspector_id: user.id,
          inspection_date: params.inspection_date || new Date().toISOString().split('T')[0],
          notes: params.notes || null,
          status: 'draft' as InspectionStatus,
        })
        .select()
        .single();

      if (insError) throw insError;

      // Create items
      if (params.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('inspection_items')
          .insert(
            params.items.map((item) => ({
              inspection_id: inspection.id,
              description: item.description,
              sort_order: item.sort_order,
            }))
          );
        if (itemsError) throw itemsError;
      }

      return inspection as Inspection;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inspections', data.project_id] });
      toast.success('Vistoria criada com sucesso');
    },
    onError: (err: Error) => {
      toast.error('Erro ao criar vistoria: ' + err.message);
    },
  });
}

export function useUpdateInspectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      inspection_id: string;
      result?: InspectionItemResult;
      notes?: string | null;
      photo_paths?: string[];
    }) => {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.result !== undefined) update.result = params.result;
      if (params.notes !== undefined) update.notes = params.notes;
      if (params.photo_paths !== undefined) update.photo_paths = params.photo_paths;

      const { error } = await supabase
        .from('inspection_items')
        .update(update)
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['inspection-items', vars.inspection_id] });
    },
  });
}

export function useCompleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from('inspections')
        .update({
          status: 'completed' as InspectionStatus,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['inspections', vars.project_id] });
      queryClient.invalidateQueries({ queryKey: ['inspection', vars.id] });
      toast.success('Vistoria finalizada');
    },
  });
}

// ── Non-conformities ──

export function useNonConformities(projectId: string | undefined) {
  return useQuery({
    queryKey: ['non-conformities', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('non_conformities')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as NonConformity[];
    },
    enabled: !!projectId,
  });
}

export function useNcHistory(ncId: string | undefined) {
  return useQuery({
    queryKey: ['nc-history', ncId],
    queryFn: async () => {
      if (!ncId) return [];
      const { data, error } = await supabase
        .from('nc_history')
        .select('*')
        .eq('nc_id', ncId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as NcHistoryEntry[];
    },
    enabled: !!ncId,
  });
}

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

      const { data, error } = await supabase
        .from('non_conformities')
        .insert({
          project_id: params.project_id,
          inspection_id: params.inspection_id || null,
          inspection_item_id: params.inspection_item_id || null,
          title: params.title,
          description: params.description || null,
          severity: params.severity,
          responsible_user_id: params.responsible_user_id || null,
          deadline: params.deadline || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log history
      await supabase.from('nc_history').insert({
        nc_id: data.id,
        action: 'Não conformidade criada',
        new_status: 'open' as NcStatus,
        actor_id: user.id,
      });

      return data as NonConformity;
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

      const { error } = await supabase.rpc('transition_nc_status', {
        p_nc_id: params.nc.id,
        p_new_status: params.new_status,
        p_notes: params.notes || undefined,
        p_corrective_action: params.corrective_action || undefined,
        p_resolution_notes: params.resolution_notes || undefined,
        p_rejection_reason: params.rejection_reason || undefined,
        p_evidence_photo_paths: params.evidence_photo_paths || undefined,
      });

      if (error) throw error;
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

function getActionLabel(status: NcStatus): string {
  switch (status) {
    case 'in_treatment': return 'Iniciou tratamento';
    case 'pending_verification': return 'Enviou para verificação';
    case 'pending_approval': return 'Verificação concluída, aguardando aprovação';
    case 'closed': return 'Aprovada e encerrada';
    case 'reopened': return 'Reaberta';
    default: return 'Status alterado';
  }
}
