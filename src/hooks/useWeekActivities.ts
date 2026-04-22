/**
 * useWeekActivities — fetches all project_activities scheduled for a given week
 * across every project the current user has access to.
 *
 * "Scheduled for the week" = activity whose [planned_start, planned_end] interval
 * intersects the week range. Uses TanStack Query for caching + optimistic updates
 * when the user marks actual start / actual end.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { invalidateActivityQueries } from '@/lib/queryKeys';

export interface WeekActivity {
  id: string;
  project_id: string;
  project_name: string;
  description: string;
  detailed_description: string | null;
  etapa: string | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  baseline_start: string | null;
  baseline_end: string | null;
  baseline_saved_at: string | null;
  weight: number;
  created_at: string;
  updated_at: string;
}

interface FetchArgs {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
}

async function fetchWeekActivities({ weekStart, weekEnd }: FetchArgs): Promise<WeekActivity[]> {
  // Interval intersection: planned_start <= weekEnd AND planned_end >= weekStart
  const { data, error } = await supabase
    .from('project_activities')
    .select(`
      id,
      project_id,
      description,
      etapa,
      planned_start,
      planned_end,
      actual_start,
      actual_end,
      weight,
      projects:project_id ( name )
    `)
    .lte('planned_start', weekEnd)
    .gte('planned_end', weekStart)
    .order('planned_start', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    project_id: row.project_id,
    project_name: row.projects?.name ?? 'Obra sem nome',
    description: row.description,
    etapa: row.etapa,
    planned_start: row.planned_start,
    planned_end: row.planned_end,
    actual_start: row.actual_start,
    actual_end: row.actual_end,
    weight: row.weight,
  }));
}

export function useWeekActivities(weekStart: string, weekEnd: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['week-activities', weekStart, weekEnd] as const;

  const { data: activities = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchWeekActivities({ weekStart, weekEnd }),
    enabled: !!user && !!weekStart && !!weekEnd,
    staleTime: 30_000,
  });

  const updateDates = useMutation({
    mutationFn: async ({
      activityId,
      updates,
    }: {
      activityId: string;
      updates: { actual_start?: string | null; actual_end?: string | null };
    }) => {
      const { error: err } = await supabase
        .from('project_activities')
        .update(updates)
        .eq('id', activityId);
      if (err) throw err;
      return { activityId, updates };
    },
    onMutate: async ({ activityId, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<WeekActivity[]>(queryKey);
      if (prev) {
        queryClient.setQueryData<WeekActivity[]>(
          queryKey,
          prev.map((a) => (a.id === activityId ? { ...a, ...updates } : a)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error('Erro ao atualizar datas');
    },
    onSuccess: (_, vars) => {
      const projectId = activities.find((a) => a.id === vars.activityId)?.project_id;
      if (projectId) invalidateActivityQueries(projectId);
      toast.success('Datas atualizadas');
    },
  });

  // Group by project for convenience
  const byProject = useMemo(() => {
    const map = new Map<string, { project_id: string; project_name: string; items: WeekActivity[] }>();
    for (const a of activities) {
      if (!map.has(a.project_id)) {
        map.set(a.project_id, { project_id: a.project_id, project_name: a.project_name, items: [] });
      }
      map.get(a.project_id)!.items.push(a);
    }
    return Array.from(map.values()).sort((x, y) => x.project_name.localeCompare(y.project_name, 'pt-BR'));
  }, [activities]);

  return {
    activities,
    byProject,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    updateDates: (activityId: string, updates: { actual_start?: string | null; actual_end?: string | null }) =>
      updateDates.mutateAsync({ activityId, updates }),
    isUpdating: updateDates.isPending,
  };
}
