/**
 * Prefetch helpers for TanStack Query
 *
 * Enables prefetching data on hover/focus for instant tab switching.
 */

import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { perf } from "@/lib/perf";

// Track which prefetches have been triggered to avoid duplicates
const prefetchedKeys = new Set<string>();

/**
 * Prefetch documents for a project
 */
export async function prefetchDocuments(
  projectId: string | undefined,
): Promise<void> {
  if (!projectId) return;

  const key = `documents-${projectId}`;
  if (prefetchedKeys.has(key)) return;
  prefetchedKeys.add(key);

  perf.mark(`prefetch-docs-${projectId}`);

  await queryClient.prefetchQuery({
    queryKey: queryKeys.documents.list(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_documents")
        .select("id, name, document_type, status, version, created_at")
        .eq("project_id", projectId)
        .order("document_type")
        .order("version", { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  perf.measure(`Prefetch Documents`, `prefetch-docs-${projectId}`);
}

/**
 * Prefetch activities for a project (for Gantt/Schedule)
 */
export async function prefetchActivities(
  projectId: string | undefined,
): Promise<void> {
  if (!projectId) return;

  const key = `activities-${projectId}`;
  if (prefetchedKeys.has(key)) return;
  prefetchedKeys.add(key);

  perf.mark(`prefetch-activities-${projectId}`);

  await queryClient.prefetchQuery({
    queryKey: queryKeys.activities.list(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_activities")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  perf.measure(`Prefetch Activities`, `prefetch-activities-${projectId}`);
}

/**
 * Prefetch weekly reports for a project
 */
export async function prefetchWeeklyReports(
  projectId: string | undefined,
): Promise<void> {
  if (!projectId) return;

  const key = `reports-${projectId}`;
  if (prefetchedKeys.has(key)) return;
  prefetchedKeys.add(key);

  perf.mark(`prefetch-reports-${projectId}`);

  await queryClient.prefetchQuery({
    queryKey: queryKeys.weeklyReports.list(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_reports")
        .select("id, week_number, week_start, week_end, updated_at")
        .eq("project_id", projectId)
        .order("week_number", { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  perf.measure(`Prefetch Reports`, `prefetch-reports-${projectId}`);
}

/**
 * Prefetch payments for a project
 */
export async function prefetchPayments(
  projectId: string | undefined,
): Promise<void> {
  if (!projectId) return;

  const key = `payments-${projectId}`;
  if (prefetchedKeys.has(key)) return;
  prefetchedKeys.add(key);

  await queryClient.prefetchQuery({
    queryKey: queryKeys.payments.list(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_payments")
        .select(
          "id, installment_number, description, amount, due_date, paid_at",
        )
        .eq("project_id", projectId)
        .order("installment_number", { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Prefetch purchases for a project
 */
export async function prefetchPurchases(
  projectId: string | undefined,
): Promise<void> {
  if (!projectId) return;

  const key = `purchases-${projectId}`;
  if (prefetchedKeys.has(key)) return;
  prefetchedKeys.add(key);

  await queryClient.prefetchQuery({
    queryKey: queryKeys.purchases.list(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_purchases")
        .select("id, item_name, status, required_by_date, estimated_cost")
        .eq("project_id", projectId)
        .order("required_by_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Prefetch formalizations for a project
 */
export async function prefetchFormalizations(
  projectId: string | undefined,
): Promise<void> {
  if (!projectId) return;

  const key = `formalizations-${projectId}`;
  if (prefetchedKeys.has(key)) return;
  prefetchedKeys.add(key);

  await queryClient.prefetchQuery({
    queryKey: queryKeys.formalizacoes.list({ projectId }),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formalizations")
        .select("id, title, type, status, created_at, updated_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Prefetch pending items for a project
 */
export async function prefetchPendingItems(
  projectId: string | undefined,
): Promise<void> {
  if (!projectId) return;

  const key = `pending-${projectId}`;
  if (prefetchedKeys.has(key)) return;
  prefetchedKeys.add(key);

  await queryClient.prefetchQuery({
    queryKey: queryKeys.pendingItems.list(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_items")
        .select("id, title, type, status, due_date")
        .eq("project_id", projectId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Clear prefetch tracking (useful for testing or logout)
 */
export function clearPrefetchCache(): void {
  prefetchedKeys.clear();
}

/**
 * Prefetch data based on tab name
 */
export function prefetchForTab(
  tabName: string,
  projectId: string | undefined,
): void {
  if (!projectId) return;

  switch (tabName) {
    case "curvaS":
    case "gantt":
      prefetchActivities(projectId);
      break;
    case "relatorio":
      prefetchWeeklyReports(projectId);
      break;
    case "documentos":
      prefetchDocuments(projectId);
      break;
    case "pendencias":
      prefetchPendingItems(projectId);
      break;
    case "financeiro":
      prefetchPayments(projectId);
      break;
    case "compras":
      prefetchPurchases(projectId);
      break;
    case "formalizacoes":
      prefetchFormalizations(projectId);
      break;
  }
}

/**
 * Hook-like helper for onMouseEnter/onFocus events on tab triggers
 */
export function createTabPrefetcher(projectId: string | undefined) {
  return {
    onMouseEnter: (tabName: string) => () => {
      prefetchForTab(tabName, projectId);
    },
    onFocus: (tabName: string) => () => {
      prefetchForTab(tabName, projectId);
    },
  };
}
