import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export interface TemplateActivity {
  description: string;
  durationDays: number;
  weight: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  is_project_phase: boolean;
  default_activities: TemplateActivity[] | null;
  default_contract_value: number | null;
  category: string | null;
  usage_count: number;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CreateTemplateInput {
  name: string;
  description?: string;
  is_project_phase: boolean;
  default_activities?: any[];
  default_contract_value?: number | null;
  category?: string;
}

export function useProjectTemplates() {
  return useQuery({
    queryKey: queryKeys.projectTemplates.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as unknown as ProjectTemplate[];
    },
  });
}

export function useCreateProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('project_templates')
        .insert({
          ...input,
          default_activities: input.default_activities ?? [],
          created_by: user.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projectTemplates.all }),
  });
}

export function useUpdateProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateTemplateInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('project_templates')
        .update(input as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projectTemplates.all }),
  });
}

export function useDeleteProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projectTemplates.all }),
  });
}
