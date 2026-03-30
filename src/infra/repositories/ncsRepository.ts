import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type NcSeverity = Database['public']['Enums']['nc_severity'];
export type NcStatus = Database['public']['Enums']['nc_status'];

type NcRow = Database['public']['Tables']['non_conformities']['Row'];
export type NonConformity = NcRow & {
  responsible_user_name?: string | null;
};
export type NcHistoryEntry = Database['public']['Tables']['nc_history']['Row'];

export async function getNcsByProject(projectId: string): Promise<NonConformity[]> {
  const { data, error } = await supabase
    .from('non_conformities')
    .select('*, responsible:users_profile!non_conformities_responsible_user_id_fkey(nome)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    responsible_user_name: row.responsible?.nome ?? null,
    responsible: undefined,
  })) as NonConformity[];
}

export async function getNcHistory(ncId: string): Promise<NcHistoryEntry[]> {
  const { data, error } = await supabase
    .from('nc_history')
    .select('*')
    .eq('nc_id', ncId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createNonConformity(params: {
  project_id: string;
  inspection_id?: string;
  inspection_item_id?: string;
  title: string;
  description?: string;
  severity: NcSeverity;
  responsible_user_id?: string;
  deadline?: string;
  created_by: string;
}): Promise<NonConformity> {
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
      created_by: params.created_by,
    })
    .select()
    .single();

  if (error) throw error;

  // Log history
  await supabase.from('nc_history').insert({
    nc_id: data.id,
    action: 'Não conformidade criada',
    new_status: 'open' as NcStatus,
    actor_id: params.created_by,
  });

  return data;
}

export async function transitionNcStatus(params: {
  nc_id: string;
  new_status: NcStatus;
  notes?: string;
  corrective_action?: string;
  resolution_notes?: string;
  rejection_reason?: string;
  evidence_photo_paths?: string[];
}): Promise<void> {
  const { error } = await supabase.rpc('transition_nc_status', {
    p_nc_id: params.nc_id,
    p_new_status: params.new_status,
    p_notes: params.notes || undefined,
    p_corrective_action: params.corrective_action || undefined,
    p_resolution_notes: params.resolution_notes || undefined,
    p_rejection_reason: params.rejection_reason || undefined,
    p_evidence_photo_paths: params.evidence_photo_paths || undefined,
  });
  if (error) throw error;
}
