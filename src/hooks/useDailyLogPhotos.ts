/**
 * useDailyLogPhotos — fotos do RDO do dia (staff-only).
 *
 * Segue o mesmo padrão do useStagePhotos: signed URLs (TTL 1h) com
 * refetch a cada 45 min para não expirar em abas ociosas. Bucket
 * privado `daily-log-photos`, MIME validado via filesRepo.validateFile.
 *
 * O log do dia pode ainda não existir no primeiro upload — nesse caso
 * fazemos upsert de um log stub antes de gravar as fotos, aproveitando
 * o unique (project_id, log_date).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { validateFile, sanitizeFilename } from "@/infra/repositories/files.repository";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

const BUCKET = "daily-log-photos";

export interface DailyLogPhoto {
  id: string;
  daily_log_id: string;
  project_id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  uploaded_by: string | null;
  created_at: string;
  url?: string;
}

async function ensureDailyLogId(
  projectId: string,
  logDate: string,
): Promise<string> {
  const { data: existing, error } = await supabase
    .from("project_daily_logs")
    .select("id")
    .eq("project_id", projectId)
    .eq("log_date", logDate)
    .maybeSingle();
  if (error) throw error;
  if (existing?.id) return existing.id;

  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id ?? null;
  const { data: inserted, error: insErr } = await supabase
    .from("project_daily_logs")
    .upsert(
      {
        project_id: projectId,
        log_date: logDate,
        ...(uid ? { created_by: uid, updated_by: uid } : {}),
      } as never,
      { onConflict: "project_id,log_date" },
    )
    .select("id")
    .single();
  if (insErr) throw insErr;
  return inserted.id;
}

export function useDailyLogPhotos(
  projectId: string | null,
  logDate: string,
) {
  const qc = useQueryClient();
  const key = queryKeys.diario.photos(projectId ?? undefined, logDate);

  const photosQ = useQuery({
    queryKey: key,
    enabled: !!projectId,
    staleTime: 60_000,
    refetchInterval: 45 * 60 * 1000,
    queryFn: async (): Promise<DailyLogPhoto[]> => {
      if (!projectId) return [];
      // Log pode não existir ainda — nesse caso não há fotos.
      const { data: log } = await supabase
        .from("project_daily_logs")
        .select("id")
        .eq("project_id", projectId)
        .eq("log_date", logDate)
        .maybeSingle();
      if (!log?.id) return [];

      const { data, error } = await supabase
        .from("project_daily_log_photos")
        .select(
          "id, daily_log_id, project_id, storage_path, caption, sort_order, uploaded_by, created_at",
        )
        .eq("daily_log_id", log.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      const withUrls = await Promise.allSettled(
        (data ?? []).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: signed?.signedUrl ?? "" } as DailyLogPhoto;
        }),
      );
      return withUrls
        .filter(
          (r): r is PromiseFulfilledResult<DailyLogPhoto> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!projectId) throw new Error("projectId requerido");
      for (const f of files) {
        const v = validateFile(f);
        if (!v.valid) throw new Error(v.error ?? "Arquivo inválido");
        if (!f.type.startsWith("image/")) {
          throw new Error("Só imagens são aceitas nas fotos do dia");
        }
      }

      const dailyLogId = await ensureDailyLogId(projectId, logDate);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const existing = photosQ.data ?? [];
      let cursor = existing.length;
      for (const file of files) {
        const safe = sanitizeFilename(file.name);
        const path = `${projectId}/${logDate}/${crypto.randomUUID()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;

        const { error: insErr } = await supabase
          .from("project_daily_log_photos")
          .insert({
            daily_log_id: dailyLogId,
            project_id: projectId,
            storage_path: path,
            caption: null,
            sort_order: cursor,
            uploaded_by: user.id,
          } as never);
        if (insErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw insErr;
        }
        cursor += 1;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Fotos enviadas");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar fotos");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photo: DailyLogPhoto) => {
      await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      const { error } = await supabase
        .from("project_daily_log_photos")
        .delete()
        .eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Foto removida");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    },
  });

  return {
    photos: photosQ.data ?? [],
    isLoading: photosQ.isLoading,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
