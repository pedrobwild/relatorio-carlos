/**
 * Projects Query Hook
 *
 * TanStack Query-based hook for fetching projects using the repository pattern.
 * Replaces the legacy useProjects hook with better caching and error handling.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as projectsRepo from "@/infra/repositories/projects.repository";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectStatus } from "@/infra/repositories/projects.repository";

// Query keys for cache management
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: { status?: ProjectStatus; userId?: string }) =>
    [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  summary: (userId?: string) =>
    [...projectKeys.all, "summary", userId ?? "anonymous"] as const,
};

/**
 * Fetch all projects the current user has access to
 */
export function useProjectsQuery(filters?: { status?: ProjectStatus }) {
  const { user } = useAuth();
  const { isStaff, isCustomer, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: projectKeys.list({ status: filters?.status, userId: user?.id }),
    queryFn: async (): Promise<projectsRepo.ProjectWithCustomer[]> => {
      if (!user) return [];

      if (isStaff) {
        const result = await projectsRepo.getStaffProjects();
        if (result.error) throw result.error;

        // Apply status filter if provided
        let projects = result.data;
        if (filters?.status) {
          projects = projects.filter((p) => p.status === filters.status);
        }
        return projects;
      }

      if (isCustomer) {
        const result = await projectsRepo.getCustomerProjects(user.id);
        if (result.error) throw result.error;

        let projects = result.data;
        if (filters?.status) {
          projects = projects.filter((p) => p.status === filters.status);
        }
        // Cast to ProjectWithCustomer (customer projects don't have customer_name but interface is compatible)
        return projects as projectsRepo.ProjectWithCustomer[];
      }

      return [];
    },
    enabled: !!user && !roleLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single project by ID
 */
export function useProjectQuery(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: async () => {
      if (!projectId) return null;
      const result = await projectsRepo.getProjectById(projectId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!user && !!projectId,
  });
}

/**
 * Fetch project summary with stats using optimized RPC
 */
export function useProjectSummaryQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: projectKeys.summary(user?.id),
    queryFn: async () => {
      const result = await projectsRepo.getUserProjectsSummary();
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Check if user has access to a specific project
 */
export function useProjectAccessQuery(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...projectKeys.detail(projectId ?? ""), "access"],
    queryFn: async () => {
      if (!projectId || !user) return false;
      return projectsRepo.checkProjectAccess(user.id, projectId);
    },
    enabled: !!user && !!projectId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Mutation for updating project status
 */
export function useUpdateProjectStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      status,
    }: {
      projectId: string;
      status: ProjectStatus;
    }) => {
      const { data, error } = await supabase
        .from("projects")
        .update({ status })
        .eq("id", projectId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success("Status do projeto atualizado");
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(variables.projectId),
      });
    },
    onError: () => {
      toast.error("Erro ao atualizar status do projeto");
    },
  });
}
