import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type ObraTaskStatus =
  | "pendente"
  | "em_andamento"
  | "pausado"
  | "concluido";
export type ObraTaskPriority = "baixa" | "media" | "alta" | "critica";

export interface ObraTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  responsible_user_id: string | null;
  due_date: string | null;
  start_date: string | null;
  cost: number | null;
  priority: ObraTaskPriority;
  status: ObraTaskStatus;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  days_overdue: number | null;
  /** Total subtask count (from aggregate) */
  subtask_total?: number;
}

export interface ObraTaskInput {
  title: string;
  description?: string | null;
  responsible_user_id?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  cost?: number | null;
  priority?: ObraTaskPriority;
  status?: ObraTaskStatus;
}

const TASK_STATUSES: { value: ObraTaskStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
];

export { TASK_STATUSES };

export function useObraTasks(projectId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["obra-tasks", projectId];

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_tasks")
        .select("*, obra_task_subtasks(count)")
        .eq("project_id", projectId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => {
        const { obra_task_subtasks, ...rest } = row;
        const subtask_total = obra_task_subtasks?.[0]?.count ?? 0;
        return { ...rest, subtask_total } as ObraTask;
      });
    },
    enabled: !!projectId,
  });

  const createTask = useMutation({
    mutationFn: async (input: ObraTaskInput) => {
      if (!projectId || !user) throw new Error("Missing context");
      const maxOrder =
        tasks.length > 0 ? Math.max(...tasks.map((t) => t.sort_order)) + 1 : 0;
      const { data, error } = await supabase
        .from("obra_tasks")
        .insert({
          project_id: projectId,
          title: input.title,
          description: input.description || null,
          responsible_user_id: input.responsible_user_id || null,
          due_date: input.due_date || null,
          start_date: input.start_date || null,
          cost: input.cost ?? null,
          priority: input.priority || "media",
          status: input.status || "pendente",
          sort_order: maxOrder,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Atividade criada");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Erro ao criar atividade"),
  });

  const updateTask = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<ObraTaskInput>;
    }) => {
      const { error } = await supabase
        .from("obra_tasks")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<ObraTask[]>(queryKey);
      if (prev) {
        queryClient.setQueryData<ObraTask[]>(
          queryKey,
          prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error("Erro ao atualizar atividade");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade excluída");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Erro ao excluir atividade"),
  });

  return {
    tasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
  };
}
