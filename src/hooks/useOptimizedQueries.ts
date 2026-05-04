import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Types for RPC responses
export interface PendingItemWithContext {
  id: string;
  project_id: string;
  project_name: string;
  customer_org_id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  amount: number | null;
  options: string[] | null;
  impact: string | null;
  action_url: string | null;
  reference_type: string | null;
  reference_id: string | null;
  reference_title: string | null;
  reference_status: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolver_name: string | null;
  resolution_notes: string | null;
  days_overdue: number;
  urgency_level: "overdue" | "urgent" | "approaching" | "normal";
}

export interface ProjectActivityEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  entity_title: string | null;
  payload: Record<string, unknown>;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface FormalizationComplete {
  id: string;
  customer_org_id: string;
  project_id: string | null;
  project_name: string | null;
  unit_id: string | null;
  type: string;
  status: string;
  title: string;
  summary: string;
  body_md: string;
  data: Record<string, unknown>;
  locked_at: string | null;
  locked_hash: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  creator_name: string | null;
  parties: Array<{
    id: string;
    party_type: string;
    display_name: string;
    email: string | null;
    role_label: string | null;
    must_sign: boolean;
    acknowledged: boolean;
    acknowledged_at: string | null;
  }> | null;
  acknowledgements: Array<{
    id: string;
    party_id: string;
    acknowledged_at: string;
    acknowledged_by_email: string | null;
    ip_address: string | null;
    signature_hash: string | null;
  }> | null;
  evidence_links: Array<{
    id: string;
    kind: string;
    url: string;
    description: string | null;
    created_at: string;
  }> | null;
  attachments: Array<{
    id: string;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
    storage_path: string;
    created_at: string;
  }> | null;
  recent_events: Array<{
    id: string;
    event_type: string;
    meta: Record<string, unknown>;
    actor_user_id: string | null;
    actor_name: string | null;
    created_at: string;
  }> | null;
  total_parties: number;
  signed_parties: number;
}

export interface UserProjectSummary {
  id: string;
  name: string;
  status: string;
  org_id: string | null;
  org_name: string | null;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  contract_value: number | null;
  user_role: string;
  pending_count: number;
  overdue_count: number;
  unsigned_formalizations: number;
  pending_documents: number;
  progress_percentage: number;
  last_activity_at: string | null;
}

/**
 * Fetch pending items with full context in a single optimized query
 */
export function usePendingItemsWithContext(
  projectId?: string,
  includeCompleted = false,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-items-context", projectId, includeCompleted],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_pending_items_with_context",
        {
          p_project_id: projectId,
          p_include_completed: includeCompleted,
        },
      );

      if (error) throw error;
      return (data || []) as PendingItemWithContext[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch project activity timeline with actor details
 */
export function useProjectActivityTimeline(
  projectId: string | undefined,
  limit = 20,
  offset = 0,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["project-activity", projectId, limit, offset],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase.rpc(
        "get_project_activity_timeline",
        {
          p_project_id: projectId,
          p_limit: limit,
          p_offset: offset,
        },
      );

      if (error) throw error;
      return (data || []) as ProjectActivityEvent[];
    },
    enabled: !!user && !!projectId,
  });
}

/**
 * Fetch complete formalization with all related data in one query
 */
export function useFormalizationComplete(formalizationId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["formalization-complete", formalizationId],
    queryFn: async () => {
      if (!formalizationId) return null;

      const { data, error } = await supabase.rpc("get_formalization_complete", {
        p_formalization_id: formalizationId,
      });

      if (error) throw error;
      return data && data.length > 0
        ? (data[0] as FormalizationComplete)
        : null;
    },
    enabled: !!user && !!formalizationId,
  });
}

/**
 * Fetch all projects user has access to with summary stats
 */
export function useUserProjectsSummary() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-projects-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_projects_summary");

      if (error) throw error;
      return (data || []) as UserProjectSummary[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch project dashboard summary from the optimized view
 */
export function useProjectDashboardSummary(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["project-dashboard-summary", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data, error } = await supabase
        .from("project_dashboard_summary")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });
}
