/**
 * Project Activities Hook - TanStack Query Version
 *
 * Migrated from useState/useEffect to useQuery/useMutation pattern
 * with optimistic updates for Gantt chart interactions.
 */

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { queryKeys, invalidateActivityQueries } from "@/lib/queryKeys";
import { QUERY_TIMING } from "@/lib/queryClient";
import { describeSaveError } from "@/lib/saveErrors";

/**
 * Resultado de uma gravação de cronograma. `permanent` distingue "não adianta
 * retentar" (permissão, regra de negócio, payload inválido) de "tente de novo
 * daqui a pouco" (rede, backend indisponível).
 */
export type SaveActivitiesResult =
  | { ok: true }
  | { ok: false; error: unknown; message: string; permanent: boolean };

export interface ProjectActivity {
  id: string;
  project_id: string;
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  weight: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  predecessor_ids: string[] | null;
  baseline_start: string | null;
  baseline_end: string | null;
  baseline_saved_at: string | null;
  etapa: string | null;
  detailed_description: string | null;
}

export interface ActivityInput {
  id?: string;
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  weight: number;
  sort_order: number;
  predecessor_ids?: string[];
  etapa?: string | null;
  detailed_description?: string | null;
  responsible_user_id?: string | null;
}

// Fetch activities for a project
async function fetchProjectActivities(
  projectId: string,
): Promise<ProjectActivity[]> {
  const { data, error } = await supabase
    .from("project_activities")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

export function useProjectActivities(projectId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const instanceId = useId();
  const saveQueueRef = useRef<Promise<SaveActivitiesResult>>(
    Promise.resolve({ ok: true }),
  );

  // Main query for activities
  const {
    data: activities = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.activities.list(projectId),
    queryFn: () => fetchProjectActivities(projectId!),
    enabled: !!projectId,
    staleTime: QUERY_TIMING.activities.staleTime,
    gcTime: QUERY_TIMING.activities.gcTime,
    placeholderData: (previousData) => previousData,
  });

  // Realtime: re-sync activities (and dependent UI like ReportHeader) on any change
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`project_activities:${projectId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_activities",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          invalidateActivityQueries(projectId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, instanceId]);

  // Save all activities (bulk replace)
  const saveActivitiesMutation = useMutation({
    mutationFn: async (newActivities: ActivityInput[]) => {
      if (!projectId || !user) {
        throw new Error("Projeto ou usuário não encontrado");
      }

      const rows = newActivities.map((activity, index) => ({
        id: activity.id,
        description: activity.description,
        planned_start: activity.planned_start,
        planned_end: activity.planned_end,
        actual_start: activity.actual_start || null,
        actual_end: activity.actual_end || null,
        weight: activity.weight,
        sort_order: index,
        created_by: user.id,
        predecessor_ids: activity.predecessor_ids || [],
        etapa: activity.etapa?.trim() || null,
        detailed_description: activity.detailed_description?.trim() || null,
      }));

      // Atomic RPC: update by id, insert new rows, then remove only omitted rows.
      // Existing ids must be preserved because measurements and other records
      // reference them.
      const response = await supabase.rpc("replace_project_activities" as any, {
        p_project_id: projectId,
        p_rows: rows,
      });

      if (response.error) {
        // O postgrest-js entrega o corpo cru do PostgREST como `error` e devolve
        // `status` como campo IRMÃO. Um `throw response.error` simples descarta o
        // status e a classificação permanente x transitório vira código morto.
        throw Object.assign(
          new Error(response.error.message || "Falha ao salvar o cronograma"),
          response.error,
          { status: response.status, statusText: response.statusText },
        );
      }

      return newActivities;
    },
    onSuccess: () => {
      // Toast handled by caller (Cronograma.tsx) to avoid double notification
      if (projectId) {
        invalidateActivityQueries(projectId);
      }
    },
    onError: () => {
      // Error toast handled by caller
    },
  });

  // useMutation devolve um objeto novo a cada render. Guardamos só o
  // mutateAsync numa ref para que a identidade de saveActivities seja estável
  // e não reinicie o debounce do autosave a cada re-render.
  const mutateActivitiesRef = useRef(saveActivitiesMutation.mutateAsync);
  mutateActivitiesRef.current = saveActivitiesMutation.mutateAsync;

  // Update single activity with optimistic update
  const updateActivityMutation = useMutation({
    mutationFn: async ({
      activityId,
      updates,
    }: {
      activityId: string;
      updates: Partial<ActivityInput>;
    }) => {
      const { error: updateError } = await supabase
        .from("project_activities")
        .update(updates)
        .eq("id", activityId);

      if (updateError) throw updateError;
      return { activityId, updates };
    },
    // Optimistic update for smooth Gantt drag experience
    onMutate: async ({ activityId, updates }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.activities.list(projectId),
      });

      const previousActivities = queryClient.getQueryData<ProjectActivity[]>(
        queryKeys.activities.list(projectId),
      );

      if (previousActivities) {
        queryClient.setQueryData<ProjectActivity[]>(
          queryKeys.activities.list(projectId),
          previousActivities.map((act) =>
            act.id === activityId
              ? { ...act, ...updates, updated_at: new Date().toISOString() }
              : act,
          ),
        );
      }

      return { previousActivities };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousActivities) {
        queryClient.setQueryData(
          queryKeys.activities.list(projectId),
          context.previousActivities,
        );
      }
      toast.error("Erro ao atualizar atividade");
    },
    onSettled: () => {
      if (projectId) {
        invalidateActivityQueries(projectId);
      }
    },
  });

  // Save baseline mutation
  const saveBaselineMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Projeto não encontrado");

      const { error } = await supabase.rpc("save_project_baseline" as any, {
        p_project_id: projectId,
      });

      if (error) throw error;

      return true;
    },
    onSuccess: () => {
      toast.success("Baseline salvo com sucesso!");
      if (projectId) {
        invalidateActivityQueries(projectId);
      }
    },
    onError: () => {
      toast.error("Erro ao salvar baseline");
    },
  });

  // Clear baseline mutation
  const clearBaselineMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Projeto não encontrado");

      const { error: updateError } = await supabase
        .from("project_activities")
        .update({
          baseline_start: null,
          baseline_end: null,
          baseline_saved_at: null,
        })
        .eq("project_id", projectId);

      if (updateError) throw updateError;
      return true;
    },
    onSuccess: () => {
      toast.success("Baseline removido");
      if (projectId) {
        invalidateActivityQueries(projectId);
      }
    },
    onError: () => {
      toast.error("Erro ao remover baseline");
    },
  });

  // Computed: has baseline
  const hasBaseline = useMemo(
    () => activities.some((a) => a.baseline_saved_at !== null),
    [activities],
  );

  // Public API. Devolve o motivo da falha em vez de um booleano: um `catch {}`
  // que vira `false` apaga a mensagem do banco, e é ela que diz ao usuário o
  // que fazer ("Sem permissão para editar o cronograma desta obra") e ao
  // chamador se vale a pena retentar.
  const saveActivities = useCallback(
    (newActivities: ActivityInput[]): Promise<SaveActivitiesResult> => {
      const snapshot = newActivities.map((activity) => ({ ...activity }));
      const queuedSave = saveQueueRef.current.then(
        async (): Promise<SaveActivitiesResult> => {
          try {
            await mutateActivitiesRef.current(snapshot);
            return { ok: true };
          } catch (error) {
            const { message, permanent } = describeSaveError(error);
            return { ok: false, error, message, permanent };
          }
        },
      );

      // Keep processing future saves even if a prior request failed.
      saveQueueRef.current = queuedSave.catch(
        (): SaveActivitiesResult => ({
          ok: false,
          error: undefined,
          message: "Não foi possível salvar. Tente novamente.",
          permanent: false,
        }),
      );
      return queuedSave;
    },
    // Sem dependências: a mutação é lida por ref. O objeto devolvido por
    // useMutation é recriado a cada render, então depender dele trocava a
    // identidade de saveActivities toda vez — o que reiniciava o debounce do
    // autosave do cronograma a cada render.
    [],
  );

  const updateActivity = async (
    activityId: string,
    updates: Partial<ActivityInput>,
  ): Promise<boolean> => {
    try {
      await updateActivityMutation.mutateAsync({ activityId, updates });
      return true;
    } catch {
      return false;
    }
  };

  const saveBaseline = async (): Promise<boolean> => {
    try {
      await saveBaselineMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const clearBaseline = async (): Promise<boolean> => {
    try {
      await clearBaselineMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  return {
    activities,
    loading,
    error: error ? (error as Error).message : null,
    refetch,
    saveActivities,
    updateActivity,
    saveBaseline,
    clearBaseline,
    hasBaseline,
    // Expose mutation states for UI feedback
    isSaving: saveActivitiesMutation.isPending,
    isUpdating: updateActivityMutation.isPending,
    isSavingBaseline: saveBaselineMutation.isPending,
    isClearingBaseline: clearBaselineMutation.isPending,
  };
}

/**
 * Hook to get activity statistics for a project
 */
export function useActivityStats(projectId: string | undefined) {
  const { activities, loading } = useProjectActivities(projectId);

  const stats = useMemo(() => {
    if (!activities.length) return null;

    const totalWeight = activities.reduce((sum, a) => sum + a.weight, 0);
    const completedWeight = activities
      .filter((a) => a.actual_end !== null)
      .reduce((sum, a) => sum + a.weight, 0);

    const progressPercentage =
      totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

    const inProgress = activities.filter(
      (a) => a.actual_start !== null && a.actual_end === null,
    ).length;

    const completed = activities.filter((a) => a.actual_end !== null).length;
    const pending = activities.filter((a) => a.actual_start === null).length;

    return {
      total: activities.length,
      completed,
      inProgress,
      pending,
      progressPercentage,
    };
  }, [activities]);

  return { stats, loading };
}
