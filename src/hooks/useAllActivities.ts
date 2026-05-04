import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  ObraTask,
  ObraTaskStatus,
  ObraTaskPriority,
} from "@/hooks/useObraTasks";

// Extended ObraTask with project info for the global view
export interface GlobalTask extends ObraTask {
  project_name: string;
}

export type KanbanStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "overdue";

export function deriveKanbanStatus(task: GlobalTask): KanbanStatus {
  if (task.status === "concluido") return "completed";
  if (task.status === "em_andamento" || task.status === "pausado") {
    if (task.due_date && task.due_date < new Date().toISOString().slice(0, 10))
      return "overdue";
    return "in_progress";
  }
  if (task.due_date && task.due_date < new Date().toISOString().slice(0, 10))
    return "overdue";
  return "not_started";
}

const QUERY_KEY = ["all-activities-global"];

export function useAllActivities() {
  const queryClient = useQueryClient();

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<GlobalTask[]> => {
      const { data, error } = await supabase
        .from("obra_tasks")
        .select("*, projects!inner(name), obra_task_subtasks(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        project_id: row.project_id,
        project_name: (row.projects as any)?.name ?? "Sem nome",
        title: row.title,
        description: row.description ?? null,
        responsible_user_id: row.responsible_user_id ?? null,
        due_date: row.due_date ?? null,
        start_date: row.start_date ?? null,
        cost: row.cost ?? null,
        priority: (row.priority as ObraTaskPriority) ?? "media",
        status: row.status as ObraTaskStatus,
        sort_order: row.sort_order ?? 0,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at ?? null,
        days_overdue: row.days_overdue ?? null,
        subtask_total: row.obra_task_subtasks?.[0]?.count ?? 0,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ObraTaskStatus;
    }) => {
      const { error } = await supabase
        .from("obra_tasks")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData<GlobalTask[]>(QUERY_KEY);
      if (prev) {
        queryClient.setQueryData<GlobalTask[]>(
          QUERY_KEY,
          prev.map((t) => (t.id === id ? { ...t, status } : t)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
      toast.error("Erro ao atualizar status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // Also invalidate per-project queries so they stay in sync
      queryClient.invalidateQueries({ queryKey: ["obra-tasks"] });
    },
  });

  return { tasks, isLoading, error, updateStatus };
}
