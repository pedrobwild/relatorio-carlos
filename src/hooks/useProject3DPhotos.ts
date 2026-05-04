import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Project3DPhoto {
  id: string;
  project_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string;
  sort_order: number;
  created_at: string;
  url?: string;
}

const BUCKET = "project-3d-photos";

export function useProject3DPhotos(projectId: string | undefined) {
  const qc = useQueryClient();
  const queryKey = ["project-3d-photos", projectId];

  const { data: photos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_3d_photos")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;

      const withUrls = await Promise.allSettled(
        (data || []).map(async (photo) => {
          const { data: urlData } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(photo.storage_path, 3600);
          return { ...photo, url: urlData?.signedUrl || "" } as Project3DPhoto;
        }),
      );

      return withUrls
        .filter(
          (r): r is PromiseFulfilledResult<Project3DPhoto> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!projectId) throw new Error("Projeto inválido");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const uploaded: Project3DPhoto[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${projectId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: row, error: insertError } = await supabase
          .from("project_3d_photos")
          .insert({
            project_id: projectId,
            uploaded_by: user.id,
            storage_path: path,
            caption: "",
            sort_order: photos.length + uploaded.length,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        uploaded.push(row as Project3DPhoto);
      }
      return uploaded;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Fotos enviadas com sucesso!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar fotos");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photo: Project3DPhoto) => {
      await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      const { error } = await supabase
        .from("project_3d_photos")
        .delete()
        .eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Foto removida");
    },
    onError: () => {
      toast.error("Erro ao remover foto");
    },
  });

  const updateCaptionMutation = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const { error } = await supabase
        .from("project_3d_photos")
        .update({ caption })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  return {
    photos,
    isLoading,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deletePhoto: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    updateCaption: updateCaptionMutation.mutate,
  };
}
