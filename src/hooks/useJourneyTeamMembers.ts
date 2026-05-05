import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface JourneyTeamMember {
  id: string;
  project_id: string;
  display_name: string;
  role_title: string;
  description: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type JourneyTeamMemberInput = Pick<
  JourneyTeamMember,
  | "project_id"
  | "display_name"
  | "role_title"
  | "description"
  | "email"
  | "phone"
  | "photo_url"
> & { stage_context?: string };

export function useJourneyTeamMembers(
  projectId: string | undefined,
  stageContext: string = "welcome",
) {
  const queryClient = useQueryClient();
  const queryKey = ["journey-team-members", projectId, stageContext];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("journey_team_members")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage_context", stageContext)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as JourneyTeamMember[];
    },
    enabled: !!projectId,
  });

  const addMember = useMutation({
    mutationFn: async (input: JourneyTeamMemberInput) => {
      // Get next sort_order
      const { data: existing } = await supabase
        .from("journey_team_members")
        .select("sort_order")
        .eq("project_id", input.project_id)
        .order("sort_order", { ascending: false })
        .limit(1);

      const sortOrder =
        existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      const { data, error } = await supabase
        .from("journey_team_members")
        .insert({
          ...input,
          sort_order: sortOrder,
          stage_context: input.stage_context || stageContext,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Membro adicionado com sucesso");
    },
    onError: () => toast.error("Erro ao adicionar membro"),
  });

  const updateMember = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<JourneyTeamMember> & { id: string }) => {
      const { data, error } = await supabase
        .from("journey_team_members")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Membro atualizado");
    },
    onError: () => toast.error("Erro ao atualizar membro"),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("journey_team_members")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Membro removido");
    },
    onError: () => toast.error("Erro ao remover membro"),
  });

  const uploadPhoto = useMutation({
    mutationFn: async ({
      file,
      memberId: _memberId,
    }: {
      file: File;
      memberId?: string;
    }) => {
      if (!projectId) throw new Error("Project ID required");
      const fileExt = file.name.split(".").pop();
      const filePath = `team-photos/${projectId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("project-documents").getPublicUrl(filePath);

      return publicUrl;
    },
    onError: () => toast.error("Erro ao enviar foto"),
  });

  return {
    members: query.data || [],
    isLoading: query.isLoading,
    addMember: addMember.mutateAsync,
    updateMember: updateMember.mutateAsync,
    removeMember: removeMember.mutateAsync,
    uploadPhoto: uploadPhoto.mutateAsync,
    isAdding: addMember.isPending,
    isUpdating: updateMember.isPending,
    isUploading: uploadPhoto.isPending,
  };
}
