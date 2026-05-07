/**
 * Document Viewer Modal
 *
 * Full-featured document viewer with comments panel
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  History,
  MessageSquare,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { DocumentViewer } from "@/components/DocumentViewer";
import {
  DocumentComments,
  type DocumentComment,
} from "@/components/DocumentComments";
import { useDocumentComments } from "@/hooks/useDocumentComments";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";

export interface DocumentForViewer {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  document_type: string;
  version: number;
  status: "pending" | "approved";
  mime_type?: string | null;
  size_bytes?: number | null;
  checksum?: string | null;
  url?: string | null;
  created_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  approver_name?: string | null;
}

interface DocumentViewerModalProps {
  document: DocumentForViewer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Version history for sidebar */
  versionHistory?: DocumentForViewer[];
  /** Callback when version is selected */
  onVersionSelect?: (doc: DocumentForViewer) => void;
  /** Called when user requests to view history */
  onViewHistory?: () => void;
}

export function DocumentViewerModal({
  document,
  open,
  onOpenChange,
  versionHistory = [],
  onVersionSelect,
  onViewHistory,
}: DocumentViewerModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"viewer" | "comments">("viewer");
  const { can } = useCan();

  const {
    comments,
    isLoading: commentsLoading,
    addComment,
    deleteComment,
    canDeleteComment,
  } = useDocumentComments(document?.id, document?.version);

  const canAddComment = can("documents:upload"); // Staff can comment
  const isPdf = document?.mime_type === "application/pdf";

  const handleAddComment = useCallback(
    async (comment: string, pageNumber?: number) => {
      if (!document) return;
      await addComment(
        document.project_id,
        document.id,
        document.version,
        comment,
        pageNumber,
      );
    },
    [document, addComment],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      await deleteComment(commentId);
    },
    [deleteComment],
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageClick = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
    setActiveTab("viewer");
  }, []);

  if (!document) return null;

  const formattedComments: DocumentComment[] = comments.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    user_name: c.user_name,
    user_email: c.user_email,
    comment: c.comment,
    page_number: c.page_number,
    created_at: c.created_at,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[95dvh] sm:h-[90vh] max-h-[95dvh] sm:max-h-[90vh] p-0 !flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base truncate">
                {document.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  Versão {document.version}
                </span>
                <Badge
                  variant={
                    document.status === "approved" ? "default" : "secondary"
                  }
                  className={cn(
                    "text-xs gap-1",
                    document.status === "approved" &&
                      "bg-[hsl(var(--success))]",
                  )}
                >
                  {document.status === "approved" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Aprovado
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      Pendente
                    </>
                  )}
                </Badge>
                {document.checksum && (
                  <span
                    className="text-xs text-muted-foreground font-mono flex items-center gap-1"
                    title={document.checksum}
                  >
                    <ShieldCheck className="h-3 w-3 text-[hsl(var(--success))]" />
                    SHA256: {document.checksum.substring(0, 8)}...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {versionHistory.length > 1 && onViewHistory && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={onViewHistory}
                >
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">Histórico</span>
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Viewer */}
          <div className="flex-1 min-w-0">
            {/* Mobile Tab Switcher */}
            <div className="md:hidden border-b border-border">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "viewer" | "comments")}
              >
                <TabsList className="w-full justify-start rounded-none h-auto p-0 bg-transparent">
                  <TabsTrigger
                    value="viewer"
                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Documento
                  </TabsTrigger>
                  <TabsTrigger
                    value="comments"
                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Comentários ({comments.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Mobile Content */}
            <div className="md:hidden h-[calc(100%-49px)]">
              {activeTab === "viewer" ? (
                document.url && (
                  <DocumentViewer
                    url={document.url}
                    title={document.name}
                    mimeType={document.mime_type}
                    onPageChange={handlePageChange}
                    className="h-full rounded-none border-0"
                  />
                )
              ) : (
                <DocumentComments
                  comments={formattedComments}
                  isLoading={commentsLoading}
                  isPdf={isPdf}
                  currentPage={currentPage}
                  canAddComment={canAddComment}
                  canDeleteComment={(c) =>
                    canDeleteComment(comments.find((cc) => cc.id === c.id)!)
                  }
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onPageClick={handlePageClick}
                  className="h-full"
                />
              )}
            </div>

            {/* Desktop Content */}
            <div className="hidden md:block h-full">
              {document.url && (
                <DocumentViewer
                  url={document.url}
                  title={document.name}
                  mimeType={document.mime_type}
                  onPageChange={handlePageChange}
                  className="h-full rounded-none border-0 border-r"
                />
              )}
            </div>
          </div>

          {/* Desktop Comments Sidebar */}
          <div className="hidden md:flex w-[350px] shrink-0 border-l border-border flex-col bg-card">
            <DocumentComments
              comments={formattedComments}
              isLoading={commentsLoading}
              isPdf={isPdf}
              currentPage={currentPage}
              canAddComment={canAddComment}
              canDeleteComment={(c) =>
                canDeleteComment(comments.find((cc) => cc.id === c.id)!)
              }
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onPageClick={handlePageClick}
              className="h-full"
            />
          </div>
        </div>

        {/* Version History Footer (if multiple versions) */}
        {versionHistory.length > 1 && (
          <div className="border-t border-border p-3 shrink-0 bg-muted/30">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-muted-foreground shrink-0">
                Versões:
              </span>
              {versionHistory.map((ver) => (
                <Button
                  key={ver.id}
                  variant={ver.id === document.id ? "secondary" : "ghost"}
                  size="sm"
                  className="shrink-0 h-9 min-h-[44px] text-xs"
                  onClick={() => onVersionSelect?.(ver)}
                >
                  v{ver.version}
                  {ver.status === "approved" && (
                    <CheckCircle2 className="h-3 w-3 ml-1 text-[hsl(var(--success))]" />
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DocumentViewerModal;
