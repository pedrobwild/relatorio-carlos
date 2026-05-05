/**
 * Files Query Hook
 *
 * TanStack Query-based hook for managing file uploads and metadata.
 * Uses the repository pattern with the new files table.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as filesRepo from "@/infra/repositories/files.repository";
import type { FileFilters } from "@/infra/repositories/files.repository";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

// Re-export types for convenience
export type {
  FileMetadata,
  FileWithUrl,
  FileStatus,
  FileVisibility,
} from "@/infra/repositories/files.repository";

// Query keys for cache management
export const fileKeys = {
  all: ["files"] as const,
  lists: () => [...fileKeys.all, "list"] as const,
  list: (filters: FileFilters) => [...fileKeys.lists(), filters] as const,
  details: () => [...fileKeys.all, "detail"] as const,
  detail: (id: string) => [...fileKeys.details(), id] as const,
};

/**
 * Fetch files with optional filters
 */
export function useFilesQuery(filters: FileFilters = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: fileKeys.list(filters),
    queryFn: async () => {
      const result = await filesRepo.getFiles(filters);
      return result.data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch files for a specific project
 */
export function useProjectFilesQuery(projectId: string | undefined) {
  return useFilesQuery(
    projectId ? { project_id: projectId, status: "active" } : {},
  );
}

/**
 * Fetch a single file by ID with signed URL
 */
export function useFileQuery(fileId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: fileKeys.detail(fileId ?? ""),
    queryFn: async () => {
      if (!fileId) return null;
      const result = await filesRepo.getFileById(fileId);
      if (result.error) throw result.error;
      if (!result.data) return null;

      // Get signed URL
      const url = await filesRepo.getSignedUrl(
        result.data.bucket,
        result.data.storage_path,
      );
      return { ...result.data, url };
    },
    enabled: !!user && !!fileId,
  });
}

/**
 * Mutation for uploading a file
 */
export function useUploadFileMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      file,
      metadata,
    }: {
      file: File;
      metadata: {
        org_id?: string;
        project_id?: string;
        category?: string;
        entity_type?: string;
        entity_id?: string;
        description?: string;
      };
    }) => {
      if (!user) throw new Error("Usuário não autenticado");

      // Use the uploadFile function from repository
      const result = await filesRepo.uploadFile(file, {
        bucket: "project-documents",
        ownerId: user.id,
        orgId: metadata.org_id,
        projectId: metadata.project_id,
        category: metadata.category,
        entityType: metadata.entity_type,
        entityId: metadata.entity_id,
        description: metadata.description,
      });

      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Arquivo enviado com sucesso");
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
      if (variables.metadata.project_id) {
        queryClient.invalidateQueries({
          queryKey: fileKeys.list({
            project_id: variables.metadata.project_id,
          }),
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao enviar arquivo");
    },
  });
}

/**
 * Mutation for soft-deleting a file
 */
export function useDeleteFileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string) => {
      const result = await filesRepo.softDeleteFile(fileId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      toast.success("Arquivo removido");
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
    onError: () => {
      toast.error("Erro ao remover arquivo");
    },
  });
}

/**
 * Mutation for archiving a file
 */
export function useArchiveFileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string) => {
      const result = await filesRepo.archiveFile(fileId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      toast.success("Arquivo arquivado");
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
    },
    onError: () => {
      toast.error("Erro ao arquivar arquivo");
    },
  });
}

/**
 * Hook to get a signed URL for a file
 */
export function useFileSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["file-url", bucket, path],
    queryFn: async () => {
      return filesRepo.getSignedUrl(bucket, path, expiresIn);
    },
    enabled: !!user && !!bucket && !!path,
    staleTime: (expiresIn - 60) * 1000, // Refresh 1 minute before expiry
  });
}
