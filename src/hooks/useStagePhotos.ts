import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StagePhoto {
  id: string;
  stage_id: string;
  project_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string;
  sort_order: number;
  created_at: string;
  url?: string;
}

const BUCKET = "stage-photos";

export function useStagePhotos(stageId: string, projectId: string) {
  const qc = useQueryClient();
  const queryKey = ["stage-photos", stageId];

  const { data: photos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_stage_photos")
        .select("*")
        .eq("stage_id", stageId)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      // Generate signed URLs
      const withUrls = await Promise.allSettled(
        (data || []).map(async (photo) => {
          const { data: urlData } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(photo.storage_path, 3600);
          return { ...photo, url: urlData?.signedUrl || "" } as StagePhoto;
        }),
      );

      return withUrls
        .filter(
          (r): r is PromiseFulfilledResult<StagePhoto> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
    },
    enabled: !!stageId,
    staleTime: 60_000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const uploaded: StagePhoto[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${projectId}/${stageId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: row, error: insertError } = await supabase
          .from("journey_stage_photos")
          .insert({
            stage_id: stageId,
            project_id: projectId,
            uploaded_by: user.id,
            storage_path: path,
            caption: "",
            sort_order: photos.length + uploaded.length,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        uploaded.push(row as StagePhoto);
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
    mutationFn: async (photo: StagePhoto) => {
      await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      const { error } = await supabase
        .from("journey_stage_photos")
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
        .from("journey_stage_photos")
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
