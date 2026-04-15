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
}

export type KanbanStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export function deriveStatus(a: UnifiedActivity): KanbanStatus {
  // Use the native status field from atividades table
  if (a.status === 'concluido') return 'completed';
  if (a.status === 'em_andamento') {
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
        .from('atividades')
        .select('id, obra_id, titulo, descricao, etapa, data_prevista_inicio, data_prevista_fim, data_real_inicio, data_real_fim, status, prioridade, created_at, obras!inner(nome_da_obra)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        project_id: row.obra_id,
        project_name: (row.obras as any)?.nome_da_obra ?? 'Sem nome',
        description: row.titulo,
        etapa: row.etapa,
        detailed_description: row.descricao,
        planned_start: row.data_prevista_inicio,
        planned_end: row.data_prevista_fim,
        actual_start: row.data_real_inicio,
        actual_end: row.data_real_fim,
        weight: 0,
        sort_order: 0,
        status: row.status,
        prioridade: row.prioridade,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}
