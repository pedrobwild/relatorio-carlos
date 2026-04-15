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
  status: string;
  prioridade: string;
  responsible_user_id: string | null;
}

export type KanbanStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export function deriveStatus(a: UnifiedActivity): KanbanStatus {
  if (a.status === 'concluido') return 'completed';
  if (a.status === 'em_andamento' || a.status === 'pausado') {
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
        .from('obra_tasks')
        .select('id, project_id, title, description, due_date, start_date, status, priority, sort_order, created_at, projects!inner(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        project_id: row.project_id,
        project_name: (row.projects as any)?.name ?? 'Sem nome',
        description: row.title,
        etapa: null,
        detailed_description: row.description,
        planned_start: row.start_date,
        planned_end: row.due_date,
        actual_start: null,
        actual_end: null,
        weight: 0,
        sort_order: row.sort_order ?? 0,
        status: row.status,
        prioridade: row.priority ?? 'media',
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}
