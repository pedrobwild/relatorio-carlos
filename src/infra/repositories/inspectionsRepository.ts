import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type InspectionRow = Database['public']['Tables']['inspections']['Row'];
export type Inspection = InspectionRow & {
  activity_description?: string | null;
  inspector_user_name?: string | null;
};
export type InspectionItem = Database['public']['Tables']['inspection_items']['Row'];
export type InspectionStatus = Database['public']['Enums']['inspection_status'];
export type InspectionItemResult = Database['public']['Enums']['inspection_item_result'];

export async function getInspectionsByProject(projectId: string): Promise<Inspection[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*, project_activities(description)')
    .eq('project_id', projectId)
    .order('inspection_date', { ascending: false });
  if (error) throw error;
  const inspections = (data ?? []).map((row: any) => ({
    ...row,
    activity_description: row.project_activities?.description ?? null,
    project_activities: undefined,
  }));

  // Fetch inspector user names
  const inspectorIds = [...new Set(inspections.map((i: any) => i.inspector_user_id).filter(Boolean))] as string[];
  let nameMap: Record<string, string> = {};
  if (inspectorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('users_profile')
      .select('id, nome')
      .in('id', inspectorIds);
    if (profiles) {
      nameMap = Object.fromEntries(profiles.map(p => [p.id, p.nome]));
    }
  }

  return inspections.map((i: any) => ({
    ...i,
    inspector_user_name: i.inspector_user_id ? nameMap[i.inspector_user_id] ?? null : null,
  }));
}

export async function getInspectionById(inspectionId: string): Promise<Inspection> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', inspectionId)
    .single();
  if (error) throw error;

  // Fetch inspector name
  let inspector_user_name: string | null = null;
  if ((data as any).inspector_user_id) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('nome')
      .eq('id', (data as any).inspector_user_id)
      .single();
    inspector_user_name = profile?.nome ?? null;
  }

  return { ...data, inspector_user_name };
}

export async function getInspectionItems(inspectionId: string): Promise<InspectionItem[]> {
  const { data, error } = await supabase
    .from('inspection_items')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createInspectionWithItems(params: {
  project_id: string;
  activity_id?: string;
  inspection_date?: string;
  notes?: string;
  items: { description: string; sort_order: number }[];
  inspection_type?: string;
  inspector_user_id?: string;
  client_present?: boolean;
  client_name?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_inspection_with_items', {
    p_project_id: params.project_id,
    p_activity_id: params.activity_id || undefined,
    p_inspection_date: params.inspection_date || new Date().toISOString().split('T')[0],
    p_notes: params.notes || undefined,
    p_items: JSON.parse(JSON.stringify(params.items)),
    p_inspection_type: params.inspection_type || 'rotina',
    p_client_present: params.client_present ?? false,
    p_client_name: params.client_name || undefined,
    p_inspector_id: params.inspector_user_id || undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function updateInspectionItem(params: {
  id: string;
  result?: InspectionItemResult;
  notes?: string | null;
  photo_paths?: string[];
}): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.result !== undefined) update.result = params.result;
  if (params.notes !== undefined) update.notes = params.notes;
  if (params.photo_paths !== undefined) update.photo_paths = params.photo_paths;

  const { error } = await supabase
    .from('inspection_items')
    .update(update)
    .eq('id', params.id);
  if (error) throw error;
}

export async function completeInspection(id: string): Promise<void> {
  const { error } = await supabase.rpc('complete_inspection', {
    p_inspection_id: id,
  });
  if (error) throw error;
}
