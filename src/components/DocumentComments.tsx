/**
 * Document Comments Component
 *
 * Displays and manages comments for a document version
 */

import { useState } from "react";
import { MessageSquare, Send, Loader2, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface DocumentComment {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  comment: string;
  page_number: number | null;
  created_at: string;
}

interface DocumentCommentsProps {
  comments: DocumentComment[];
  isLoading?: boolean;
  isPdf?: boolean;
  currentPage?: number;
  canAddComment?: boolean;
  canDeleteComment?: (comment: DocumentComment) => boolean;
  onAddComment?: (comment: string, pageNumber?: number) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onPageClick?: (pageNumber: number) => void;
  className?: string;
}

export function DocumentComments({
  comments,
  isLoading = false,
  isPdf = false,
  currentPage,
  canAddComment = false,
  canDeleteComment,
  onAddComment,
  onDeleteComment,
  onPageClick,
  className,
}: DocumentCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [linkToPage, setLinkToPage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!newComment.trim() || !onAddComment) return;

    setIsSubmitting(true);
    try {
      await onAddComment(
        newComment.trim(),
        linkToPage && isPdf && currentPage ? currentPage : undefined,
      );
      setNewComment("");
      setLinkToPage(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!onDeleteComment) return;

    setDeletingId(commentId);
    try {
      await onDeleteComment(commentId);
    } finally {
      setDeletingId(null);
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Comentários</span>
        <Badge variant="secondary" className="ml-auto">
          {comments.length}
        </Badge>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum comentário ainda</p>
              {canAddComment && (
                <p className="text-xs mt-1">Seja o primeiro a comentar</p>
              )}
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="group flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(comment.user_name, comment.user_email)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">
                      {comment.user_name || comment.user_email || "Usuário"}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(
                        new Date(comment.created_at),
                        "dd/MM 'às' HH:mm",
                        { locale: ptBR },
                      )}
                    </span>
                  </div>

                  {comment.page_number && (
                    <button
                      onClick={() => onPageClick?.(comment.page_number!)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-1"
                    >
                      <FileText className="h-3 w-3" />
                      Página {comment.page_number}
                    </button>
                  )}

                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {comment.comment}
                  </p>
                </div>

                {canDeleteComment?.(comment) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 min-h-[44px] min-w-[44px] opacity-100 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity shrink-0"
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    aria-label="Excluir comentário"
                  >
                    {deletingId === comment.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add Comment Form */}
      {canAddComment && (
        <div className="p-4 border-t border-border space-y-3 shrink-0">
          <Textarea
            placeholder="Adicione um comentário..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
            disabled={isSubmitting}
          />

          <div className="flex items-center justify-between gap-2">
            {isPdf && currentPage && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkToPage}
                  onChange={(e) => setLinkToPage(e.target.checked)}
                  className="rounded border-muted-foreground/30"
                  disabled={isSubmitting}
                />
                Vincular à página {currentPage}
              </label>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting}
              size="sm"
              className="ml-auto gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentComments;
