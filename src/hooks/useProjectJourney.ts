import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { JourneyCSM } from "@/components/journey/JourneyCSMSection";

export type JourneyStageStatus =
  | "pending"
  | "waiting_action"
  | "in_progress"
  | "completed";

export interface JourneyHero {
  id: string;
  project_id: string;
  title: string;
  subtitle: string;
  badge_text: string | null;
}

export interface JourneyFooter {
  id: string;
  project_id: string;
  text: string;
}

export interface JourneyTodo {
  id: string;
  stage_id: string;
  owner: "client" | "bwild";
  text: string;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

export interface JourneyStage {
  id: string;
  project_id: string;
  sort_order: number;
  name: string;
  icon: string | null;
  status: JourneyStageStatus;
  description: string | null;
  warning_text: string | null;
  cta_text: string | null;
  cta_url: string | null;
  cta_visible: boolean;
  microcopy: string | null;
  responsible: string | null;
  dependencies_text: string | null;
  revision_text: string | null;
  proposed_start: string | null;
  proposed_end: string | null;
  confirmed_start: string | null;
  confirmed_end: string | null;
  waiting_since: string | null;
  todos: JourneyTodo[];
}

export interface ProjectJourneyData {
  hero: JourneyHero | null;
  footer: JourneyFooter | null;
  csm: JourneyCSM | null;
  stages: JourneyStage[];
}

async function fetchProjectJourney(
  projectId: string,
): Promise<ProjectJourneyData> {
  // BUG FIX: Fetch todos junto com stages para evitar N+1 queries
  const [heroResult, footerResult, csmResult, stagesResult, todosResult] =
    await Promise.all([
      supabase
        .from("journey_hero")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(), // BUG FIX: Use maybeSingle() para evitar erro quando não existe
      supabase
        .from("journey_footer")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("journey_csm")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("journey_stages")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true }),
      // Fetch all todos for this project's stages in one query
      supabase
        .from("journey_todos")
        .select("*, journey_stages!inner(project_id)")
        .eq("journey_stages.project_id", projectId)
        .order("sort_order", { ascending: true }),
    ]);

  // Group todos by stage_id
  const todosByStage = new Map<string, JourneyTodo[]>();
  if (todosResult.data) {
    for (const todo of todosResult.data) {
      const existing = todosByStage.get(todo.stage_id) || [];
      existing.push(todo as JourneyTodo);
      todosByStage.set(todo.stage_id, existing);
    }
  }

  const stages: JourneyStage[] = (stagesResult.data || []).map((stage) => ({
    ...stage,
    status: stage.status as JourneyStageStatus,
    todos: todosByStage.get(stage.id) || [],
  }));

  return {
    hero: heroResult.data as JourneyHero | null,
    footer: footerResult.data as JourneyFooter | null,
    csm: csmResult.data as JourneyCSM | null,
    stages,
  };
}

export function useProjectJourney(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-journey", projectId],
    queryFn: () => fetchProjectJourney(projectId!),
    enabled: !!projectId,
  });
}

export function useInitializeJourney() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.rpc("initialize_project_journey", {
        p_project_id: projectId,
      });
      if (error) throw error;
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({
        queryKey: ["project-journey", projectId],
      });
    },
  });
}

export function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      todoId,
      completed,
      projectId,
    }: {
      todoId: string;
      completed: boolean;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from("journey_todos")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", todoId);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["project-journey", projectId],
      });
    },
  });
}

export function useUpdateHero() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      heroId,
      updates,
      projectId,
    }: {
      heroId: string;
      updates: Partial<JourneyHero>;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from("journey_hero")
        .update(updates)
        .eq("id", heroId);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["project-journey", projectId],
      });
    },
  });
}

export function useUpdateFooter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      footerId,
      text,
      projectId,
    }: {
      footerId: string;
      text: string;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from("journey_footer")
        .update({ text })
        .eq("id", footerId);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["project-journey", projectId],
      });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stageId,
      updates,
      projectId,
    }: {
      stageId: string;
      updates: Partial<JourneyStage>;
      projectId: string;
    }) => {
      const { todos, ...stageUpdates } = updates;
      const { error } = await supabase
        .from("journey_stages")
        .update(stageUpdates)
        .eq("id", stageId);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["project-journey", projectId],
      });
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      todoId,
      text,
      projectId,
    }: {
      todoId: string;
      text: string;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from("journey_todos")
        .update({ text })
        .eq("id", todoId);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["project-journey", projectId],
      });
    },
  });
}

export function useAddTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stageId,
      owner,
      text,
      projectId,
    }: {
      stageId: string;
      owner: "client" | "bwild";
      text: string;
      projectId: string;
    }) => {
      // Get max sort_order for this stage
      const { data: existing } = await supabase
        .from("journey_todos")
        .select("sort_order")
        .eq("stage_id", stageId)
        .order("sort_order", { ascending: false })
        .limit(1);

      const sortOrder =
        existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;

      const { error } = await supabase
        .from("journey_todos")
        .insert({ stage_id: stageId, owner, text, sort_order: sortOrder });
      if (error) throw error;
      return { projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["project-journey", projectId],
      });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      todoId,
      projectId,
    }: {
      todoId: string;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from("journey_todos")
        .delete()
        .eq("id", todoId);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["project-journey", projectId],
      });
    },
  });
}

export function useCompleteStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stageId,
      projectId,
    }: {
      stageId: string;
      projectId: string;
    }) => {
      // 1) Mark current stage as completed with confirmed_end = now
      const { error: completeError } = await supabase
        .from("journey_stages")
        .update({
          status: "completed" as JourneyStageStatus,
          confirmed_end: new Date().toISOString(),
        })
        .eq("id", stageId);
      if (completeError) throw completeError;

      // 2) Find current stage's sort_order to unlock the next one
      const { data: currentStage, error: fetchError } = await supabase
        .from("journey_stages")
        .select("sort_order")
        .eq("id", stageId)
        .single();

      if (fetchError) {
        console.error(
          "Failed to fetch completed stage sort_order:",
          fetchError,
        );
        return { projectId, partialFailure: true };
      }

      if (currentStage) {
        // 3) Get the next stage by sort_order
        const { data: nextStages, error: nextError } = await supabase
          .from("journey_stages")
          .select("id, status")
          .eq("project_id", projectId)
          .gt("sort_order", currentStage.sort_order)
          .order("sort_order", { ascending: true })
          .limit(1);

        if (nextError) {
          console.error("Failed to fetch next stage:", nextError);
          return { projectId, partialFailure: true };
        }

        if (
          nextStages &&
          nextStages.length > 0 &&
          nextStages[0].status === "pending"
        ) {
          const { error: unlockError } = await supabase
            .from("journey_stages")
            .update({ status: "in_progress" as JourneyStageStatus })
            .eq("id", nextStages[0].id);
          if (unlockError) {
            console.error("Failed to unlock next stage:", unlockError);
            return { projectId, partialFailure: true };
          }
        }
      }

      return { projectId, partialFailure: false };
    },
    onSuccess: ({ projectId, partialFailure }) => {
      queryClient.invalidateQueries({
        queryKey: ["project-journey", projectId],
      });
      if (partialFailure) {
        toast.warning(
          "Etapa concluída, mas houve um erro ao desbloquear a próxima etapa. Tente recarregar a página.",
        );
      }
    },
    onError: (error) => {
      console.error("Failed to complete stage:", error);
      toast.error("Erro ao concluir a etapa. Tente novamente.");
    },
  });
}
