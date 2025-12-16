import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, differenceInDays } from "date-fns";
import { useAuth } from "./useAuth";
import { isDemoMode } from "@/config/flags";

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
export type PendingType = "decision" | "invoice" | "signature" | "approval_3d" | "approval_exec" | "extra_purchase";
export type PendingPriority = "alta" | "média" | "baixa";
export type PendingStatus = "pendente" | "urgente" | "atrasado";

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
}

// Map database type to UI type
const mapDbTypeToUiType = (dbType: PendingItemType): PendingType => {
  switch (dbType) {
    case "approve_3d": return "approval_3d";
    case "approve_executive": return "approval_exec";
    default: return dbType as PendingType;
  }
};

// Map UI type to database type
export const mapUiTypeToDbType = (uiType: PendingType): PendingItemType => {
  switch (uiType) {
    case "approval_3d": return "approve_3d";
    case "approval_exec": return "approve_executive";
    default: return uiType as PendingItemType;
  }
};

// Calculate priority based on due date
const calculatePriority = (dueDate: string | null): PendingPriority => {
  if (!dueDate) return "baixa";
  const due = parseISO(dueDate);
  const diff = differenceInDays(due, new Date());
  if (diff < 0) return "alta";
  if (diff <= 5) return "média";
  return "baixa";
};

// Get display status based on due date
export const getStatus = (dueDate: string, referenceDate: Date = new Date()): PendingStatus => {
  const due = parseISO(dueDate);
  const diff = differenceInDays(due, referenceDate);
  
  if (diff < 0) return "atrasado";
  if (diff <= 2) return "urgente";
  return "pendente";
};

export const getDaysOverdue = (item: PendingItem, referenceDate: Date = new Date()): number => {
  const due = parseISO(item.dueDate);
  const diff = differenceInDays(referenceDate, due);
  return diff > 0 ? diff : 0;
};

export const getDaysRemaining = (item: PendingItem, referenceDate: Date = new Date()): number => {
  const due = parseISO(item.dueDate);
  return differenceInDays(due, referenceDate);
};

interface UsePendenciasOptions {
  projectId?: string;
  includeCompleted?: boolean;
}

export const usePendencias = (options: UsePendenciasOptions = {}) => {
  const { projectId, includeCompleted = false } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingItems = [], isLoading, error } = useQuery({
    queryKey: ["pending-items", projectId, includeCompleted],
    queryFn: async () => {
      // TODO: In production, this will query the backend
      // For now, return empty array when not in demo mode
      if (!isDemoMode) {
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

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map((item): PendingItem => ({
          id: item.id,
          type: mapDbTypeToUiType(item.type as PendingItemType),
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
          status: item.status as PendingItemStatus,
          resolvedAt: item.resolved_at || undefined,
          resolvedBy: item.resolved_by || undefined,
        }));
      }

      // Demo mode: query database but return empty on error
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

      const { data, error } = await query;

      // In demo mode, silently return empty array on error
      if (error) {
        console.warn('Pending items query failed (demo mode):', error.message);
        return [];
      }

      return (data || []).map((item): PendingItem => ({
        id: item.id,
        type: mapDbTypeToUiType(item.type as PendingItemType),
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
        status: item.status as PendingItemStatus,
        resolvedAt: item.resolved_at || undefined,
        resolvedBy: item.resolved_by || undefined,
      }));
    },
    enabled: !!user,
  });

  // Mutation to resolve a pending item
  const resolveMutation = useMutation({
    mutationFn: async ({ 
      itemId, 
      notes 
    }: { 
      itemId: string; 
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("pending_items")
        .update({
          status: "completed" as const,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes,
        })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-items"] });
    },
  });

  // Mutation to cancel a pending item
  const cancelMutation = useMutation({
    mutationFn: async ({ 
      itemId, 
      notes 
    }: { 
      itemId: string; 
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("pending_items")
        .update({
          status: "cancelled" as const,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes,
        })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-items"] });
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
      const { error } = await supabase
        .from("pending_items")
        .insert({
          project_id: newItem.projectId,
          customer_org_id: newItem.customerOrgId,
          type: mapUiTypeToDbType(newItem.type),
          title: newItem.title,
          description: newItem.description,
          due_date: newItem.dueDate,
          reference_type: newItem.referenceType,
          reference_id: newItem.referenceId,
          options: newItem.options,
          impact: newItem.impact,
          amount: newItem.amount,
          action_url: newItem.actionUrl,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-items"] });
    },
  });

  // Calculate stats
  const stats = {
    total: pendingItems.length,
    overdueCount: pendingItems.filter(item => item.dueDate && getStatus(item.dueDate) === "atrasado").length,
    urgentCount: pendingItems.filter(item => item.dueDate && getStatus(item.dueDate) === "urgente").length,
    pendingCount: pendingItems.filter(item => item.dueDate && getStatus(item.dueDate) === "pendente").length,
    byType: {
      decision: pendingItems.filter(item => item.type === "decision").length,
      invoice: pendingItems.filter(item => item.type === "invoice").length,
      signature: pendingItems.filter(item => item.type === "signature").length,
      approval_3d: pendingItems.filter(item => item.type === "approval_3d").length,
      approval_exec: pendingItems.filter(item => item.type === "approval_exec").length,
      extra_purchase: pendingItems.filter(item => item.type === "extra_purchase").length,
    },
    hasUrgent: pendingItems.some(item => 
      item.dueDate && (getStatus(item.dueDate) === "atrasado" || getStatus(item.dueDate) === "urgente")
    ),
  };

  // Sort items by status priority and due date
  const sortedItems = [...pendingItems].sort((a, b) => {
    const statusOrder = { atrasado: 0, urgente: 1, pendente: 2 };
    const statusA = a.dueDate ? getStatus(a.dueDate) : "pendente";
    const statusB = b.dueDate ? getStatus(b.dueDate) : "pendente";
    
    if (statusOrder[statusA] !== statusOrder[statusB]) {
      return statusOrder[statusA] - statusOrder[statusB];
    }
    
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
  });

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
