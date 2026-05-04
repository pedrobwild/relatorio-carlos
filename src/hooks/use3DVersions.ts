import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Version3D {
  id: string;
  project_id: string;
  stage_key: string;
  version_number: number;
  created_at: string;
  created_by: string;
  revision_requested_at: string | null;
  revision_requested_by: string | null;
  images: Image3D[];
}

export interface Image3D {
  id: string;
  version_id: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
  url?: string;
}

export interface Comment3D {
  id: string;
  image_id: string;
  author_user_id: string;
  author_name?: string;
  text: string;
  x_percent: number;
  y_percent: number;
  created_at: string;
  updated_at: string;
}

const BUCKET = "project-documents";
const MAX_FILES_PER_VERSION = 30;

export function queryKeys3D(projectId: string | undefined) {
  return {
    versions: ["3d-versions", projectId] as const,
    images: (versionId: string) => ["3d-images", versionId] as const,
    comments: (imageId: string) => ["3d-comments", imageId] as const,
  };
}

/**
 * Validates files before upload: PNG only, size limit, count limit.
 */
function validateFiles(files: File[]): string | null {
  if (files.length === 0) return "Selecione ao menos uma imagem.";
  if (files.length > MAX_FILES_PER_VERSION)
    return `Máximo de ${MAX_FILES_PER_VERSION} imagens por versão.`;

  for (const file of files) {
    // Accept .png extension OR image/png MIME (some systems set wrong MIME)
    const isPngExt = file.name.toLowerCase().endsWith(".png");
    const isPngMime = file.type === "image/png";
    if (!isPngExt && !isPngMime) {
      return `Arquivo "${file.name}" não é PNG. Apenas .png é aceito.`;
    }
    if (file.size === 0) {
      return `Arquivo "${file.name}" está vazio.`;
    }
  }
  return null;
}

export function use3DVersions(projectId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const keys = queryKeys3D(projectId);

  const versionsQuery = useQuery({
    queryKey: keys.versions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_3d_versions")
        .select("*")
        .eq("project_id", projectId!)
        .eq("stage_key", "projeto_3d")
        .order("version_number", { ascending: false });
      if (error) throw error;
      return (data || []).map((v: any) => ({
        ...v,
        images: [],
      })) as Version3D[];
    },
    enabled: !!projectId && !!user,
  });

  const createVersionMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!projectId || !user) throw new Error("Missing context");

      const validationErr = validateFiles(files);
      if (validationErr) throw new Error(validationErr);

      // 1. Get next version number (DB unique constraint protects against races)
      const { data: existing } = await supabase
        .from("project_3d_versions")
        .select("version_number")
        .eq("project_id", projectId)
        .eq("stage_key", "projeto_3d")
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = (existing?.[0]?.version_number ?? 0) + 1;

      // 2. Create version record
      const { data: version, error: vErr } = await supabase
        .from("project_3d_versions")
        .insert({
          project_id: projectId,
          stage_key: "projeto_3d",
          version_number: nextVersion,
          created_by: user.id,
        })
        .select()
        .single();

      if (vErr) {
        // Race condition: retry with incremented number
        if (vErr.code === "23505") {
          throw new Error("Conflito de versão. Tente novamente.");
        }
        throw vErr;
      }

      // 3. Upload files and create image records; cleanup on failure
      const uploadedPaths: string[] = [];
      try {
        const imageInserts: Array<{
          version_id: string;
          storage_path: string;
          sort_order: number;
        }> = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const storagePath = `projects/${projectId}/3d/${version.id}/${Date.now()}_${i}.png`;

          const { error: uploadErr } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, file, { contentType: "image/png" });

          if (uploadErr) throw uploadErr;
          uploadedPaths.push(storagePath);

          imageInserts.push({
            version_id: version.id,
            storage_path: storagePath,
            sort_order: i,
          });
        }

        if (imageInserts.length > 0) {
          const { error: imgErr } = await supabase
            .from("project_3d_images")
            .insert(imageInserts);
          if (imgErr) throw imgErr;
        }
      } catch (uploadError) {
        // Cleanup: remove uploaded files
        if (uploadedPaths.length > 0) {
          try {
            await supabase.storage.from(BUCKET).remove(uploadedPaths);
          } catch {
            /* ignore cleanup failure */
          }
        }
        // Cleanup: remove orphan version record
        try {
          await supabase
            .from("project_3d_versions")
            .delete()
            .eq("id", version.id);
        } catch {
          /* ignore cleanup failure */
        }
        throw uploadError;
      }

      return version;
    },
    onSuccess: () => {
      toast.success("Versão criada com sucesso");
      qc.invalidateQueries({ queryKey: keys.versions });
    },
    onError: (err: any) => {
      console.error("[3D Versions] Upload error:", err);
      toast.error(err?.message || "Erro ao criar versão");
    },
  });

  return {
    versions: versionsQuery.data ?? [],
    loading: versionsQuery.isLoading,
    createVersion: createVersionMutation.mutateAsync,
    isCreating: createVersionMutation.isPending,
    refetch: versionsQuery.refetch,
  };
}

export function use3DImages(versionId: string | undefined) {
  const keys = queryKeys3D(undefined);

  return useQuery({
    queryKey: keys.images(versionId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_3d_images")
        .select("*")
        .eq("version_id", versionId!)
        .order("sort_order");
      if (error) throw error;

      // Bucket is private — use signed URLs
      const paths = (data || []).map((img: any) => img.storage_path as string);
      const { data: signedUrls, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, 3600); // 1 hour

      const urlMap = new Map<string, string>();
      if (!signError && signedUrls) {
        signedUrls.forEach((item) => {
          if (item.signedUrl) urlMap.set(item.path ?? "", item.signedUrl);
        });
      }

      const images: Image3D[] = (data || []).map((img: any) => ({
        ...img,
        url: urlMap.get(img.storage_path) ?? "",
      }));

      return images;
    },
    enabled: !!versionId,
    staleTime: 5 * 60 * 1000,
  });
}

export function use3DComments(imageId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const keys = queryKeys3D(undefined);

  const commentsQuery = useQuery({
    queryKey: keys.comments(imageId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_3d_comments")
        .select("*")
        .eq("image_id", imageId!)
        .order("created_at");
      if (error) throw error;

      const userIds = [
        ...new Set((data || []).map((c: any) => c.author_user_id)),
      ];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        profileMap = Object.fromEntries(
          (profiles || []).map((p: any) => [
            p.user_id,
            p.display_name || "Usuário",
          ]),
        );
      }

      return (data || []).map((c: any) => ({
        ...c,
        x_percent: Number(c.x_percent),
        y_percent: Number(c.y_percent),
        author_name: profileMap[c.author_user_id] || "Usuário",
      })) as Comment3D[];
    },
    enabled: !!imageId,
  });

  const addComment = useMutation({
    mutationFn: async (params: {
      imageId: string;
      text: string;
      x: number;
      y: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("project_3d_comments").insert({
        image_id: params.imageId,
        author_user_id: user.id,
        text: params.text,
        x_percent: clamp(params.x),
        y_percent: clamp(params.y),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (imageId) qc.invalidateQueries({ queryKey: keys.comments(imageId) });
    },
    onError: () => toast.error("Erro ao salvar comentário"),
  });

  const updateComment = useMutation({
    mutationFn: async (params: { commentId: string; x: number; y: number }) => {
      const { error } = await supabase
        .from("project_3d_comments")
        .update({
          x_percent: clamp(params.x),
          y_percent: clamp(params.y),
        })
        .eq("id", params.commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (imageId) qc.invalidateQueries({ queryKey: keys.comments(imageId) });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("project_3d_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (imageId) qc.invalidateQueries({ queryKey: keys.comments(imageId) });
      toast.success("Comentário removido");
    },
    onError: () => toast.error("Erro ao remover comentário"),
  });

  return {
    comments: commentsQuery.data ?? [],
    loading: commentsQuery.isLoading,
    addComment: addComment.mutateAsync,
    updateComment: updateComment.mutateAsync,
    deleteComment: deleteComment.mutateAsync,
  };
}

/** Clamp value between 0 and 100 */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
