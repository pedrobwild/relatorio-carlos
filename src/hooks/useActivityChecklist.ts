/**
 * useActivityChecklist — CRUD do checklist técnico de uma atividade
 * do cronograma (project_activities).
 *
 * Cada atividade pode ter N itens. UI mostra-os ordenados por `position`.
 * Triggers do banco preenchem `done_at` / `done_by` ao marcar.
 *
 * Estratégia de mutation: chamadas pontuais (add/toggle/edit/delete/reorder)
 * com invalidação local do query — não há "save all" porque a operação
 * típica é interativa (clicar checkbox) e queremos feedback imediato.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ActivityChecklistItem {
  id: string;
  activity_id: string;
  project_id: string;
  description: string;
  position: number;
  is_done: boolean;
  done_at: string | null;
  done_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const TABLE = 'project_activity_checklist_items' as never;

function activityChecklistKey(activityId: string | undefined) {
  return ['activity-checklist', activityId] as const;
}

export function useActivityChecklist(
  activityId: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  const queryKey = activityChecklistKey(activityId);

  const query = useQuery({
    queryKey,
    enabled: !!activityId,
    queryFn: async (): Promise<ActivityChecklistItem[]> => {
      if (!activityId) return [];
      const { data, error } = await supabase
        .from(TABLE)
        .select(
          'id, activity_id, project_id, description, position, is_done, done_at, done_by, created_at, updated_at, created_by',
        )
        .eq('activity_id', activityId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ActivityChecklistItem[];
    },
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const addItem = useMutation({
    mutationFn: async (description: string) => {
      if (!activityId || !projectId) throw new Error('Atividade não encontrada');
      const trimmed = description.trim();
      if (!trimmed) throw new Error('Descrição vazia');
      const nextPosition = (query.data?.length ?? 0);
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          activity_id: activityId,
          project_id: projectId,
          description: trimmed,
          position: nextPosition,
          is_done: false,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ActivityChecklistItem;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (err: Error) => {
      toast.error('Não foi possível adicionar o item', { description: err.message });
    },
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({ is_done } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_done }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<ActivityChecklistItem[]>(queryKey);
      if (prev) {
        queryClient.setQueryData<ActivityChecklistItem[]>(
          queryKey,
          prev.map((it) => (it.id === id ? { ...it, is_done } : it)),
        );
      }
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error('Não foi possível atualizar o item', { description: err.message });
    },
    onSettled: () => invalidate(),
  });

  const editItem = useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const trimmed = description.trim();
      if (!trimmed) throw new Error('Descrição vazia');
      const { error } = await supabase
        .from(TABLE)
        .update({ description: trimmed } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (err: Error) => {
      toast.error('Não foi possível editar o item', { description: err.message });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (err: Error) => {
      toast.error('Não foi possível excluir o item', { description: err.message });
    },
  });

  const items = query.data ?? [];
  const total = items.length;
  const doneCount = items.filter((i) => i.is_done).length;
  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    total,
    doneCount,
    progress,
    addItem,
    toggleItem,
    editItem,
    deleteItem,
  };
}
