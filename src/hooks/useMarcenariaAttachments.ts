/**
 * Hook de anexos de itens de marcenaria
 * -----------------------------------------------------------
 * Anexos são arquivos (projeto executivo em PDF, orçamentos,
 * imagens de referência, DWGs) vinculados a um `marcenaria_items`.
 *
 * - Bucket privado: `marcenaria-attachments`
 * - Path: `<project_id>/<item_id>/<uuid>.<ext>`
 * - URLs assinadas por 1 hora, com fallback para URL pública.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarcenariaAttachment {
  id: string;
  item_id: string;
  project_id: string;
  storage_path: string;
  caption: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  url?: string;
}

const BUCKET = "marcenaria-attachments";
const TABLE = "marcenaria_attachments";

export function marcenariaAttachmentsKey(itemId: string | undefined) {
  return ["marcenaria-attachments", itemId] as const;
}

export function useMarcenariaAttachments(
  itemId: string | undefined,
  projectId: string | undefined
) {
  const qc = useQueryClient();
  const queryKey = marcenariaAttachmentsKey(itemId);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<MarcenariaAttachment[]> => {
      if (!itemId) return [];

      const { data, error } = await supabase
        .from(TABLE as never)
        .select("*")
        .eq("item_id", itemId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as unknown as MarcenariaAttachment[];

      // URLs assinadas em paralelo (1h) com fallback para URL pública
      const results = await Promise.allSettled(
        rows.map(async (att) => {
          try {
            const { data: signed, error: signedErr } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(att.storage_path, 3600);

            let url = signed?.signedUrl;

            if (!url || signedErr) {
              const { data: pub } = supabase.storage
                .from(BUCKET)
                .getPublicUrl(att.storage_path);
              url = pub?.publicUrl || undefined;
            }

            return { ...att, url } as MarcenariaAttachment;
          } catch {
            const { data: pub } = supabase.storage
              .from(BUCKET)
              .getPublicUrl(att.storage_path);
            return {
              ...att,
              url: pub?.publicUrl || undefined,
            } as MarcenariaAttachment;
          }
        })
      );

      return results
        .filter(
          (r): r is PromiseFulfilledResult<MarcenariaAttachment> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value);
    },
    enabled: !!itemId,
    staleTime: 2 * 60 * 1000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!itemId || !projectId) {
        throw new Error("Item ou projeto não identificado");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const uploaded: MarcenariaAttachment[] = [];
      for (const file of files) {
        const ext = file.name.includes(".")
          ? file.name.split(".").pop()
          : "bin";
        const path = `${projectId}/${itemId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data: row, error: insertError } = await supabase
          .from(TABLE as never)
          .insert({
            item_id: itemId,
            project_id: projectId,
            storage_path: path,
            caption: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
            uploaded_by: user.id,
          } as never)
          .select()
          .single();

        if (insertError) throw insertError;
        uploaded.push(row as unknown as MarcenariaAttachment);
      }
      return uploaded;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Anexo enviado");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Erro ao enviar anexo";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (att: MarcenariaAttachment) => {
      // Remove do storage (best-effort) e depois do metadata
      await supabase.storage.from(BUCKET).remove([att.storage_path]);
      const { error } = await supabase
        .from(TABLE as never)
        .delete()
        .eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Anexo removido");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Erro ao remover anexo";
      toast.error(message);
    },
  });

  return {
    attachments,
    isLoading,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
