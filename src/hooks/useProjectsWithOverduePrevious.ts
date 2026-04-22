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
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Busca TODAS as atividades não concluídas com `planned_end` no passado
 * (em relação a hoje). O resultado é estável: independe da semana visualizada,
 * o que evita refetch ao navegar entre semanas no Calendário.
 *
 * O filtro por `weekStart` é aplicado no cliente (derivado via useMemo) para
 * que diferentes semanas reaproveitem o mesmo cache.
 */
async function fetchAllOpenPastActivities(): Promise<
  Array<{ project_id: string; planned_end: string }>
> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('project_activities')
    .select('project_id, planned_end')
    .lt('planned_end', today)
    .is('actual_end', null);

  if (error) throw error;
  return (data ?? []) as Array<{ project_id: string; planned_end: string }>;
}

export function useProjectsWithOverduePrevious(weekStart: string) {
  const { user } = useAuth();

  // Chave fixa por dia — não muda com a navegação semanal.
  const today = new Date().toISOString().slice(0, 10);

  const query = useQuery({
    queryKey: ['projects-overdue-previous', today],
    queryFn: fetchAllOpenPastActivities,
    enabled: !!user,
    staleTime: 5 * 60_000, // 5 min: muda pouco ao longo do dia
    gcTime: 30 * 60_000,
  });

  // Deriva o Set por semana sem refazer a query.
  const data = useMemo(() => {
    if (!query.data || !weekStart) return new Set<string>();
    return new Set(
      query.data
        .filter((r) => r.planned_end < weekStart)
        .map((r) => r.project_id),
    );
  }, [query.data, weekStart]);

  return { ...query, data };
}
