import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PageInstruction {
  id: string;
  project_id: string;
  page_key: string;
  content_html: string;
  updated_at: string;
}

export function usePageInstructions(
  projectId: string | undefined,
  pageKey: string,
) {
  const [instruction, setInstruction] = useState<PageInstruction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data, error } = await supabase
        .from("project_page_instructions")
        .select("*")
        .eq("project_id", projectId)
        .eq("page_key", pageKey)
        .maybeSingle();

      if (error) console.warn("[PageInstructions] fetch error:", error.message);
      setInstruction(data as PageInstruction | null);
      setLoading(false);
    };

    fetch();
  }, [projectId, pageKey]);

  const save = useCallback(
    async (html: string) => {
      if (!projectId) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("project_page_instructions")
        .upsert(
          {
            project_id: projectId,
            page_key: pageKey,
            content_html: html,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,page_key" },
        )
        .select()
        .single();

      if (error) {
        console.error("[PageInstructions] save error:", error);
        toast.error("Erro ao salvar instruções");
        return;
      }

      setInstruction(data as PageInstruction);
      toast.success("Instruções salvas");
    },
    [projectId, pageKey],
  );

  return { instruction, loading, save };
}
