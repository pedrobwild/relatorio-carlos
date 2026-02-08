import { useState, useCallback, useMemo, memo } from "react";
import { ArrowLeft, Download, FileText, Box, Ruler, Award, ClipboardList, Receipt, Shield, Building, CheckSquare, FilePlus, Loader2, Clock, CheckCircle2, History, ShieldCheck, CheckCheck, Plus, MessageSquare } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import bwildLogo from "@/assets/bwild-logo.png";
import { DocumentViewer } from "@/components/DocumentViewer";
import { DocumentComments } from "@/components/DocumentComments";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useDocuments, DOCUMENT_CATEGORIES, DocumentCategory, ProjectDocument } from "@/hooks/useDocuments";
import { useDocumentComments } from "@/hooks/useDocumentComments";
import { useUserRole } from "@/hooks/useUserRole";
import { useCan } from "@/hooks/useCan";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentVersionUpload } from "@/components/DocumentVersionUpload";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  onApprove,
  isStaff,
  isApproving,
}: { 
  doc: ProjectDocument; 
  onViewHistory: (docId: string) => void;
  onVersionUploaded: () => void;
  onApprove: (docId: string) => Promise<boolean>;
  isStaff: boolean;
  isApproving: boolean;
}) => {
  const handleDownload = async () => {
    if (!doc.url) return;
    
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
  };

  const isPdf = doc.mime_type === 'application/pdf';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              {categoryIcons[doc.document_type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-body font-medium truncate">{doc.name}</h3>
                <Badge 
                  variant={doc.status === 'approved' ? 'default' : 'secondary'}
                  className="shrink-0"
                >
                  {doc.status === 'approved' ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" />Aprovado</>
                  ) : (
                    <><Clock className="w-3 h-3 mr-1" />Pendente</>
                  )}
                </Badge>
              </div>
              {doc.description && (
                <p className="text-caption text-muted-foreground mt-1 line-clamp-2">{doc.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-tiny text-muted-foreground">
                <span>v{doc.version}</span>
                <span>•</span>
                <span>{format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                {doc.checksum && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1" title={`SHA256: ${doc.checksum}`}>
                      <ShieldCheck className="w-3 h-3" />
                      Verificado
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base">{doc.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Versão {doc.version}</span>
                <Badge 
                  variant={doc.status === 'approved' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {doc.status === 'approved' ? 'Aprovado' : 'Pendente'}
                </Badge>
                {doc.checksum && (
                  <span className="text-xs text-muted-foreground font-mono" title={doc.checksum}>
                    SHA256: {doc.checksum.substring(0, 8)}...
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2"
                onClick={() => onViewHistory(doc.id)}
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Histórico</span>
              </Button>
              {isStaff && doc.status === 'pending' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" disabled={isApproving}>
                      <CheckCheck className="w-4 h-4" />
                      <span className="hidden sm:inline">Aprovar</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Aprovar documento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a aprovar "{doc.name}". Esta ação marcará o documento como aprovado e resolverá automaticamente quaisquer pendências relacionadas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onApprove(doc.id)}>
                        Aprovar documento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isStaff && (
                <DocumentVersionUpload document={doc} onSuccess={onVersionUploaded} />
              )}
              <Button onClick={handleDownload} size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {doc.url ? (
            <DocumentViewer 
              url={doc.url} 
              title={doc.name}
              mimeType={doc.mime_type}
              approval={{
                approved_at: doc.approved_at,
                approved_by: doc.approved_by,
              }}
              className="h-full rounded-none border-0"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-body text-muted-foreground">Pré-visualização não disponível</p>
                <Button onClick={handleDownload} className="mt-4 gap-2">
                  <Download className="w-4 h-4" />
                  Baixar arquivo
                </Button>
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
  onApprove,
  isStaff,
  isApproving,
}: { 
  category: DocumentCategory; 
  documents: ProjectDocument[];
  onViewHistory: (docId: string) => void;
  onVersionUploaded: () => void;
  onApprove: (docId: string) => Promise<boolean>;
  isStaff: boolean;
  isApproving: boolean;
}) => {
  if (documents.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-primary/10 rounded">
          {categoryIcons[category]}
        </div>
        <h2 className="text-h3">{DOCUMENT_CATEGORIES[category].label}</h2>
        <Badge variant="outline" className="ml-auto">{documents.length}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map(doc => (
          <DocumentCard 
            key={doc.id} 
            doc={doc} 
            onViewHistory={onViewHistory}
            onVersionUploaded={onVersionUploaded}
            onApprove={onApprove}
            isStaff={isStaff}
            isApproving={isApproving}
          />
        ))}
      </div>
    </div>
  );
};

const Documentos = () => {
  const { projectId } = useParams();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const { paths } = useProjectNavigation();
  const { documents, loading, error, getLatestByCategory, getVersionHistory, approveDocument, refetch } = useDocuments(projectId);
  const { isStaff } = useUserRole();
  const { can } = useCan();
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  
  const canUpload = can('documents:upload');
  const canApprove = can('documents:approve');

  const handleViewHistory = (docId: string) => {
    setHistoryDocId(docId);
  };

  const handleApprove = async (docId: string): Promise<boolean> => {
    setIsApproving(true);
    try {
      const success = await approveDocument(docId);
      return success;
    } catch (error) {
      console.error('[Documentos] Approval failed:', error);
      return false;
    } finally {
      setIsApproving(false);
    }
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
          <Link to="/minhas-obras" className="text-primary underline">Voltar</Link>
        </div>
      </div>
    );
  }

  const categories = Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[];
  const categoriesWithDocs = categories.filter(cat => getLatestByCategory(cat).length > 0);

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col" data-testid="documents-page">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={paths.relatorio}>
              <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-full hover:bg-primary/10">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <img src={bwildLogo} alt="Bwild" className="h-6 w-auto" />
              <span className="text-muted-foreground/40">|</span>
              <h1 className="text-h2">Documentos</h1>
            </div>
          </div>
          {canUpload && projectId && (
            <DocumentUpload projectId={projectId} onSuccess={refetch} />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
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
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
              <TabsList className="w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 bg-muted/50">
                <TabsTrigger value="all" className="shrink-0">
                  Todos ({documents.length})
                </TabsTrigger>
                {categoriesWithDocs.map(cat => (
                  <TabsTrigger key={cat} value={cat} className="shrink-0">
                    {DOCUMENT_CATEGORIES[cat].label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all" className="space-y-8 mt-6">
                {categoriesWithDocs.map(cat => (
                  <CategorySection 
                    key={cat} 
                    category={cat} 
                    documents={getLatestByCategory(cat)}
                    onViewHistory={handleViewHistory}
                    onVersionUploaded={refetch}
                    onApprove={handleApprove}
                    isStaff={isStaff}
                    isApproving={isApproving}
                  />
                ))}
              </TabsContent>

              {categoriesWithDocs.map(cat => (
                <TabsContent key={cat} value={cat} className="mt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {getLatestByCategory(cat).map(doc => (
                      <DocumentCard 
                        key={doc.id} 
                        doc={doc} 
                        onViewHistory={handleViewHistory}
                        onVersionUploaded={refetch}
                        onApprove={handleApprove}
                        isStaff={isStaff}
                        isApproving={isApproving}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </div>

      {/* Version History Dialog */}
      <Dialog open={!!historyDocId} onOpenChange={(open) => !open && setHistoryDocId(null)}>
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
                className={`p-3 rounded-lg border ${index === 0 ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-body font-medium">Versão {doc.version}</span>
                      {index === 0 && <Badge variant="outline" className="text-xs">Atual</Badge>}
                    </div>
                    <p className="text-caption text-muted-foreground">
                      {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant={doc.status === 'approved' ? 'default' : 'secondary'}>
                    {doc.status === 'approved' ? 'Aprovado' : 'Pendente'}
                  </Badge>
                </div>
                {doc.checksum && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
                    <ShieldCheck className="w-3 h-3 text-green-600" />
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
              <DocumentVersionUpload document={historyDocs[0]} onSuccess={refetch} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documentos;
