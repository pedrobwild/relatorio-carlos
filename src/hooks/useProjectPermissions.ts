/**
 * Hook for project-scoped permission overrides.
 *
 * Fetches overrides from `project_member_permissions` and merges
 * with default role-based permissions via permissionGuard.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCallback, useEffect, useMemo } from "react";
import {
  hasProjectPermission,
  type PermissionContext,
  checkPermission,
} from "@/lib/permissionGuard";
import { useUserRole } from "./useUserRole";
import type { ModulePermission, ProjectPermission } from "@/types/permissions";

export function useProjectPermissions(projectId: string | undefined) {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const queryClient = useQueryClient();

  // CRITICAL: when projectId changes, cancel any in-flight queries for the
  // previous project so a late response cannot overwrite the current state
  // with stale permissions from a different obra.
  useEffect(() => {
    return () => {
      queryClient
        .cancelQueries({ queryKey: ["project-member-permissions"] })
        .catch(() => {});
      queryClient
        .cancelQueries({ queryKey: ["project-member-role"] })
        .catch(() => {});
    };
  }, [projectId, queryClient]);

  const { data: overrides = {} } = useQuery({
    queryKey: ["project-member-permissions", projectId, user?.id],
    queryFn: async ({ signal }) => {
      if (!projectId || !user) return {};
      const { data, error } = await supabase
        .from("project_member_permissions")
        .select("permission, granted")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .abortSignal(signal);

      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const row of data ?? []) {
        map[row.permission] = row.granted;
      }
      return map;
    },
    enabled: !!projectId && !!user,
    staleTime: 10 * 60 * 1000,
  });

  // Get project role from project_members
  const { data: projectRole } = useQuery({
    queryKey: ["project-member-role", projectId, user?.id],
    queryFn: async ({ signal }) => {
      if (!projectId || !user) return null;
      const { data } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .abortSignal(signal)
        .maybeSingle();
      return data?.role ?? null;
    },
    enabled: !!projectId && !!user,
    staleTime: 10 * 60 * 1000,
  });

  const ctx: PermissionContext = useMemo(
    () => ({ roles, projectRole, projectOverrides: overrides }),
    [roles, projectRole, overrides],
  );

  const canProject = useCallback(
    (permission: ProjectPermission) =>
      hasProjectPermission(projectRole ?? null, permission, overrides),
    [projectRole, overrides],
  );

  const check = useCallback(
    (permission: ModulePermission | ProjectPermission) =>
      checkPermission(ctx, permission),
    [ctx],
  );

  return { canProject, check, projectRole, overrides, ctx };
}
