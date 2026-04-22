/**
 * useProjectsWithOverduePrevious — retorna o conjunto de project_ids que têm
 * pelo menos UMA atividade anterior à semana visível ainda NÃO concluída.
 *
 * Regra de negócio:
 *  - "anterior à semana" = `planned_end < weekStart`
 *  - "não concluída"     = `actual_end IS NULL`
 *
 * Usado pelo Calendário para sugerir "Replanejar cronograma" quando uma obra
 * está com etapas atrasadas anteriores à semana visualizada.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

async function fetchOverdueProjectIds(weekStart: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('project_activities')
    .select('project_id')
    .lt('planned_end', weekStart)
    .is('actual_end', null);

  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.project_id));
}

export function useProjectsWithOverduePrevious(weekStart: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['projects-overdue-previous', weekStart],
    queryFn: () => fetchOverdueProjectIds(weekStart),
    enabled: !!user && !!weekStart,
    staleTime: 60_000,
  });
}
