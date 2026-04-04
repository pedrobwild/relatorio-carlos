import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ObraTaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string;
}

export interface ObraTaskStatusHistory {
  id: string;
  task_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  created_at: string;
  changed_by_name?: string;
}

export function useObraTaskComments(taskId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const commentsKey = ['obra-task-comments', taskId];
  const historyKey = ['obra-task-status-history', taskId];

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: commentsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obra_task_comments')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Enrich with author names
      const authorIds = [...new Set((data || []).map(c => c.author_id))];
      let profiles: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: users } = await supabase
          .from('users_profile')
          .select('id, nome, email')
          .in('id', authorIds);
        if (users) {
          profiles = Object.fromEntries(users.map(u => [u.id, u.nome || u.email || 'Usuário']));
        }
      }

      return (data || []).map(c => ({
        ...c,
        author_name: profiles[c.author_id] || 'Usuário',
      })) as ObraTaskComment[];
    },
    enabled: !!taskId,
  });

  const { data: statusHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: historyKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obra_task_status_history')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const changerIds = [...new Set((data || []).filter(h => h.changed_by).map(h => h.changed_by!))];
      let profiles: Record<string, string> = {};
      if (changerIds.length > 0) {
        const { data: users } = await supabase
          .from('users_profile')
          .select('id, nome, email')
          .in('id', changerIds);
        if (users) {
          profiles = Object.fromEntries(users.map(u => [u.id, u.nome || u.email || 'Usuário']));
        }
      }

      return (data || []).map(h => ({
        ...h,
        changed_by_name: h.changed_by ? (profiles[h.changed_by] || 'Usuário') : null,
      })) as ObraTaskStatusHistory[];
    },
    enabled: !!taskId,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!taskId || !user) throw new Error('Missing context');
      const { error } = await supabase
        .from('obra_task_comments')
        .insert({ task_id: taskId, author_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey });
    },
    onError: () => toast.error('Erro ao adicionar comentário'),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('obra_task_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Comentário excluído');
      queryClient.invalidateQueries({ queryKey: commentsKey });
    },
    onError: () => toast.error('Erro ao excluir comentário'),
  });

  return {
    comments,
    commentsLoading,
    statusHistory,
    historyLoading,
    addComment,
    deleteComment,
  };
}