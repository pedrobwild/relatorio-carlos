/**
 * useActivityPhotos — galeria de fotos de uma atividade do cronograma.
 *
 * Arquivos vivem no bucket privado `activity-photos` em paths
 *   "<project_id>/<activity_id>/<uuid>.<ext>"
 * A tabela `project_activity_photos` guarda apenas metadata.
 *
 * Para exibição, geramos signed URLs sob demanda (1h de validade).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BUCKET = 'activity-photos';
const TABLE = 'project_activity_photos' as never;
const SIGNED_URL_TTL = 60 * 60; // 1h

export interface ActivityPhoto {
  id: string;
  activity_id: string;
  project_id: string;
  storage_path: string;
  caption: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  /** Preenchido em runtime após signed URL fetch. */
  signed_url?: string;
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB (alinha com o bucket)

function activityPhotosKey(activityId: string | undefined) {
  return ['activity-photos', activityId] as const;
}

export function useActivityPhotos(
  activityId: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  const queryKey = activityPhotosKey(activityId);

  const query = useQuery({
    queryKey,
    enabled: !!activityId,
    queryFn: async (): Promise<ActivityPhoto[]> => {
      if (!activityId) return [];
      const { data, error } = await supabase
        .from(TABLE)
        .select(
          'id, activity_id, project_id, storage_path, caption, mime_type, size_bytes, width, height, uploaded_by, uploaded_at',
        )
        .eq('activity_id', activityId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as unknown as ActivityPhoto[];
      if (rows.length === 0) return rows;

      // Gera signed URLs em batch
      const paths = rows.map((r) => r.storage_path);
      const { data: signed, error: signedErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL);
      if (signedErr) {
        console.warn('[ActivityPhotos] signedUrls error', signedErr);
        return rows;
      }
      const urlByPath = new Map(signed?.map((s) => [s.path, s.signedUrl]) ?? []);
      return rows.map((r) => ({ ...r, signed_url: urlByPath.get(r.storage_path) ?? undefined }));
    },
    staleTime: SIGNED_URL_TTL * 1000 * 0.8,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const uploadPhotos = useMutation({
    mutationFn: async ({ files, caption }: { files: File[]; caption?: string }) => {
      if (!activityId || !projectId) throw new Error('Atividade não encontrada');
      if (files.length === 0) return [];

      const uploadedRows: ActivityPhoto[] = [];

      for (const file of files) {
        if (!ALLOWED_MIME.has(file.type)) {
          throw new Error(`Tipo não suportado: ${file.type || file.name}`);
        }
        if (file.size > MAX_SIZE) {
          throw new Error(`Arquivo "${file.name}" excede 15 MB`);
        }
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const path = `${projectId}/${activityId}/${fileName}`;

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        const { data: row, error: insErr } = await supabase
          .from(TABLE)
          .insert({
            activity_id: activityId,
            project_id: projectId,
            storage_path: path,
            caption: caption?.trim() || null,
            mime_type: file.type,
            size_bytes: file.size,
          } as never)
          .select()
          .single();

        if (insErr) {
          // Rollback do storage
          await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
          throw insErr;
        }
        uploadedRows.push(row as unknown as ActivityPhoto);
      }

      return uploadedRows;
    },
    onSuccess: (rows) => {
      if (rows.length > 0) {
        toast.success(
          rows.length === 1 ? 'Foto enviada' : `${rows.length} fotos enviadas`,
        );
      }
      invalidate();
    },
    onError: (err: Error) => {
      toast.error('Falha ao enviar foto', { description: err.message });
    },
  });

  const updateCaption = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string | null }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({ caption: caption?.trim() || null } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: ActivityPhoto) => {
      // Remove a metadata primeiro (RLS-safe), storage depois.
      const { error: dbErr } = await supabase.from(TABLE).delete().eq('id', photo.id);
      if (dbErr) throw dbErr;
      await supabase.storage.from(BUCKET).remove([photo.storage_path]).catch(() => {});
    },
    onSuccess: () => {
      toast.success('Foto removida');
      invalidate();
    },
    onError: (err: Error) => {
      toast.error('Não foi possível remover', { description: err.message });
    },
  });

  return {
    photos: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    uploadPhotos,
    updateCaption,
    deletePhoto,
  };
}
