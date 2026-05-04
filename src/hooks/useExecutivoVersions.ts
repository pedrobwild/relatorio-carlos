import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const BUCKET = "project-documents";
const STAGE_KEY = "projeto_executivo";

export interface ExecutivoVersion {
  id: string;
  project_id: string;
  stage_key: string;
  version_number: number;
  created_at: string;
  created_by: string;
  revision_requested_at: string | null;
  revision_requested_by: string | null;
}

export interface ExecutivoFile {
  id: string;
  version_id: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
  url?: string;
}

export interface ExecutivoComment {
  id: string;
  image_id: string;
  author_user_id: string;
  author_name?: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export function executivoQueryKeys(projectId: string | undefined) {
  return {
    versions: ["executivo-versions", projectId] as const,
    file: (versionId: string) => ["executivo-file", versionId] as const,
    comments: (fileId: string) => ["executivo-comments", fileId] as const,
  };
}

export function useExecutivoVersions(projectId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const keys = executivoQueryKeys(projectId);

  const versionsQuery = useQuery({
    queryKey: keys.versions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_3d_versions")
        .select("*")
        .eq("project_id", projectId!)
        .eq("stage_key", STAGE_KEY)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return (data || []) as ExecutivoVersion[];
    },
    enabled: !!projectId && !!user,
  });

  const createVersionMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!projectId || !user) throw new Error("Missing context");

      if (
        !file.name.toLowerCase().endsWith(".pdf") &&
        file.type !== "application/pdf"
      ) {
        throw new Error("Apenas arquivos PDF são aceitos.");
      }
      if (file.size === 0) throw new Error("Arquivo está vazio.");

      // Get next version number
      const { data: existing } = await supabase
        .from("project_3d_versions")
        .select("version_number")
        .eq("project_id", projectId)
        .eq("stage_key", STAGE_KEY)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = (existing?.[0]?.version_number ?? 0) + 1;

      // Create version record
      const { data: version, error: vErr } = await supabase
        .from("project_3d_versions")
        .insert({
          project_id: projectId,
          stage_key: STAGE_KEY,
          version_number: nextVersion,
          created_by: user.id,
        })
        .select()
        .single();

      if (vErr) {
        if (vErr.code === "23505")
          throw new Error("Conflito de versão. Tente novamente.");
        throw vErr;
      }

      // Upload PDF
      const storagePath = `projects/${projectId}/executivo/${version.id}/${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: "application/pdf" });

      if (uploadErr) {
        try {
          await supabase
            .from("project_3d_versions")
            .delete()
            .eq("id", version.id);
        } catch {
          /* ignore cleanup failure */
        }
        throw uploadErr;
      }

      // Create file record
      const { error: imgErr } = await supabase
        .from("project_3d_images")
        .insert({
          version_id: version.id,
          storage_path: storagePath,
          sort_order: 0,
        });

      if (imgErr) {
        try {
          await supabase.storage.from(BUCKET).remove([storagePath]);
        } catch {
          /* ignore cleanup failure */
        }
        try {
          await supabase
            .from("project_3d_versions")
            .delete()
            .eq("id", version.id);
        } catch {
          /* ignore cleanup failure */
        }
        throw imgErr;
      }

      return version;
    },
    onSuccess: () => {
      toast.success("Versão criada com sucesso");
      qc.invalidateQueries({ queryKey: keys.versions });
    },
    onError: (err: any) => {
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

export function useExecutivoFile(versionId: string | undefined) {
  return useQuery({
    queryKey: executivoQueryKeys(undefined).file(versionId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_3d_images")
        .select("*")
        .eq("version_id", versionId!)
        .order("sort_order")
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const file = data[0];
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(file.storage_path, 3600);
      if (signErr) throw signErr;
      return { ...file, url: signed?.signedUrl } as ExecutivoFile;
    },
    enabled: !!versionId,
    staleTime: 50 * 60 * 1000,
  });
}

export function useExecutivoComments(fileId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const keys = executivoQueryKeys(undefined);

  const commentsQuery = useQuery({
    queryKey: keys.comments(fileId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_3d_comments")
        .select("*")
        .eq("image_id", fileId!)
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
        author_name: profileMap[c.author_user_id] || "Usuário",
      })) as ExecutivoComment[];
    },
    enabled: !!fileId,
  });

  const addComment = useMutation({
    mutationFn: async (params: { fileId: string; text: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("project_3d_comments").insert({
        image_id: params.fileId,
        author_user_id: user.id,
        text: params.text,
        x_percent: 0,
        y_percent: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (fileId) qc.invalidateQueries({ queryKey: keys.comments(fileId) });
    },
    onError: () => toast.error("Erro ao salvar comentário"),
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
      if (fileId) qc.invalidateQueries({ queryKey: keys.comments(fileId) });
      toast.success("Comentário removido");
    },
    onError: () => toast.error("Erro ao remover comentário"),
  });

  return {
    comments: commentsQuery.data ?? [],
    loading: commentsQuery.isLoading,
    addComment: addComment.mutateAsync,
    deleteComment: deleteComment.mutateAsync,
  };
}
