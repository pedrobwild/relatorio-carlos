/**
 * Hook for document comments
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDocumentComments,
  addDocumentComment,
  deleteDocumentComment,
  type DocumentCommentWithUser,
  type CreateCommentInput,
} from "@/infra/repositories/documents.repository";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useDocumentComments(
  documentId: string | undefined,
  version?: number,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ["documentComments", documentId, version];

  const {
    data: comments = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!documentId) return [];
      const result = await getDocumentComments(documentId, version);
      if (result.error) throw result.error;
      return result.data ?? [];
    },
    enabled: !!documentId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (
      input: Omit<
        CreateCommentInput,
        "project_id" | "document_id" | "version"
      > & {
        project_id: string;
        document_id: string;
        version: number;
      },
    ) => {
      if (!user?.id) throw new Error("Não autenticado");

      const result = await addDocumentComment(input, user.id);
      if (result.error) throw result.error;
      return result.data;
    },
    onMutate: async (newComment) => {
      await queryClient.cancelQueries({ queryKey });

      const previousComments =
        queryClient.getQueryData<DocumentCommentWithUser[]>(queryKey);

      // Optimistic update
      const optimisticComment: DocumentCommentWithUser = {
        id: `temp-${Date.now()}`,
        project_id: newComment.project_id,
        document_id: newComment.document_id,
        version: newComment.version,
        user_id: user?.id ?? "",
        comment: newComment.comment,
        page_number: newComment.page_number ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_name: user?.email?.split("@")[0],
        user_email: user?.email ?? undefined,
      };

      queryClient.setQueryData<DocumentCommentWithUser[]>(queryKey, (old) => [
        ...(old ?? []),
        optimisticComment,
      ]);

      return { previousComments };
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(queryKey, context?.previousComments);
      toast.error("Erro ao adicionar comentário");
    },
    onSuccess: () => {
      toast.success("Comentário adicionado");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const result = await deleteDocumentComment(commentId);
      if (result.error) throw result.error;
      return commentId;
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey });

      const previousComments =
        queryClient.getQueryData<DocumentCommentWithUser[]>(queryKey);

      queryClient.setQueryData<DocumentCommentWithUser[]>(queryKey, (old) =>
        (old ?? []).filter((c) => c.id !== commentId),
      );

      return { previousComments };
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(queryKey, context?.previousComments);
      toast.error("Erro ao excluir comentário");
    },
    onSuccess: () => {
      toast.success("Comentário excluído");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const addComment = async (
    projectId: string,
    documentId: string,
    version: number,
    comment: string,
    pageNumber?: number,
  ) => {
    return addCommentMutation.mutateAsync({
      project_id: projectId,
      document_id: documentId,
      version,
      comment,
      page_number: pageNumber,
    });
  };

  const deleteComment = async (commentId: string) => {
    return deleteCommentMutation.mutateAsync(commentId);
  };

  const canDeleteComment = (comment: DocumentCommentWithUser): boolean => {
    return comment.user_id === user?.id;
  };

  return {
    comments,
    isLoading,
    error,
    addComment,
    deleteComment,
    canDeleteComment,
    isAddingComment: addCommentMutation.isPending,
    isDeletingComment: deleteCommentMutation.isPending,
  };
}
