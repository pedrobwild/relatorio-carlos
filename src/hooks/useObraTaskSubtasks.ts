import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ObraTaskSubtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export function useObraTaskSubtasks(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["obra-task-subtasks", taskId];

  const { data: subtasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_task_subtasks" as any)
        .select("*")
        .eq("task_id", taskId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ObraTaskSubtask[];
    },
    enabled: !!taskId,
  });

  const addSubtask = useMutation({
    mutationFn: async (title: string) => {
      const maxOrder =
        subtasks.length > 0
          ? Math.max(...subtasks.map((s) => s.sort_order)) + 1
          : 0;
      const { error } = await supabase
        .from("obra_task_subtasks" as any)
        .insert({ task_id: taskId!, title, sort_order: maxOrder });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Erro ao adicionar subtarefa"),
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({
      id,
      completed,
    }: {
      id: string;
      completed: boolean;
    }) => {
      const { error } = await supabase
        .from("obra_task_subtasks" as any)
        .update({ completed })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<ObraTaskSubtask[]>(queryKey);
      if (prev) {
        queryClient.setQueryData<ObraTaskSubtask[]>(
          queryKey,
          prev.map((s) => (s.id === id ? { ...s, completed } : s)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error("Erro ao atualizar subtarefa");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("obra_task_subtasks" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Erro ao excluir subtarefa"),
  });

  const completedCount = subtasks.filter((s) => s.completed).length;
  const progress =
    subtasks.length > 0
      ? Math.round((completedCount / subtasks.length) * 100)
      : 0;

  return {
    subtasks,
    isLoading,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    completedCount,
    totalCount: subtasks.length,
    progress,
  };
}
