import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { Json } from "@/integrations/supabase/types";

export interface TemplateActivity {
  description: string;
  durationDays: number;
  weight: number;
}

export interface TemplateCustomField {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  required?: boolean;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  is_project_phase: boolean;
  default_activities: TemplateActivity[] | null;
  default_contract_value: number | null;
  category: string | null;
  custom_fields: TemplateCustomField[] | null;
  usage_count: number;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  name: string;
  description: string | null;
  is_project_phase: boolean;
  default_activities: TemplateActivity[] | null;
  default_contract_value: number | null;
  category: string | null;
  custom_fields: TemplateCustomField[] | null;
  created_by: string;
  created_at: string;
}

interface CreateTemplateInput {
  name: string;
  description?: string;
  is_project_phase: boolean;
  default_activities?: TemplateActivity[];
  default_contract_value?: number | null;
  category?: string;
  custom_fields?: TemplateCustomField[];
}

export function useProjectTemplates() {
  return useQuery({
    queryKey: queryKeys.projectTemplates.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_templates")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as unknown as ProjectTemplate[];
    },
  });
}

export function useTemplateVersions(templateId: string | null) {
  return useQuery({
    queryKey: ["template-versions", templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from("project_template_versions")
        .select("*")
        .eq("template_id", templateId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data as unknown as TemplateVersion[];
    },
    enabled: !!templateId,
  });
}

export function useRestoreTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      version,
    }: {
      templateId: string;
      version: TemplateVersion;
    }) => {
      const { data, error } = await supabase
        .from("project_templates")
        .update({
          name: version.name,
          description: version.description,
          is_project_phase: version.is_project_phase,
          default_activities: (version.default_activities ??
            []) as unknown as Json,
          default_contract_value: version.default_contract_value,
          category: version.category,
          custom_fields: (version.custom_fields ?? []) as unknown as Json,
        })
        .eq("id", templateId)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectTemplate;
    },
    onSuccess: (_, { templateId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.projectTemplates.all });
      qc.invalidateQueries({ queryKey: ["template-versions", templateId] });
    },
  });
}

export function useCreateProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("project_templates")
        .insert({
          name: input.name,
          description: input.description ?? null,
          is_project_phase: input.is_project_phase,
          default_activities: (input.default_activities ??
            []) as unknown as Json,
          default_contract_value: input.default_contract_value ?? null,
          category: input.category ?? null,
          custom_fields: (input.custom_fields ?? []) as unknown as Json,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectTemplate;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.projectTemplates.all }),
  });
}

export function useUpdateProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CreateTemplateInput> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.is_project_phase !== undefined)
        updateData.is_project_phase = input.is_project_phase;
      if (input.default_activities !== undefined)
        updateData.default_activities =
          input.default_activities as unknown as Json;
      if (input.default_contract_value !== undefined)
        updateData.default_contract_value = input.default_contract_value;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.custom_fields !== undefined)
        updateData.custom_fields = input.custom_fields as unknown as Json;

      const { data, error } = await supabase
        .from("project_templates")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectTemplate;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.projectTemplates.all }),
  });
}

export function useDeleteProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.projectTemplates.all }),
  });
}
