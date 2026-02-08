/**
 * Project Activities Hook - TanStack Query Version
 * 
 * Migrated from useState/useEffect to useQuery/useMutation pattern
 * with optimistic updates for Gantt chart interactions.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { queryKeys, invalidateActivityQueries } from '@/lib/queryKeys';
import { QUERY_TIMING } from '@/lib/queryClient';

export interface ProjectActivity {
  id: string;
  project_id: string;
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  weight: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  predecessor_ids: string[];
  baseline_start: string | null;
  baseline_end: string | null;
  baseline_saved_at: string | null;
}

export interface ActivityInput {
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  weight: number;
  sort_order: number;
  predecessor_ids?: string[];
}

// Fetch activities for a project
async function fetchProjectActivities(projectId: string): Promise<ProjectActivity[]> {
  const { data, error } = await supabase
    .from('project_activities')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function useProjectActivities(projectId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Main query for activities
  const { 
    data: activities = [], 
    isLoading: loading, 
    error,
    refetch 
  } = useQuery({
    queryKey: queryKeys.activities.list(projectId),
    queryFn: () => fetchProjectActivities(projectId!),
    enabled: !!projectId,
    staleTime: QUERY_TIMING.activities.staleTime,
    gcTime: QUERY_TIMING.activities.gcTime,
    placeholderData: (previousData) => previousData,
  });

  // Save all activities (bulk replace)
  const saveActivitiesMutation = useMutation({
    mutationFn: async (newActivities: ActivityInput[]) => {
      if (!projectId || !user) {
        throw new Error('Projeto ou usuário não encontrado');
      }

      // Delete existing activities for this project
      const { error: deleteError } = await supabase
        .from('project_activities')
        .delete()
        .eq('project_id', projectId);

      if (deleteError) throw deleteError;

      // Insert new activities
      if (newActivities.length > 0) {
        const activitiesToInsert = newActivities.map((activity, index) => ({
          project_id: projectId,
          description: activity.description,
          planned_start: activity.planned_start,
          planned_end: activity.planned_end,
          actual_start: activity.actual_start || null,
          actual_end: activity.actual_end || null,
          weight: activity.weight,
          sort_order: index,
          created_by: user.id,
          predecessor_ids: activity.predecessor_ids || [],
        }));

        const { error: insertError } = await supabase
          .from('project_activities')
          .insert(activitiesToInsert);

        if (insertError) throw insertError;
      }

      return newActivities;
    },
    onSuccess: () => {
      toast.success('Cronograma salvo com sucesso!');
      if (projectId) {
        invalidateActivityQueries(projectId);
      }
    },
    onError: () => {
      toast.error('Erro ao salvar cronograma');
    },
  });

  // Update single activity with optimistic update
  const updateActivityMutation = useMutation({
    mutationFn: async ({ activityId, updates }: { 
      activityId: string; 
      updates: Partial<ActivityInput> 
    }) => {
      const { error: updateError } = await supabase
        .from('project_activities')
        .update(updates)
        .eq('id', activityId);

      if (updateError) throw updateError;
      return { activityId, updates };
    },
    // Optimistic update for smooth Gantt drag experience
    onMutate: async ({ activityId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.activities.list(projectId) });

      const previousActivities = queryClient.getQueryData<ProjectActivity[]>(
        queryKeys.activities.list(projectId)
      );

      if (previousActivities) {
        queryClient.setQueryData<ProjectActivity[]>(
          queryKeys.activities.list(projectId),
          previousActivities.map(act =>
            act.id === activityId
              ? { ...act, ...updates, updated_at: new Date().toISOString() }
              : act
          )
        );
      }

      return { previousActivities };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousActivities) {
        queryClient.setQueryData(
          queryKeys.activities.list(projectId),
          context.previousActivities
        );
      }
      toast.error('Erro ao atualizar atividade');
    },
    onSettled: () => {
      if (projectId) {
        invalidateActivityQueries(projectId);
      }
    },
  });

  // Save baseline mutation
  const saveBaselineMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Projeto não encontrado');

      // Update all activities with current planned dates as baseline
      const updates = activities.map(activity => 
        supabase
          .from('project_activities')
          .update({
            baseline_start: activity.planned_start,
            baseline_end: activity.planned_end,
            baseline_saved_at: new Date().toISOString(),
          })
          .eq('id', activity.id)
      );

      await Promise.all(updates);
      return true;
    },
    onSuccess: () => {
      toast.success('Baseline salvo com sucesso!');
      if (projectId) {
        invalidateActivityQueries(projectId);
      }
    },
    onError: () => {
      toast.error('Erro ao salvar baseline');
    },
  });

  // Clear baseline mutation
  const clearBaselineMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Projeto não encontrado');

      const { error: updateError } = await supabase
        .from('project_activities')
        .update({
          baseline_start: null,
          baseline_end: null,
          baseline_saved_at: null,
        })
        .eq('project_id', projectId);

      if (updateError) throw updateError;
      return true;
    },
    onSuccess: () => {
      toast.success('Baseline removido');
      if (projectId) {
        invalidateActivityQueries(projectId);
      }
    },
    onError: () => {
      toast.error('Erro ao remover baseline');
    },
  });

  // Computed: has baseline
  const hasBaseline = useMemo(() => 
    activities.some(a => a.baseline_saved_at !== null),
    [activities]
  );

  // Public API (backwards compatible)
  const saveActivities = async (newActivities: ActivityInput[]): Promise<boolean> => {
    try {
      await saveActivitiesMutation.mutateAsync(newActivities);
      return true;
    } catch {
      return false;
    }
  };

  const updateActivity = async (activityId: string, updates: Partial<ActivityInput>): Promise<boolean> => {
    try {
      await updateActivityMutation.mutateAsync({ activityId, updates });
      return true;
    } catch {
      return false;
    }
  };

  const saveBaseline = async (): Promise<boolean> => {
    try {
      await saveBaselineMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const clearBaseline = async (): Promise<boolean> => {
    try {
      await clearBaselineMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  return {
    activities,
    loading,
    error: error ? (error as Error).message : null,
    refetch,
    saveActivities,
    updateActivity,
    saveBaseline,
    clearBaseline,
    hasBaseline,
    // Expose mutation states for UI feedback
    isSaving: saveActivitiesMutation.isPending,
    isUpdating: updateActivityMutation.isPending,
    isSavingBaseline: saveBaselineMutation.isPending,
    isClearingBaseline: clearBaselineMutation.isPending,
  };
}

/**
 * Hook to get activity statistics for a project
 */
export function useActivityStats(projectId: string | undefined) {
  const { activities, loading } = useProjectActivities(projectId);

  const stats = useMemo(() => {
    if (!activities.length) return null;

    const totalWeight = activities.reduce((sum, a) => sum + a.weight, 0);
    const completedWeight = activities
      .filter(a => a.actual_end !== null)
      .reduce((sum, a) => sum + a.weight, 0);
    
    const progressPercentage = totalWeight > 0 
      ? Math.round((completedWeight / totalWeight) * 100) 
      : 0;

    const inProgress = activities.filter(
      a => a.actual_start !== null && a.actual_end === null
    ).length;

    const completed = activities.filter(a => a.actual_end !== null).length;
    const pending = activities.filter(a => a.actual_start === null).length;

    return {
      total: activities.length,
      completed,
      inProgress,
      pending,
      progressPercentage,
    };
  }, [activities]);

  return { stats, loading };
}
