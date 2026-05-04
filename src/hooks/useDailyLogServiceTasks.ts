/**
 * useDailyLogServiceTasks — CRUD de tarefas vinculadas a um serviço
 * em execução do registro diário (Painel de Obras).
 *
 * Auto-save por tarefa: cada criar/editar/concluir/excluir vai direto
 * ao banco. Optimistic updates para feedback imediato.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ServiceTaskStatus =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "cancelado";

export interface ServiceTask {
  id: string;
  service_id: string;
  title: string;
  responsible_user_id: string | null;
  due_date: string | null;
  status: ServiceTaskStatus;
  position: number;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export const SERVICE_TASK_STATUS_OPTIONS: {
  value: ServiceTaskStatus;
  label: string;
}[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export function useDailyLogServiceTasks(serviceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["daily-log-service-tasks", serviceId];

  const query = useQuery({
    queryKey,
    enabled: !!serviceId,
    queryFn: async (): Promise<ServiceTask[]> => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from("project_daily_log_service_tasks" as any)
        .select("*")
        .eq("service_id", serviceId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ServiceTask[];
    },
  });

  const tasks = query.data ?? [];

  const addTask = useMutation({
    mutationFn: async (input: {
      title: string;
      responsible_user_id?: string | null;
      due_date?: string | null;
      status?: ServiceTaskStatus;
    }) => {
      if (!serviceId) throw new Error("Serviço não salvo ainda");
      const maxPos =
        tasks.length > 0 ? Math.max(...tasks.map((t) => t.position)) + 1 : 0;
      const { data: user } = await supabase.auth.getUser();
      const { error, data } = await supabase
        .from("project_daily_log_service_tasks" as any)
        .insert({
          service_id: serviceId,
          title: input.title,
          responsible_user_id: input.responsible_user_id ?? null,
          due_date: input.due_date ?? null,
          status: input.status ?? "pendente",
          position: maxPos,
          created_by: user.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Erro ao adicionar tarefa"),
  });

  const updateTask = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<ServiceTask>;
    }) => {
      const { error } = await supabase
        .from("project_daily_log_service_tasks" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<ServiceTask[]>(queryKey);
      if (prev) {
        queryClient.setQueryData<ServiceTask[]>(
          queryKey,
          prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error("Erro ao atualizar tarefa");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_daily_log_service_tasks" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Erro ao excluir tarefa"),
  });

  const completedCount = tasks.filter((t) => t.status === "concluido").length;
  const totalCount = tasks.length;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    tasks,
    isLoading: query.isLoading,
    addTask,
    updateTask,
    deleteTask,
    completedCount,
    totalCount,
    progress,
  };
}
