import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NonConformity } from '@/hooks/useNonConformities';

export type NonConformityWithProject = NonConformity & {
  project_name?: string | null;
};

export function useAllNonConformities() {
  const query = useQuery({
    queryKey: ['non-conformities', 'global'],
    queryFn: async (): Promise<{ ncs: NonConformityWithProject[]; projects: { id: string; name: string }[] }> => {
      const [ncsResult, profilesResult, projectsResult] = await Promise.all([
        supabase
          .from('non_conformities')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('users_profile')
          .select('id, nome'),
        supabase
          .from('projects')
          .select('id, name')
          .is('deleted_at', null),
      ]);

      if (ncsResult.error) throw ncsResult.error;

      const nameMap: Record<string, string> = {};
      if (profilesResult.data) {
        profilesResult.data.forEach(p => { nameMap[p.id] = p.nome; });
      }

      const projectMap: Record<string, string> = {};
      const projectList: { id: string; name: string }[] = [];
      if (projectsResult.data) {
        projectsResult.data.forEach(p => {
          projectMap[p.id] = p.name;
        });
      }

      const ncs = (ncsResult.data ?? []).map(nc => ({
        ...nc,
        responsible_user_name: nc.responsible_user_id ? nameMap[nc.responsible_user_id] ?? null : null,
        project_name: projectMap[nc.project_id] ?? null,
      })) as NonConformityWithProject[];

      // Only include projects that have NCs
      const projectIdsWithNcs = new Set(ncs.map(nc => nc.project_id));
      const projects = (projectsResult.data ?? [])
        .filter(p => projectIdsWithNcs.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name));

      return { ncs, projects };
    },
    staleTime: 30_000,
  });

  return {
    data: query.data?.ncs ?? [],
    projects: query.data?.projects ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
