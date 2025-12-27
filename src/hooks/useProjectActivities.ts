import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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

export function useProjectActivities(projectId: string | undefined) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!projectId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('project_activities')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;

      setActivities(data || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Erro ao carregar atividades');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const saveActivities = async (newActivities: ActivityInput[]) => {
    if (!projectId || !user) {
      toast.error('Projeto ou usuário não encontrado');
      return false;
    }

    try {
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

      await fetchActivities();
      toast.success('Cronograma salvo com sucesso!');
      return true;
    } catch (err) {
      console.error('Error saving activities:', err);
      toast.error('Erro ao salvar cronograma');
      return false;
    }
  };

  const updateActivity = async (activityId: string, updates: Partial<ActivityInput>) => {
    try {
      const { error: updateError } = await supabase
        .from('project_activities')
        .update(updates)
        .eq('id', activityId);

      if (updateError) throw updateError;

      await fetchActivities();
      return true;
    } catch (err) {
      console.error('Error updating activity:', err);
      toast.error('Erro ao atualizar atividade');
      return false;
    }
  };

  const saveBaseline = async () => {
    if (!projectId) {
      toast.error('Projeto não encontrado');
      return false;
    }

    try {
      // Update all activities with current planned dates as baseline
      const { error: updateError } = await supabase
        .from('project_activities')
        .update({
          baseline_start: supabase.rpc ? undefined : undefined, // Placeholder
          baseline_saved_at: new Date().toISOString(),
        })
        .eq('project_id', projectId);

      // Use raw update for each activity to set baseline from planned
      for (const activity of activities) {
        await supabase
          .from('project_activities')
          .update({
            baseline_start: activity.planned_start,
            baseline_end: activity.planned_end,
            baseline_saved_at: new Date().toISOString(),
          })
          .eq('id', activity.id);
      }

      await fetchActivities();
      toast.success('Baseline salvo com sucesso!');
      return true;
    } catch (err) {
      console.error('Error saving baseline:', err);
      toast.error('Erro ao salvar baseline');
      return false;
    }
  };

  const clearBaseline = async () => {
    if (!projectId) {
      toast.error('Projeto não encontrado');
      return false;
    }

    try {
      const { error: updateError } = await supabase
        .from('project_activities')
        .update({
          baseline_start: null,
          baseline_end: null,
          baseline_saved_at: null,
        })
        .eq('project_id', projectId);

      if (updateError) throw updateError;

      await fetchActivities();
      toast.success('Baseline removido');
      return true;
    } catch (err) {
      console.error('Error clearing baseline:', err);
      toast.error('Erro ao remover baseline');
      return false;
    }
  };

  const hasBaseline = activities.some(a => a.baseline_saved_at !== null);

  return {
    activities,
    loading,
    error,
    refetch: fetchActivities,
    saveActivities,
    updateActivity,
    saveBaseline,
    clearBaseline,
    hasBaseline,
  };
}
