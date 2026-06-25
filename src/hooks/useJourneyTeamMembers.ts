import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  resolveProjectDocumentPath,
  signProjectDocumentUrls,
} from "@/lib/projectDocumentUrl";

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
      const members = (data || []) as JourneyTeamMember[];
      // photo_url guarda o PATH no bucket privado — assina sob demanda p/ exibir.
      const signed = await signProjectDocumentUrls(
        members.map((m) => m.photo_url),
      );
      return members.map((m) => ({
        ...m,
        photo_url: m.photo_url ? (signed.get(m.photo_url) ?? m.photo_url) : null,
      }));
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
          // Persiste o PATH de storage, nunca uma URL (assinada/pública).
          photo_url: input.photo_url
            ? (resolveProjectDocumentPath(input.photo_url) ?? input.photo_url)
            : input.photo_url,
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
      // Nunca persiste uma URL em photo_url — normaliza para o PATH de storage.
      if ("photo_url" in updates) {
        updates.photo_url = updates.photo_url
          ? (resolveProjectDocumentPath(updates.photo_url) ?? updates.photo_url)
          : updates.photo_url;
      }
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

      // Bucket privado: devolve uma signed URL para preview imediato. O path é
      // persistido (normalizado no insert/update) e re-assinado na leitura.
      const { data: signed } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(filePath, 60 * 60);

      return signed?.signedUrl ?? filePath;
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
