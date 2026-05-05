import { useState, useCallback, useMemo } from "react";
import { ArrowLeft, Download, FileText, Box, Ruler, Award, ClipboardList, Receipt, Shield, Building, CheckSquare, FilePlus, Loader2, History, ShieldCheck, Plus, MessageSquare, ChevronRight, Share2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

import { DocumentViewer } from "@/components/DocumentViewer";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import {
  useDocuments,
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  ProjectDocument,
} from "@/hooks/useDocuments";
import { useJourneyVersionDocuments } from "@/hooks/useJourneyVersionDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { useCan } from "@/hooks/useCan";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentVersionUpload } from "@/components/DocumentVersionUpload";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";
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
  onViewHistory: _onViewHistory,
  onVersionUploaded: _onVersionUploaded,
  isStaff: _isStaff,
  onOpenViewer,
}: {
  doc: ProjectDocument;
  onViewHistory: (docId: string) => void;
  onVersionUploaded: () => void;
  isStaff: boolean;
  onOpenViewer: (doc: ProjectDocument) => void;
}) => {
  const handleDownload = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!doc.url) return;
    try {
      const response = await fetch(doc.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(doc.url, "_blank");
    }
  };

  const handleShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!doc.url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: doc.name, url: doc.url });
      } catch {
        /* cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(doc.url);
        const { toast } = await import("sonner");
        toast.success("Link copiado");
      } catch {
        window.open(doc.url, "_blank");
      }
    }
  };

  return (
    <div
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:bg-accent/50 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
      tabIndex={0}
      onClick={() => onOpenViewer(doc)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenViewer(doc);
        }
      }}
      role="button"
      aria-label={`Abrir ${doc.name}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
          {categoryIcons[doc.document_type]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-body font-semibold line-clamp-1">{doc.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>v{doc.version}</span>
            <span>•</span>
            <span>
              {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
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
        {/* Quick actions — always visible on mobile, on-hover on desktop */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 min-h-[44px] min-w-[44px] touch-manipulation sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            onClick={handleDownload}
            aria-label="Baixar"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 min-h-[44px] min-w-[44px] touch-manipulation sm:hidden"
            onClick={handleShare}
            aria-label="Compartilhar"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 hidden sm:block" />
        </div>
      </div>
    </div>
  );
};

const CategorySection = ({
  category,
  documents,
  onViewHistory,
  onVersionUploaded,
  isStaff,
  onOpenViewer,
}: {
  category: DocumentCategory;
  documents: ProjectDocument[];
  onViewHistory: (docId: string) => void;
  onVersionUploaded: () => void;
  isStaff: boolean;
  onOpenViewer: (doc: ProjectDocument) => void;
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
            onOpenViewer={onOpenViewer}
          />
        ))}
      </div>
    </div>
  );
};

const Documentos = () => {
  const { projectId } = useParams();
  const {
    project,
    loading: projectLoading,
    error: projectError,
  } = useProject();
  const { paths } = useProjectNavigation();
  const {
    documents: dbDocuments,
    loading,
    error,
    getLatestByCategory,
    getVersionHistory,
    refetch,
  } = useDocuments(projectId);
  const { data: journeyDocs = [] } = useJourneyVersionDocuments(projectId);

  const documents = useMemo(() => {
    if (journeyDocs.length === 0) return dbDocuments;
    return [...dbDocuments, ...journeyDocs];
  }, [dbDocuments, journeyDocs]);

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
  const isMobile = useIsMobile();
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<ProjectDocument | null>(null);

  const canUpload = can("documents:upload");

  const handleViewHistory = (docId: string) => {
    setHistoryDocId(docId);
  };

  const historyDocs = historyDocId ? getVersionHistory(historyDocId) : [];

  if (projectLoading || loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
        {/* Header skeleton */}
        <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                <span className="text-muted-foreground/40">|</span>
                <div className="h-6 w-24 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-4 md:p-6">
          <div className="max-w-5xl mx-auto">
            <ContentSkeleton variant="cards" rows={6} />
          </div>
        </div>
      </div>
    );
  }

  if (projectError || error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{projectError || error}</p>
          <Link to="/minhas-obras" className="text-primary underline">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const categories = Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[];
  const categoriesWithDocs = categories.filter(
    (cat) => getLatestByCategoryMerged(cat).length > 0,
  );

  return (
    <div
      className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col"
      data-testid="documents-page"
    >
      {/* Header */}
      <PageHeader
        title="Documentos"
        backTo={paths.relatorio}
        breadcrumbs={[
          { label: "Minhas Obras", href: "/minhas-obras" },
          { label: project?.name || "Obra", href: paths.relatorio },
          { label: "Documentos" },
        ]}
      >
        {canUpload && projectId && (
          <DocumentUpload projectId={projectId} onSuccess={refetch} />
        )}
      </PageHeader>
      <ProjectSubNav />

      {/* Content */}
      <div className="flex-1 py-6">
        <PageContainer>
          {documents.length === 0 ? (
            <EmptyState
              variant="documents"
              title="Nenhum documento disponível"
              description={
                canUpload
                  ? "Envie o primeiro documento do projeto para começar."
                  : "Os documentos serão disponibilizados em breve pela equipe técnica."
              }
              action={
                canUpload && projectId
                  ? {
                      label: "Enviar documento",
                      onClick: () => {}, // DocumentUpload handles its own modal
                      icon: Plus,
                    }
                  : undefined
              }
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
              <TabsList className="w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 bg-muted/50">
                <TabsTrigger value="all" className="shrink-0">
                  Todos ({documents.length})
                </TabsTrigger>
                {categoriesWithDocs.map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="shrink-0">
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
                    onViewHistory={handleViewHistory}
                    onVersionUploaded={refetch}
                    isStaff={isStaff}
                    onOpenViewer={setViewerDoc}
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
                        onViewHistory={handleViewHistory}
                        onVersionUploaded={refetch}
                        isStaff={isStaff}
                        onOpenViewer={setViewerDoc}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </PageContainer>
      </div>

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

      {/* Document Viewer — Sheet on mobile, Dialog on desktop */}
      {viewerDoc &&
        (isMobile ? (
          <Sheet
            open={!!viewerDoc}
            onOpenChange={(open) => !open && setViewerDoc(null)}
          >
            <SheetContent
              side="bottom"
              className="h-[95dvh] flex flex-col p-0 rounded-t-2xl"
            >
              <div className="shrink-0 border-b border-border px-4 pt-4 pb-3">
                <SheetHeader className="p-0">
                  <SheetTitle className="text-left text-base line-clamp-1">
                    {viewerDoc.name}
                  </SheetTitle>
                </SheetHeader>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>v{viewerDoc.version}</span>
                  {viewerDoc.checksum && (
                    <span
                      className="font-mono truncate"
                      title={viewerDoc.checksum}
                    >
                      SHA256: {viewerDoc.checksum.substring(0, 8)}…
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
                {viewerDoc.url ? (
                  <DocumentViewer
                    url={viewerDoc.url}
                    title={viewerDoc.name}
                    mimeType={viewerDoc.mime_type}
                    className="h-full rounded-none border-0"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                    <FileText className="w-12 h-12 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground text-center">
                      Pré-visualização não disponível
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => window.location.reload()}
                      className="gap-2 h-11 touch-manipulation"
                    >
                      Recarregar
                    </Button>
                  </div>
                )}
              </div>
              {/* Sticky bottom actions */}
              <div className="shrink-0 border-t border-border px-4 py-3 pb-safe bg-card/95 backdrop-blur-md flex items-center gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-11 touch-manipulation gap-2 text-sm"
                  onClick={() => handleViewHistory(viewerDoc.id)}
                >
                  <History className="w-4 h-4" />
                  Histórico
                </Button>
                {isStaff && (
                  <DocumentVersionUpload
                    document={viewerDoc}
                    onSuccess={refetch}
                  />
                )}
                <Button
                  className="flex-1 h-11 touch-manipulation gap-2 text-sm"
                  onClick={async () => {
                    if (!viewerDoc.url) return;
                    try {
                      const res = await fetch(viewerDoc.url);
                      const blob = await res.blob();
                      const blobUrl = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = blobUrl;
                      a.download = viewerDoc.name;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(blobUrl);
                    } catch {
                      window.open(viewerDoc.url, "_blank");
                    }
                  }}
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog
            open={!!viewerDoc}
            onOpenChange={(open) => !open && setViewerDoc(null)}
          >
            <DialogContent className="max-w-4xl w-[95vw] h-[90dvh] max-h-[95dvh] p-0 flex flex-col">
              <DialogHeader className="p-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-base">
                      {viewerDoc.name}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Versão {viewerDoc.version}
                      </span>
                      {viewerDoc.checksum && (
                        <span
                          className="text-xs text-muted-foreground font-mono"
                          title={viewerDoc.checksum}
                        >
                          SHA256: {viewerDoc.checksum.substring(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleViewHistory(viewerDoc.id)}
                    >
                      <History className="w-4 h-4" />
                      Histórico
                    </Button>
                    {isStaff && (
                      <DocumentVersionUpload
                        document={viewerDoc}
                        onSuccess={refetch}
                      />
                    )}
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={async () => {
                        if (!viewerDoc.url) return;
                        try {
                          const res = await fetch(viewerDoc.url);
                          const blob = await res.blob();
                          const blobUrl = window.URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = blobUrl;
                          a.download = viewerDoc.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(blobUrl);
                        } catch {
                          window.open(viewerDoc.url, "_blank");
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-hidden">
                {viewerDoc.url ? (
                  <DocumentViewer
                    url={viewerDoc.url}
                    title={viewerDoc.name}
                    mimeType={viewerDoc.mime_type}
                    className="h-full rounded-none border-0"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-body text-muted-foreground">
                        Pré-visualização não disponível
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => window.location.reload()}
                        className="gap-2 mt-4"
                      >
                        Recarregar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        ))}
    </div>
  );
};

export default Documentos;
