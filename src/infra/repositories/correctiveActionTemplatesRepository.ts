import { supabase } from "@/integrations/supabase/client";

export interface CorrectiveActionTemplate {
  id: string;
  category: string;
  title: string;
  template_text: string;
  is_active: boolean;
  created_at: string;
}

export async function getTemplates(): Promise<CorrectiveActionTemplate[]> {
  const { data, error } = await supabase
    .from("corrective_action_templates")
    .select("*")
    .order("category")
    .order("title");
  if (error) throw error;
  return (data ?? []) as CorrectiveActionTemplate[];
}

export async function getActiveTemplatesByCategory(
  category: string,
): Promise<CorrectiveActionTemplate[]> {
  const { data, error } = await supabase
    .from("corrective_action_templates")
    .select("*")
    .eq("category", category)
    .eq("is_active", true)
    .order("title");
  if (error) throw error;
  return (data ?? []) as CorrectiveActionTemplate[];
}

export async function getAllActiveTemplates(): Promise<
  CorrectiveActionTemplate[]
> {
  const { data, error } = await supabase
    .from("corrective_action_templates")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("title");
  if (error) throw error;
  return (data ?? []) as CorrectiveActionTemplate[];
}

export async function createTemplate(params: {
  category: string;
  title: string;
  template_text: string;
}): Promise<CorrectiveActionTemplate> {
  const { data, error } = await supabase
    .from("corrective_action_templates")
    .insert(params)
    .select()
    .single();
  if (error) throw error;
  return data as CorrectiveActionTemplate;
}

export async function updateTemplate(params: {
  id: string;
  category?: string;
  title?: string;
  template_text?: string;
  is_active?: boolean;
}): Promise<void> {
  const { id, ...update } = params;
  const { error } = await supabase
    .from("corrective_action_templates")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("corrective_action_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
