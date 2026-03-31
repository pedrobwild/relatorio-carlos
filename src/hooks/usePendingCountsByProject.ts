import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Fetches a map of project_id → pending_count for all accessible projects.
 * Lightweight query used in the project switcher to indicate which projects need attention.
 */
export function usePendingCountsByProject() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-counts-by-project', user?.id],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('pending_items')
        .select('project_id')
        .eq('status', 'pending');

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const item of data || []) {
        if (item.project_id) {
          counts.set(item.project_id, (counts.get(item.project_id) || 0) + 1);
        }
      }
      return counts;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}
