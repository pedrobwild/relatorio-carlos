import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
// Standard event types for consistency
export const EVENT_TYPES = {
  // Weekly Reports
  WEEKLY_REPORT_PUBLISHED: "weekly_report.published",
  WEEKLY_REPORT_VIEWED: "weekly_report.viewed",

  // Formalizations
  FORMALIZATION_CREATED: "formalization.created",
  FORMALIZATION_UPDATED: "formalization.updated",
  FORMALIZATION_SENT: "formalization.sent",
  FORMALIZATION_SIGNED: "formalization.signed",
  FORMALIZATION_VOIDED: "formalization.voided",

  // Documents
  DOCUMENT_UPLOADED: "document.uploaded",
  DOCUMENT_VERSION_UPLOADED: "document.version_uploaded",
  DOCUMENT_APPROVED: "document.approved",

  // Executive project — tacit approval (sem manifestação no prazo contratual)
  EXECUTIVE_TACIT_APPROVAL: "executive.tacit_approval",

  // Payments
  PAYMENT_CREATED: "payment.created",
  PAYMENT_RECEIVED: "payment.received",
  PAYMENT_OVERDUE: "payment.overdue",

  // Pending Items
  PENDING_ITEM_CREATED: "pending_item.created",
  PENDING_ITEM_RESOLVED: "pending_item.resolved",
  PENDING_ITEM_CANCELLED: "pending_item.cancelled",

  // Project
  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  PROJECT_MEMBER_ADDED: "project.member_added",
  PROJECT_MEMBER_REMOVED: "project.member_removed",

  // Change Orders
  CHANGE_ORDER_CREATED: "change_order.created",
  CHANGE_ORDER_APPROVED: "change_order.approved",
  CHANGE_ORDER_REJECTED: "change_order.rejected",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export interface DomainEvent {
  id: string;
  org_id: string;
  project_id: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  actor_user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface LogEventParams {
  orgId: string;
  projectId?: string | null;
  entityType: string;
  entityId: string;
  eventType: EventType | string;
  payload?: Record<string, unknown>;
}

interface QueryEventsParams {
  orgId?: string;
  projectId?: string;
  entityType?: string;
  entityId?: string;
  eventType?: string;
  limit?: number;
}

export function useDomainEvents(params?: QueryEventsParams) {
  const queryClient = useQueryClient();

  const queryKey = ["domain-events", params];

  // Query events with filters
  const {
    data: events = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("domain_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (params?.orgId) {
        query = query.eq("org_id", params.orgId);
      }
      if (params?.projectId) {
        query = query.eq("project_id", params.projectId);
      }
      if (params?.entityType) {
        query = query.eq("entity_type", params.entityType);
      }
      if (params?.entityId) {
        query = query.eq("entity_id", params.entityId);
      }
      if (params?.eventType) {
        query = query.eq("event_type", params.eventType);
      }

      query = query.limit(params?.limit || 100);

      const { data, error } = await query;
      if (error) throw error;

      return data as DomainEvent[];
    },
    enabled: !!(params?.orgId || params?.projectId || params?.entityId),
  });

  // Log a new event using the database function
  const logEventMutation = useMutation({
    mutationFn: async ({
      orgId,
      projectId,
      entityType,
      entityId,
      eventType,
      payload = {},
    }: LogEventParams) => {
      const { data, error } = await supabase.rpc("log_domain_event", {
        _org_id: orgId,
        _project_id: projectId ?? "",
        _entity_type: entityType,
        _entity_id: entityId,
        _event_type: eventType,
        _payload: (payload ?? {}) as Json,
        _ip_address: undefined,
        _user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });

      if (error) throw error;
      return data as string; // Returns event ID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-events"] });
    },
  });

  return {
    events,
    isLoading,
    error,
    refetch,
    logEvent: logEventMutation.mutateAsync,
    isLogging: logEventMutation.isPending,
  };
}

// Convenience hook to get events for a specific entity
export function useEntityEvents(
  entityType: string,
  entityId: string | undefined,
) {
  return useDomainEvents(
    entityId ? { entityType, entityId, limit: 50 } : undefined,
  );
}

// Convenience hook to get events for a project
export function useProjectEvents(projectId: string | undefined) {
  return useDomainEvents(projectId ? { projectId, limit: 100 } : undefined);
}
