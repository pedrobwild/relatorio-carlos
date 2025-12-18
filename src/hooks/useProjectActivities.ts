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
}

export interface ActivityInput {
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  weight: number;
  sort_order: number;
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

  return {
    activities,
    loading,
    error,
    refetch: fetchActivities,
    saveActivities,
    updateActivity,
  };
}
