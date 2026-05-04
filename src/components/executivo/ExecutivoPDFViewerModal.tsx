import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  FileText,
  Send,
  Trash2,
  MessageSquare,
  User,
  Download,
} from "lucide-react";
import {
  useExecutivoFile,
  useExecutivoComments,
} from "@/hooks/useExecutivoVersions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PDFViewer from "@/components/PDFViewer";

interface Props {
  versionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutivoPDFViewerModal({
  versionId,
  open,
  onOpenChange,
}: Props) {
  const { data: file, isLoading: fileLoading } = useExecutivoFile(versionId);
  const fileId = file?.id;
  const {
    comments,
    loading: commentsLoading,
    addComment,
    deleteComment,
  } = useExecutivoComments(fileId);
  const { user } = useAuth();
  const { isStaff } = useUserRole();
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleSendComment = useCallback(async () => {
    if (!commentText.trim() || !fileId) return;
    setSaving(true);
    try {
      await addComment({ fileId, text: commentText.trim() });
      setCommentText("");
    } catch {
      /* error handled by mutation */
    } finally {
      setSaving(false);
    }
  }, [commentText, fileId, addComment]);

  const canDelete = useCallback(
    (authorId: string) => {
      return authorId === user?.id || isStaff;
    },
    [user, isStaff],
  );

  const handleDownload = useCallback(async () => {
    if (!file?.storage_path) return;
    setDownloading(true);
    try {
      const { data: blob, error } = await supabase.storage
        .from("project-documents")
        .download(file.storage_path);
      if (error || !blob) throw new Error("Erro ao baixar");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `projeto-executivo.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao baixar arquivo");
    } finally {
      setDownloading(false);
    }
  }, [file]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] h-[95dvh] sm:h-[90vh] p-0 flex flex-col gap-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Projeto Executivo
            </DialogTitle>
            {file?.storage_path && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={downloading}
                onClick={handleDownload}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Baixar PDF
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* PDF Viewer */}
          <div className="flex-1 min-h-0 bg-muted/30">
            {fileLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !file?.url ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <FileText className="h-12 w-12 opacity-30" />
                <p className="text-sm">Nenhum PDF nesta versão</p>
              </div>
            ) : (
              <PDFViewer url={file.url} title="Projeto Executivo" />
            )}
          </div>

          {/* Comments sidebar */}
          <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border flex flex-col max-h-[40vh] lg:max-h-none">
            <div className="p-3 border-b border-border shrink-0">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Comentários
                {comments.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({comments.length})
                  </span>
                )}
              </h3>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum comentário ainda
                  </p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="group rounded-lg bg-muted/50 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">
                          {comment.author_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(comment.created_at), "dd/MM HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                        {canDelete(comment.author_user_id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => deleteComment(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {comment.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Comment input */}
            <div className="p-3 border-t border-border shrink-0">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Escreva um comentário..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="min-h-[44px] max-h-[100px] text-sm resize-none flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendComment();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="shrink-0 h-[44px] w-[44px]"
                  disabled={saving || !commentText.trim() || !fileId}
                  onClick={handleSendComment}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
