import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedActivity {
  id: string;
  project_id: string;
  project_name: string;
  description: string;
  etapa: string | null;
  detailed_description: string | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  weight: number;
  sort_order: number;
}

export type KanbanStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export function deriveStatus(a: UnifiedActivity): KanbanStatus {
  if (a.actual_end) return 'completed';
  if (a.actual_start) {
    if (a.planned_end && new Date(a.planned_end) < new Date()) return 'overdue';
    return 'in_progress';
  }
  if (a.planned_end && new Date(a.planned_end) < new Date()) return 'overdue';
  return 'not_started';
}

export function useAllActivities() {
  return useQuery({
    queryKey: ['all-activities-kanban'],
    queryFn: async (): Promise<UnifiedActivity[]> => {
      const { data, error } = await supabase
        .from('project_activities')
        .select('id, project_id, description, etapa, detailed_description, planned_start, planned_end, actual_start, actual_end, weight, sort_order, projects!inner(name)')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        project_id: row.project_id,
        project_name: (row.projects as any)?.name ?? 'Sem nome',
        description: row.description,
        etapa: row.etapa,
        detailed_description: row.detailed_description,
        planned_start: row.planned_start,
        planned_end: row.planned_end,
        actual_start: row.actual_start,
        actual_end: row.actual_end,
        weight: row.weight ?? 0,
        sort_order: row.sort_order ?? 0,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}
