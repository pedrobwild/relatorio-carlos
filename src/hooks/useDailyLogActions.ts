/**
 * useDailyLogActions — CRUD de ações da semana vinculadas ao registro
 * do Painel de Obras (uma "folha" por projeto/data).
 *
 * Auto-save por linha: cada criar/editar/concluir/excluir vai direto
 * ao banco. Optimistic updates para feedback imediato.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DailyLogActionStatus =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "cancelado";

export interface DailyLogAction {
  id: string;
  daily_log_id: string;
  title: string;
  responsible_user_id: string | null;
  due_date: string | null;
  status: DailyLogActionStatus;
  position: number;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export const DAILY_LOG_ACTION_STATUS_OPTIONS: {
  value: DailyLogActionStatus;
  label: string;
}[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export function useDailyLogActions(dailyLogId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["daily-log-actions", dailyLogId];

  const query = useQuery({
    queryKey,
    enabled: !!dailyLogId,
    queryFn: async (): Promise<DailyLogAction[]> => {
      if (!dailyLogId) return [];
      const { data, error } = await supabase
        .from("project_daily_log_actions" as any)
        .select("*")
        .eq("daily_log_id", dailyLogId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DailyLogAction[];
    },
  });

  const actions = query.data ?? [];

  const addAction = useMutation({
    mutationFn: async (input: {
      title: string;
      responsible_user_id?: string | null;
      due_date?: string | null;
      status?: DailyLogActionStatus;
    }) => {
      if (!dailyLogId) throw new Error("Registro da semana não salvo ainda");
      const maxPos =
        actions.length > 0
          ? Math.max(...actions.map((a) => a.position)) + 1
          : 0;
      const { data: user } = await supabase.auth.getUser();
      const { error, data } = await supabase
        .from("project_daily_log_actions" as any)
        .insert({
          daily_log_id: dailyLogId,
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
    onError: () => toast.error("Erro ao adicionar ação"),
  });

  const updateAction = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<DailyLogAction>;
    }) => {
      const { error } = await supabase
        .from("project_daily_log_actions" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<DailyLogAction[]>(queryKey);
      if (prev) {
        queryClient.setQueryData<DailyLogAction[]>(
          queryKey,
          prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error("Erro ao atualizar ação");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_daily_log_actions" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Erro ao excluir ação"),
  });

  const completedCount = actions.filter((a) => a.status === "concluido").length;
  const totalCount = actions.length;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    actions,
    isLoading: query.isLoading,
    addAction,
    updateAction,
    deleteAction,
    completedCount,
    totalCount,
    progress,
  };
}
