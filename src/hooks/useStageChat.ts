import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StageMessage {
  id: string;
  stage_id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  message: string;
  created_at: string;
}

export function useStageChat(stageId: string, projectId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["stage-chat", stageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_stage_messages")
        .select("*")
        .eq("stage_id", stageId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as StageMessage[];
    },
    enabled: !!stageId,
  });

  // Realtime subscription — use stable key reference via closure over stageId
  useEffect(() => {
    if (!stageId) return;
    const key = ["stage-chat", stageId];
    const channel = supabase
      .channel(`stage-chat-${stageId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "journey_stage_messages",
          filter: `stage_id=eq.${stageId}`,
        },
        (payload) => {
          qc.setQueryData<StageMessage[]>(key, (old) => {
            const newMsg = payload.new as StageMessage;
            // Deduplicate: realtime may fire after optimistic or refetch
            if (old?.some((m) => m.id === newMsg.id)) return old;
            return [...(old || []), newMsg];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stageId, qc]);

  const sendMessage = useMutation({
    mutationFn: async ({
      message,
      authorName,
      authorRole,
    }: {
      message: string;
      authorName: string;
      authorRole: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("journey_stage_messages").insert({
        stage_id: stageId,
        project_id: projectId,
        author_id: user.id,
        author_name: authorName,
        author_role: authorRole,
        message,
      });
      if (error) throw error;
    },
  });

  return {
    messages: query.data || [],
    isLoading: query.isLoading,
    sendMessage,
  };
}
