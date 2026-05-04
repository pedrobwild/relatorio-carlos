/**
 * Documents Hook - TanStack Query Version
 *
 * Migrated from useState/useEffect to useQuery/useMutation pattern.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { queryKeys, invalidateDocumentQueries } from "@/lib/queryKeys";
import { documentLogger } from "@/lib/devLogger";

export const DOCUMENT_CATEGORIES = {
  contrato: { label: "Contrato", icon: "FileText" },
  aditivo: { label: "Aditivos", icon: "FilePlus" },
  projeto_3d: { label: "Projeto 3D", icon: "Box" },
  executivo: { label: "Projeto Executivo", icon: "Ruler" },
  art_rrt: { label: "ART/RRT", icon: "Award" },
  plano_reforma: { label: "Plano de Reforma", icon: "ClipboardList" },
  nota_fiscal: { label: "Notas Fiscais", icon: "Receipt" },
  garantia: { label: "Garantias", icon: "Shield" },
  as_built: { label: "As Built", icon: "Building" },
  termo_entrega: { label: "Termo de Entrega", icon: "CheckSquare" },
} as const;

export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;
export type DocumentStatus = "pending" | "approved";

export interface ProjectDocument {
  id: string;
  project_id: string;
  document_type: DocumentCategory;
  name: string;
  description: string | null;
  storage_path: string;
  storage_bucket: string;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  status: DocumentStatus;
  uploaded_by: string;
  approved_at: string | null;
  approved_by: string | null;
  parent_document_id: string | null;
  checksum: string | null;
  created_at: string;
  url?: string;
}

// Fetch documents with signed URLs
// URLs are valid for 1 hour; we set staleTime to 30min to refresh before expiration
async function fetchDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from("project_documents")
    .select("*")
    .eq("project_id", projectId)
    .order("document_type")
    .order("version", { ascending: false });

  if (error) throw error;

  // Get signed URLs for each document (1 hour expiration)
  // Using Promise.allSettled to avoid one failed URL breaking the entire fetch
  const results = await Promise.allSettled(
    (data || []).map(async (doc) => {
      try {
        // Try signed URL first
        const { data: urlData, error: urlError } = await supabase.storage
          .from(doc.storage_bucket)
          .createSignedUrl(doc.storage_path, 3600); // 1 hour

        let url = urlData?.signedUrl;

        // Fallback to public URL if signed URL fails (bucket is public)
        if (!url || urlError) {
          console.warn(
            `[Documents] Signed URL failed for ${doc.name}, trying public URL:`,
            urlError?.message,
          );
          const { data: publicData } = supabase.storage
            .from(doc.storage_bucket)
            .getPublicUrl(doc.storage_path);
          url = publicData?.publicUrl || undefined;
        }

        if (!url) {
          console.error(
            `[Documents] No URL generated for ${doc.name} (bucket: ${doc.storage_bucket}, path: ${doc.storage_path})`,
          );
        }

        return {
          ...doc,
          document_type: doc.document_type as DocumentCategory,
          status: doc.status as DocumentStatus,
          url,
        } as ProjectDocument;
      } catch (err) {
        console.warn(`[Documents] Error fetching URL for ${doc.name}:`, err);
        // Final fallback to public URL
        const { data: publicData } = supabase.storage
          .from(doc.storage_bucket)
          .getPublicUrl(doc.storage_path);
        return {
          ...doc,
          document_type: doc.document_type as DocumentCategory,
          status: doc.status as DocumentStatus,
          url: publicData?.publicUrl || undefined,
        } as ProjectDocument;
      }
    }),
  );

  // Extract successful results
  const docs = results
    .filter(
      (r): r is PromiseFulfilledResult<ProjectDocument> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);

  const withoutUrl = docs.filter((d) => !d.url);
  if (withoutUrl.length > 0) {
    console.warn(
      `[Documents] ${withoutUrl.length} documents without URL:`,
      withoutUrl.map((d) => d.name),
    );
  }

  return docs;
}

export function useDocuments(projectId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Main query for documents
  const {
    data: documents = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.documents.list(projectId),
    queryFn: () => fetchDocuments(projectId!),
    enabled: !!projectId && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes — keep fresh so new uploads appear quickly
    gcTime: 30 * 60 * 1000, // 30 minutes (signed URLs valid for 1 hour)
    refetchOnWindowFocus: true, // Ensure documents refresh when user switches tabs
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
    // Signed URLs expire in 1h. Persisting them to localStorage would restore
    // expired URLs after a reload, breaking previews. Always refetch fresh.
    meta: { persist: false },
  });

  // Approve document mutation with optimistic update
  const approveMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!user) throw new Error("User not authenticated");

      const operationId = `approve-${documentId}`;
      documentLogger.start(operationId, "Approving document", {
        documentId,
        userId: user.id,
      });

      const { error: updateError } = await supabase
        .from("project_documents")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", documentId);

      if (updateError) {
        documentLogger.error(operationId, updateError, { documentId });
        throw updateError;
      }

      documentLogger.end(operationId, { level: "success" });
      return documentId;
    },
    // Optimistic update
    onMutate: async (documentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.documents.list(projectId),
      });

      // Snapshot current value
      const previousDocuments = queryClient.getQueryData<ProjectDocument[]>(
        queryKeys.documents.list(projectId),
      );

      // Optimistically update
      if (previousDocuments) {
        queryClient.setQueryData<ProjectDocument[]>(
          queryKeys.documents.list(projectId),
          previousDocuments.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  status: "approved" as DocumentStatus,
                  approved_at: new Date().toISOString(),
                  approved_by: user?.id || "",
                }
              : doc,
          ),
        );
      }

      return { previousDocuments };
    },
    onError: (_error, _documentId, context) => {
      // Rollback on error
      if (context?.previousDocuments) {
        queryClient.setQueryData(
          queryKeys.documents.list(projectId),
          context.previousDocuments,
        );
      }
      toast.error("Erro ao aprovar documento");
    },
    onSuccess: () => {
      toast.success("Documento aprovado com sucesso");
    },
    onSettled: () => {
      // Always refetch after mutation to ensure consistency
      if (projectId) {
        invalidateDocumentQueries(projectId);
      }
    },
  });

  // Helper functions
  const getDocumentsByCategory = (category: DocumentCategory) => {
    return documents.filter((doc) => doc.document_type === category);
  };

  const getLatestByCategory = (category: DocumentCategory) => {
    const docs = getDocumentsByCategory(category);
    // Get the latest version of each unique document
    const latestDocs = docs.reduce((acc, doc) => {
      if (!doc.parent_document_id) {
        // This is a root document, check if we have a newer version
        const newerVersions = docs.filter(
          (d) => d.parent_document_id === doc.id,
        );
        if (newerVersions.length > 0) {
          // Use the newest version
          const newest = newerVersions.sort((a, b) => b.version - a.version)[0];
          acc.push(newest);
        } else {
          acc.push(doc);
        }
      }
      return acc;
    }, [] as ProjectDocument[]);

    return latestDocs.length > 0
      ? latestDocs
      : docs.filter((d) => !d.parent_document_id);
  };

  const getVersionHistory = (documentId: string) => {
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return [];

    const rootId = doc.parent_document_id || doc.id;
    return documents
      .filter((d) => d.id === rootId || d.parent_document_id === rootId)
      .sort((a, b) => b.version - a.version);
  };

  const approveDocument = async (documentId: string): Promise<boolean> => {
    try {
      await approveMutation.mutateAsync(documentId);
      return true;
    } catch {
      return false;
    }
  };

  return {
    documents,
    loading,
    error: error ? (error as Error).message : null,
    getDocumentsByCategory,
    getLatestByCategory,
    getVersionHistory,
    approveDocument,
    refetch,
    isApproving: approveMutation.isPending,
  };
}

/**
 * Hook to get a single document by ID with signed URL
 */
export function useDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documents.detail(documentId),
    queryFn: async () => {
      if (!documentId) return null;

      const { data, error } = await supabase
        .from("project_documents")
        .select("*")
        .eq("id", documentId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Get signed URL, fallback to public URL
      const { data: urlData, error: urlError } = await supabase.storage
        .from(data.storage_bucket)
        .createSignedUrl(data.storage_path, 3600);

      let url = urlData?.signedUrl;
      if (!url || urlError) {
        const { data: publicData } = supabase.storage
          .from(data.storage_bucket)
          .getPublicUrl(data.storage_path);
        url = publicData?.publicUrl || undefined;
      }

      return {
        ...data,
        document_type: data.document_type as DocumentCategory,
        status: data.status as DocumentStatus,
        url,
      } as ProjectDocument;
    },
    enabled: !!documentId,
    staleTime: 2 * 60 * 1000, // 2 minutes (match list query)
    // Signed URL expires in 1h — never restore from localStorage.
    meta: { persist: false },
  });
}
