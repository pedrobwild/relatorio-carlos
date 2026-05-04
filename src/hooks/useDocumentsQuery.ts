/**
 * Documents Query Hook
 *
 * TanStack Query-based hook for fetching and managing project documents.
 * Uses the repository pattern for data access.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as documentsRepo from "@/infra/repositories/documents.repository";
import type {
  DocumentCategory,
  DocumentStatus,
  DocumentWithUrl,
} from "@/infra/repositories/documents.repository";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

// Re-export types and constants for convenience
export { DOCUMENT_CATEGORIES } from "@/infra/repositories/documents.repository";
export type {
  DocumentCategory,
  DocumentStatus,
  DocumentWithUrl,
} from "@/infra/repositories/documents.repository";

// Query keys for cache management
export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (projectId: string) => [...documentKeys.lists(), projectId] as const,
  byCategory: (projectId: string, category: DocumentCategory) =>
    [...documentKeys.list(projectId), "category", category] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  versions: (documentId: string) =>
    [...documentKeys.detail(documentId), "versions"] as const,
};

/**
 * Fetch all documents for a project with signed URLs
 */
export function useDocumentsQuery(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: documentKeys.list(projectId ?? ""),
    queryFn: async () => {
      if (!projectId) return [];
      const result = await documentsRepo.getProjectDocuments(projectId);
      if (result.error) throw result.error;

      // Get signed URLs for all documents
      const docsWithUrls = await documentsRepo.getSignedUrls(result.data);
      return docsWithUrls;
    },
    enabled: !!user && !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch documents by category for a project
 */
export function useDocumentsByCategoryQuery(
  projectId: string | undefined,
  category: DocumentCategory,
) {
  const documentsQuery = useDocumentsQuery(projectId);

  // Filter from the full list to avoid duplicate requests
  const categoryDocs =
    documentsQuery.data?.filter((doc) => doc.document_type === category) ?? [];

  return {
    ...documentsQuery,
    data: categoryDocs,
  };
}

/**
 * Get version history for a document
 */
export function useDocumentVersionsQuery(documentId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: documentKeys.versions(documentId ?? ""),
    queryFn: (): DocumentWithUrl[] => {
      if (!documentId) return [];

      // Try to get from cached documents list
      const allCachedQueries = queryClient.getQueriesData<DocumentWithUrl[]>({
        queryKey: documentKeys.lists(),
      });

      // Find the document in any cached list
      for (const [, docs] of allCachedQueries) {
        if (docs && Array.isArray(docs) && docs.length > 0) {
          const doc = docs.find((d) => d.id === documentId);
          if (!doc) continue;

          const rootId = doc.parent_document_id || doc.id;
          const versions = docs
            .filter((d) => d.id === rootId || d.parent_document_id === rootId)
            .sort((a, b) => b.version - a.version);

          if (versions.length > 0) {
            return versions;
          }
        }
      }

      return [];
    },
    enabled: !!user && !!documentId,
  });
}

/**
 * Get latest version of each document by category
 */
export function useLatestDocumentsByCategoryQuery(
  projectId: string | undefined,
  category: DocumentCategory,
) {
  const documentsQuery = useDocumentsQuery(projectId);

  // Derive latest documents from the full list
  const latestDocuments = documentsQuery.data
    ? documentsRepo.getLatestDocumentsByCategory(documentsQuery.data, category)
    : [];

  return {
    ...documentsQuery,
    data: latestDocuments,
  };
}

/**
 * Mutation for deleting a document
 */
export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const result = await documentsRepo.deleteDocument(documentId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      toast.success("Documento excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      // Also invalidate the legacy queryKeys used by useDocuments hook
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err) => {
      console.error("[Documents] Delete failed:", err);
      toast.error("Erro ao excluir documento");
    },
  });
}

/**
 * Helper hook to get category label
 */
export function useDocumentCategoryLabel(category: DocumentCategory): string {
  return documentsRepo.DOCUMENT_CATEGORIES[category]?.label ?? category;
}

/**
 * Helper to check if a document needs approval
 */
export function documentNeedsApproval(
  _category: DocumentCategory,
  _status: DocumentStatus,
): boolean {
  // Documents attached to a project do not require approval
  return false;
}
