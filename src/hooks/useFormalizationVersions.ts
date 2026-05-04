import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FormalizationVersion {
  id: string;
  formalization_id: string;
  version_number: number;
  title: string;
  summary: string;
  body_md: string;
  data: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export function useFormalizationVersions(formalizationId: string | undefined) {
  return useQuery({
    queryKey: ["formalization-versions", formalizationId],
    queryFn: async () => {
      if (!formalizationId) return [];

      const { data, error } = await supabase
        .from("formalization_versions")
        .select("*")
        .eq("formalization_id", formalizationId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return (data || []) as FormalizationVersion[];
    },
    enabled: !!formalizationId,
  });
}
