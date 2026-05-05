import { useState, useCallback, useMemo } from "react";
import { Download, FileText, Box, Ruler, Award, ClipboardList, Receipt, Shield, Building, CheckSquare, FilePlus, Loader2, History, ShieldCheck, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentViewer } from "@/components/DocumentViewer";
import { useProject } from "@/contexts/ProjectContext";
import {
  useDocuments,
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  ProjectDocument,
} from "@/hooks/useDocuments";
import { useDeleteDocumentMutation } from "@/hooks/useDocumentsQuery";
import { useJourneyVersionDocuments } from "@/hooks/useJourneyVersionDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { useCan } from "@/hooks/useCan";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentVersionUpload } from "@/components/DocumentVersionUpload";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const categoryIcons: Record<DocumentCategory, React.ReactNode> = {
  contrato: <FileText className="w-5 h-5" />,
  aditivo: <FilePlus className="w-5 h-5" />,
  projeto_3d: <Box className="w-5 h-5" />,
  executivo: <Ruler className="w-5 h-5" />,
  art_rrt: <Award className="w-5 h-5" />,
  plano_reforma: <ClipboardList className="w-5 h-5" />,
  nota_fiscal: <Receipt className="w-5 h-5" />,
  garantia: <Shield className="w-5 h-5" />,
  as_built: <Building className="w-5 h-5" />,
  termo_entrega: <CheckSquare className="w-5 h-5" />,
};

const DocumentCard = ({
  doc,
  onViewHistory,
  onVersionUploaded,
  isStaff,
  canDelete,
  onRequestDelete,
}: {
  doc: ProjectDocument;
  onViewHistory: (docId: string) => void;
  onVersionUploaded: () => void;
  isStaff: boolean;
  canDelete: boolean;
  onRequestDelete: (doc: ProjectDocument) => void;
}) => {
  const [open, setOpen] = useState(false);

  const handleDownload = async () => {
    if (!doc.url) {
      toast.error(
        "URL do documento não disponível. Tente recarregar a página.",
      );
      return;
    }
    try {
      const response = await fetch(doc.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn(
        "[Documents] Fetch download failed, falling back to direct link:",
        err,
      );
      // Fallback: open in new tab for direct download
      window.open(doc.url, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div
          className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:bg-accent/50 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              {categoryIcons[doc.document_type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-body font-semibold line-clamp-1">
                  {doc.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <span>v{doc.version}</span>
                <span>•</span>
                <span>
                  {format(new Date(doc.created_at), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </span>
                {doc.checksum && (
                  <>
                    <span>•</span>
                    <span
                      className="flex items-center gap-1"
                      title={`SHA256: ${doc.checksum}`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      Verificado
                    </span>
                  </>
                )}
              </div>
              {doc.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {doc.description}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-[95vw] h-[95dvh] sm:h-[90vh] max-h-[95dvh] sm:max-h-[90vh] p-0 !flex flex-col gap-0 rounded-t-xl sm:rounded-xl !overflow-hidden">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base">{doc.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  Versão {doc.version}
                </span>
                {doc.checksum && (
                  <span
                    className="text-xs text-muted-foreground font-mono"
                    title={doc.checksum}
                  >
                    SHA256: {doc.checksum.substring(0, 8)}...
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-11 min-h-[44px] px-3"
                onClick={() => onViewHistory(doc.id)}
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Histórico</span>
              </Button>
              {isStaff && (
                <DocumentVersionUpload
                  document={doc}
                  onSuccess={onVersionUploaded}
                />
              )}
              <Button
                onClick={handleDownload}
                size="sm"
                className="gap-2 h-11 min-h-[44px] px-3"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-11 min-h-[44px] px-3 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false); // Close viewer first
                    // Delay to let Dialog unmount before AlertDialog opens
                    setTimeout(() => onRequestDelete(doc), 150);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {doc.url ? (
            <DocumentViewer
              url={doc.url}
              title={doc.name}
              mimeType={doc.mime_type}
              className="h-full rounded-none border-0"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-body text-muted-foreground">
                  Pré-visualização não disponível
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O link do documento pode ter expirado.
                </p>
                <div className="flex gap-2 mt-4 justify-center">
                  <Button onClick={handleDownload} className="gap-2">
                    <Download className="w-4 h-4" />
                    Baixar arquivo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      window.location.reload();
                    }}
                    className="gap-2"
                  >
                    Recarregar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CategorySection = ({
  category,
  documents,
  onViewHistory,
  onVersionUploaded,
  isStaff,
  canDelete,
  onRequestDelete,
}: {
  category: DocumentCategory;
  documents: ProjectDocument[];
  onViewHistory: (docId: string) => void;
  onVersionUploaded: () => void;
  isStaff: boolean;
  canDelete: boolean;
  onRequestDelete: (doc: ProjectDocument) => void;
}) => {
  if (documents.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-primary/10 rounded">
          {categoryIcons[category]}
        </div>
        <h2 className="text-h3">{DOCUMENT_CATEGORIES[category].label}</h2>
        <Badge variant="outline" className="ml-auto">
          {documents.length}
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            onViewHistory={onViewHistory}
            onVersionUploaded={onVersionUploaded}
            isStaff={isStaff}
            canDelete={canDelete}
            onRequestDelete={onRequestDelete}
          />
        ))}
      </div>
    </div>
  );
};

const DocumentosContent = () => {
  const { projectId } = useParams();
  const { project: _project, loading: projectLoading } = useProject();
  const {
    documents: dbDocuments,
    loading,
    error: _error,
    getLatestByCategory,
    getVersionHistory,
    refetch,
  } = useDocuments(projectId);
  const { data: journeyDocs = [] } = useJourneyVersionDocuments(projectId);

  // Merge: add journey version docs that don't already exist in project_documents
  const documents = useMemo(() => {
    if (journeyDocs.length === 0) return dbDocuments;
    // Avoid duplicates: journey docs have ids starting with "journey-"
    return [...dbDocuments, ...journeyDocs];
  }, [dbDocuments, journeyDocs]);

  // Extended getLatestByCategory that includes journey docs
  const getLatestByCategoryMerged = useCallback(
    (category: DocumentCategory) => {
      const base = getLatestByCategory(category);
      const extra = journeyDocs.filter((d) => d.document_type === category);
      return extra.length > 0 ? [...base, ...extra] : base;
    },
    [getLatestByCategory, journeyDocs],
  );
  const { isStaff } = useUserRole();
  const { can } = useCan();
  const deleteDocMutation = useDeleteDocumentMutation();
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);

  const canUpload = can("documents:upload");
  const canDelete = can("documents:delete");
  const [deleteTarget, setDeleteTarget] = useState<ProjectDocument | null>(
    null,
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteDocMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        refetch();
      },
    });
    setDeleteTarget(null);
  };

  const handleRequestDelete = (doc: ProjectDocument) => {
    setDeleteTarget(doc);
  };

  const historyDocs = historyDocId ? getVersionHistory(historyDocId) : [];

  if (projectLoading || loading) {
    return <ContentSkeleton variant="cards" rows={6} />;
  }

  const categories = Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[];
  const categoriesWithDocs = categories.filter(
    (cat) => getLatestByCategoryMerged(cat).length > 0,
  );

  return (
    <div>
      {/* Upload button for staff */}
      {canUpload && projectId && (
        <div className="flex justify-end mb-4">
          <DocumentUpload projectId={projectId} onSuccess={refetch} />
        </div>
      )}

      {documents.length === 0 ? (
        <EmptyState
          variant="documents"
          title="Nenhum documento disponível"
          description={
            canUpload
              ? "Envie o primeiro documento do projeto para começar."
              : "Plantas, contratos e laudos serão disponibilizados aqui pela equipe técnica conforme o projeto avança."
          }
          hint={
            !canUpload
              ? "Fique tranquilo — assim que um documento for adicionado, você receberá uma notificação."
              : undefined
          }
          infoLink={{ label: "Entenda como funciona", href: "#faq-documentos" }}
        >
          {canUpload && projectId && (
            <DocumentUpload projectId={projectId} onSuccess={refetch} />
          )}
        </EmptyState>
      ) : (
        <Tabs
          value={selectedTab}
          onValueChange={setSelectedTab}
          className="space-y-6"
        >
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start h-auto min-h-[44px] p-1 bg-muted/50 scrollbar-none">
            <TabsTrigger
              value="all"
              className="shrink-0 whitespace-nowrap min-h-[36px]"
            >
              Todos ({documents.length})
            </TabsTrigger>
            {categoriesWithDocs.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="shrink-0 whitespace-nowrap min-h-[36px]"
              >
                {DOCUMENT_CATEGORIES[cat].label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-8 mt-6">
            {categoriesWithDocs.map((cat) => (
              <CategorySection
                key={cat}
                category={cat}
                documents={getLatestByCategoryMerged(cat)}
                onViewHistory={setHistoryDocId}
                onVersionUploaded={refetch}
                isStaff={isStaff}
                canDelete={canDelete}
                onRequestDelete={handleRequestDelete}
              />
            ))}
          </TabsContent>

          {categoriesWithDocs.map((cat) => (
            <TabsContent key={cat} value={cat} className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getLatestByCategoryMerged(cat).map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    onViewHistory={setHistoryDocId}
                    onVersionUploaded={refetch}
                    isStaff={isStaff}
                    canDelete={canDelete}
                    onRequestDelete={handleRequestDelete}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Version History Dialog */}
      <Dialog
        open={!!historyDocId}
        onOpenChange={(open) => !open && setHistoryDocId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Versões
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {historyDocs.map((doc, index) => (
              <div
                key={doc.id}
                className={`p-3 rounded-lg border ${index === 0 ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-body font-medium">
                        Versão {doc.version}
                      </span>
                      {index === 0 && (
                        <Badge variant="outline" className="text-xs">
                          Atual
                        </Badge>
                      )}
                    </div>
                    <p className="text-caption text-muted-foreground">
                      {format(
                        new Date(doc.created_at),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR },
                      )}
                    </p>
                  </div>
                </div>
                {doc.checksum && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
                    <ShieldCheck className="w-3 h-3 text-[hsl(var(--success))]" />
                    <span className="truncate" title={doc.checksum}>
                      SHA256: {doc.checksum}
                    </span>
                  </div>
                )}
                {doc.description && (
                  <p className="text-caption text-muted-foreground mt-2 italic">
                    {doc.description}
                  </p>
                )}
              </div>
            ))}
          </div>
          {isStaff && historyDocs[0] && (
            <div className="pt-4 border-t">
              <DocumentVersionUpload
                document={historyDocs[0]}
                onSuccess={refetch}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation - rendered outside Dialog to avoid focus trap conflict */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deleteTarget?.name}&quot;?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentosContent;
