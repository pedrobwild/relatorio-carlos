import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Version3D {
  id: string;
  project_id: string;
  stage_key: string;
  version_number: number;
  created_at: string;
  created_by: string;
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

const BUCKET = 'project-documents';

function queryKeys(projectId: string | undefined) {
  return {
    versions: ['3d-versions', projectId] as const,
    images: (versionId: string) => ['3d-images', versionId] as const,
    comments: (imageId: string) => ['3d-comments', imageId] as const,
  };
}

export function use3DVersions(projectId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const keys = queryKeys(projectId);

  const versionsQuery = useQuery({
    queryKey: keys.versions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_3d_versions')
        .select('*')
        .eq('project_id', projectId!)
        .eq('stage_key', 'projeto_3d')
        .order('version_number', { ascending: false });
      if (error) throw error;

      // For each version, get image count
      const versions: Version3D[] = (data || []).map((v: any) => ({
        ...v,
        images: [],
      }));

      return versions;
    },
    enabled: !!projectId && !!user,
  });

  const createVersionMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!projectId || !user) throw new Error('Missing context');

      // 1. Get next version number
      const { data: existing } = await supabase
        .from('project_3d_versions')
        .select('version_number')
        .eq('project_id', projectId)
        .eq('stage_key', 'projeto_3d')
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = (existing?.[0]?.version_number ?? 0) + 1;

      // 2. Create version record
      const { data: version, error: vErr } = await supabase
        .from('project_3d_versions')
        .insert({
          project_id: projectId,
          stage_key: 'projeto_3d',
          version_number: nextVersion,
          created_by: user.id,
        })
        .select()
        .single();

      if (vErr) throw vErr;

      // 3. Upload files and create image records
      const imageInserts = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storagePath = `projects/${projectId}/3d/${version.id}/${Date.now()}_${i}.png`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, { contentType: 'image/png' });

        if (uploadErr) throw uploadErr;

        imageInserts.push({
          version_id: version.id,
          storage_path: storagePath,
          sort_order: i,
        });
      }

      if (imageInserts.length > 0) {
        const { error: imgErr } = await supabase
          .from('project_3d_images')
          .insert(imageInserts);
        if (imgErr) throw imgErr;
      }

      return version;
    },
    onSuccess: () => {
      toast.success('Versão criada com sucesso');
      qc.invalidateQueries({ queryKey: keys.versions });
    },
    onError: (err: any) => {
      console.error('[3D Versions] Upload error:', err);
      toast.error('Erro ao criar versão');
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
  const keys = queryKeys(undefined);

  return useQuery({
    queryKey: keys.images(versionId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_3d_images')
        .select('*')
        .eq('version_id', versionId!)
        .order('sort_order');
      if (error) throw error;

      // Get signed URLs
      const images: Image3D[] = await Promise.all(
        (data || []).map(async (img: any) => {
          const { data: urlData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(img.storage_path);
          return { ...img, url: urlData?.publicUrl };
        })
      );

      return images;
    },
    enabled: !!versionId,
    staleTime: 5 * 60 * 1000,
  });
}

export function use3DComments(imageId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const keys = queryKeys(undefined);

  const commentsQuery = useQuery({
    queryKey: keys.comments(imageId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_3d_comments')
        .select('*')
        .eq('image_id', imageId!)
        .order('created_at');
      if (error) throw error;

      // Get author names
      const userIds = [...new Set((data || []).map((c: any) => c.author_user_id))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        profileMap = Object.fromEntries(
          (profiles || []).map((p: any) => [p.user_id, p.display_name || 'Usuário'])
        );
      }

      return (data || []).map((c: any) => ({
        ...c,
        x_percent: Number(c.x_percent),
        y_percent: Number(c.y_percent),
        author_name: profileMap[c.author_user_id] || 'Usuário',
      })) as Comment3D[];
    },
    enabled: !!imageId,
  });

  const addComment = useMutation({
    mutationFn: async (params: { imageId: string; text: string; x: number; y: number }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('project_3d_comments').insert({
        image_id: params.imageId,
        author_user_id: user.id,
        text: params.text,
        x_percent: Math.max(0, Math.min(100, params.x)),
        y_percent: Math.max(0, Math.min(100, params.y)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (imageId) qc.invalidateQueries({ queryKey: keys.comments(imageId) });
    },
    onError: () => toast.error('Erro ao salvar comentário'),
  });

  const updateComment = useMutation({
    mutationFn: async (params: { commentId: string; x: number; y: number }) => {
      const { error } = await supabase
        .from('project_3d_comments')
        .update({
          x_percent: Math.max(0, Math.min(100, params.x)),
          y_percent: Math.max(0, Math.min(100, params.y)),
        })
        .eq('id', params.commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (imageId) qc.invalidateQueries({ queryKey: keys.comments(imageId) });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('project_3d_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (imageId) qc.invalidateQueries({ queryKey: keys.comments(imageId) });
      toast.success('Comentário removido');
    },
    onError: () => toast.error('Erro ao remover comentário'),
  });

  return {
    comments: commentsQuery.data ?? [],
    loading: commentsQuery.isLoading,
    addComment: addComment.mutateAsync,
    updateComment: updateComment.mutateAsync,
    deleteComment: deleteComment.mutateAsync,
  };
}
