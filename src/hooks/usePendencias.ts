import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, differenceInDays } from "date-fns";
import { useAuth } from "./useAuth";
import { isDemoMode } from "@/config/flags";
import type { Json } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

// Database enum mappings
export type PendingItemType =
  | "approve_3d"
  | "approve_executive"
  | "signature"
  | "decision"
  | "invoice"
  | "extra_purchase";

export type PendingItemStatus = "pending" | "completed" | "cancelled";

// UI-friendly types (backwards compatible)
export type PendingType =
  | "decision"
  | "invoice"
  | "signature"
  | "approval_3d"
  | "approval_exec"
  | "extra_purchase";
export type PendingPriority = "alta" | "média" | "baixa";
export type PendingStatus = "pendente" | "urgente" | "atrasado";

type PendingItemRow = {
  id: string;
  type: PendingItemType;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  impact: string | null;
  options: Json | null;
  amount: number | null;
  action_url: string | null;
  reference_type: string | null;
  reference_id: string | null;
  status: PendingItemStatus;
  resolved_at: string | null;
  resolved_by: string | null;
};

export interface PendingItem {
  id: string;
  type: PendingType;
  title: string;
  description: string;
  dueDate: string;
  createdDate: string;
  priority: PendingPriority;
  impact?: string;
  options?: string[];
  amount?: number;
  actionUrl?: string;
  referenceType?: string;
  referenceId?: string;
  status: PendingItemStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  resolutionPayload?: Record<string, unknown>;
}

// Map database type to UI type
const mapDbTypeToUiType = (dbType: PendingItemType): PendingType => {
  switch (dbType) {
    case "approve_3d":
      return "approval_3d";
    case "approve_executive":
      return "approval_exec";
    default:
      return dbType as PendingType;
  }
};

// Map UI type to database type
export const mapUiTypeToDbType = (uiType: PendingType): PendingItemType => {
  switch (uiType) {
    case "approval_3d":
      return "approve_3d";
    case "approval_exec":
      return "approve_executive";
    default:
      return uiType as PendingItemType;
  }
};

const statusOrder: Record<PendingStatus, number> = {
  atrasado: 0,
  urgente: 1,
  pendente: 2,
};

// Calculate priority based on due date
const calculatePriority = (dueDate: string | null): PendingPriority => {
  if (!dueDate) return "baixa";
  const due = parseISO(dueDate);
  // BUG FIX: Guard against Invalid Date from empty/malformed string
  if (isNaN(due.getTime())) return "baixa";
  const diff = differenceInDays(due, new Date());
  if (diff < 0) return "alta";
  if (diff <= 5) return "média";
  return "baixa";
};

// Get display status based on due date
export const getStatus = (
  dueDate: string,
  referenceDate: Date = new Date(),
): PendingStatus => {
  if (!dueDate) return "pendente";
  const due = parseISO(dueDate);
  // BUG FIX: Guard against Invalid Date
  if (isNaN(due.getTime())) return "pendente";
  const diff = differenceInDays(due, referenceDate);

  if (diff < 0) return "atrasado";
  if (diff <= 2) return "urgente";
  return "pendente";
};

export const getDaysOverdue = (
  item: PendingItem,
  referenceDate: Date = new Date(),
): number => {
  const due = parseISO(item.dueDate);
  const diff = differenceInDays(referenceDate, due);
  return diff > 0 ? diff : 0;
};

export const getDaysRemaining = (
  item: PendingItem,
  referenceDate: Date = new Date(),
): number => {
  const due = parseISO(item.dueDate);
  return differenceInDays(due, referenceDate);
};

const buildPendingItemsQuery = (
  projectId?: string,
  includeCompleted?: boolean,
) => {
  let query = supabase
    .from("pending_items")
    .select("*")
    .order("due_date", { ascending: true });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  if (!includeCompleted) {
    query = query.eq("status", "pending");
  }

  return query;
};

const mapDbItemToPendingItem = (item: PendingItemRow): PendingItem => ({
  id: item.id,
  type: mapDbTypeToUiType(item.type),
  title: item.title,
  description: item.description || "",
  dueDate: item.due_date || "",
  createdDate: item.created_at,
  priority: calculatePriority(item.due_date),
  impact: item.impact || undefined,
  options: item.options as string[] | undefined,
  amount: item.amount ? Number(item.amount) : undefined,
  actionUrl: item.action_url || undefined,
  referenceType: item.reference_type || undefined,
  referenceId: item.reference_id || undefined,
  status: item.status,
  resolvedAt: item.resolved_at || undefined,
  resolvedBy: item.resolved_by || undefined,
});

// Formalization fallback removed — pendências are now fully driven by
// the pending_items table via DB triggers (create_signature_pending_item,
// resolve_signature_pending_item, maybe_mark_formalization_signed).
// RLS on pending_items ensures only relevant users see signature items.

interface UsePendenciasOptions {
  projectId?: string;
  includeCompleted?: boolean;
}

export const usePendencias = (options: UsePendenciasOptions = {}) => {
  const { projectId, includeCompleted = false } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: pendingItems = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.pendingItems.list(projectId, includeCompleted),
    queryFn: async () => {
      const { data, error } = await buildPendingItemsQuery(
        projectId,
        includeCompleted,
      );
      if (error) {
        if (isDemoMode) {
          console.warn(
            "Pending items query failed (demo mode):",
            error.message,
          );
          return [];
        }
        throw error;
      }
      return (data || []).map((item) =>
        mapDbItemToPendingItem(item as PendingItemRow),
      );
    },
    enabled: !!user,
  });

  // Mutation to resolve a pending item
  const resolveMutation = useMutation({
    mutationFn: async ({
      itemId,
      notes,
      payload,
    }: {
      itemId: string;
      notes?: string;
      payload?: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("pending_items")
        .update({
          status: "completed" as const,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes,
          resolution_payload: (payload || {}) as Json,
        })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingItems.all });
    },
  });

  // Mutation to cancel a pending item
  const cancelMutation = useMutation({
    mutationFn: async ({
      itemId,
      notes,
      payload,
    }: {
      itemId: string;
      notes?: string;
      payload?: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("pending_items")
        .update({
          status: "cancelled" as const,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes,
          resolution_payload: (payload || {}) as Json,
        })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingItems.all });
    },
  });

  // Mutation to create a pending item
  const createMutation = useMutation({
    mutationFn: async (newItem: {
      projectId: string;
      customerOrgId: string;
      type: PendingType;
      title: string;
      description?: string;
      dueDate?: string;
      referenceType?: string;
      referenceId?: string;
      options?: string[];
      impact?: string;
      amount?: number;
      actionUrl?: string;
    }) => {
      const { error } = await supabase.from("pending_items").insert([
        {
          project_id: newItem.projectId,
          customer_org_id: newItem.customerOrgId,
          type: mapUiTypeToDbType(newItem.type) as
            | "approve_3d"
            | "approve_executive"
            | "decision"
            | "extra_purchase"
            | "invoice"
            | "signature",
          title: newItem.title,
          description: newItem.description,
          due_date: newItem.dueDate,
          reference_type: newItem.referenceType,
          reference_id: newItem.referenceId,
          options: newItem.options as Json,
          impact: newItem.impact,
          amount: newItem.amount,
          action_url: newItem.actionUrl,
        },
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingItems.all });
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    return pendingItems.reduce(
      (acc, item) => {
        acc.total += 1;

        if (item.dueDate) {
          const status = getStatus(item.dueDate);
          if (status === "atrasado") acc.overdueCount += 1;
          if (status === "urgente") acc.urgentCount += 1;
          if (status === "pendente") acc.pendingCount += 1;
          if (status === "atrasado" || status === "urgente")
            acc.hasUrgent = true;
        }

        acc.byType[item.type] += 1;

        return acc;
      },
      {
        total: 0,
        overdueCount: 0,
        urgentCount: 0,
        pendingCount: 0,
        byType: {
          decision: 0,
          invoice: 0,
          signature: 0,
          approval_3d: 0,
          approval_exec: 0,
          extra_purchase: 0,
        },
        hasUrgent: false,
      },
    );
  }, [pendingItems]);

  // Sort items by status priority and due date
  const sortedItems = useMemo(() => {
    return [...pendingItems].sort((a, b) => {
      const statusA = a.dueDate ? getStatus(a.dueDate) : "pendente";
      const statusB = b.dueDate ? getStatus(b.dueDate) : "pendente";

      if (statusOrder[statusA] !== statusOrder[statusB]) {
        return statusOrder[statusA] - statusOrder[statusB];
      }

      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
    });
  }, [pendingItems]);

  return {
    pendingItems,
    sortedItems,
    stats,
    isLoading,
    error,
    resolveItem: resolveMutation.mutate,
    cancelItem: cancelMutation.mutate,
    createItem: createMutation.mutate,
    isResolving: resolveMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isCreating: createMutation.isPending,
  };
};
