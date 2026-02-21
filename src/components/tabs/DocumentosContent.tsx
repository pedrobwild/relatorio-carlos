import { useState, useCallback, useMemo, memo } from "react";
import { Download, FileText, Box, Ruler, Award, ClipboardList, Receipt, Shield, Building, CheckSquare, FilePlus, Loader2, History, ShieldCheck, Plus, ChevronRight, Trash2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentViewer } from "@/components/DocumentViewer";
import { useProject } from "@/contexts/ProjectContext";
import { useDocuments, DOCUMENT_CATEGORIES, DocumentCategory, ProjectDocument } from "@/hooks/useDocuments";
import { useDeleteDocumentMutation } from "@/hooks/useDocumentsQuery";
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
  doc, onViewHistory, onVersionUploaded, isStaff, canDelete, onDelete,
}: { 
  doc: ProjectDocument; 
  onViewHistory: (docId: string) => void;
  onVersionUploaded: () => void;
  isStaff: boolean;
  canDelete: boolean;
  onDelete: (docId: string) => void;
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

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:bg-accent/50 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" tabIndex={0}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              {categoryIcons[doc.document_type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-body font-semibold line-clamp-1">{doc.name}</h3>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <span>v{doc.version}</span>
                <span>•</span>
                <span>{format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                {doc.checksum && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1" title={`SHA256: ${doc.checksum}`}>
                      <ShieldCheck className="w-3 h-3" />Verificado
                    </span>
                  </>
                )}
              </div>
              {doc.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{doc.description}</p>}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-[95vw] h-[95dvh] sm:h-[90vh] p-0 flex flex-col rounded-t-xl sm:rounded-xl">
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base">{doc.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Versão {doc.version}</span>
                {doc.checksum && (
                  <span className="text-xs text-muted-foreground font-mono" title={doc.checksum}>
                    SHA256: {doc.checksum.substring(0, 8)}...
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
              <Button variant="ghost" size="sm" className="gap-1.5 h-11 min-h-[44px] px-3" onClick={() => onViewHistory(doc.id)}>
                <History className="w-4 h-4" /><span className="hidden sm:inline">Histórico</span>
              </Button>
              {isStaff && <DocumentVersionUpload document={doc} onSuccess={onVersionUploaded} />}
              <Button onClick={handleDownload} size="sm" className="gap-2 h-11 min-h-[44px] px-3">
                <Download className="w-4 h-4" />Download
              </Button>
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 h-11 min-h-[44px] px-3 text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Excluir</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir documento</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir "{doc.name}"? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(doc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {doc.url ? (
            <DocumentViewer 
              url={doc.url} title={doc.name} mimeType={doc.mime_type}
              className="h-full rounded-none border-0"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-body text-muted-foreground">Pré-visualização não disponível</p>
                <Button onClick={handleDownload} className="mt-4 gap-2"><Download className="w-4 h-4" />Baixar arquivo</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CategorySection = ({ 
  category, documents, onViewHistory, onVersionUploaded, isStaff, canDelete, onDelete,
}: { 
  category: DocumentCategory; documents: ProjectDocument[];
  onViewHistory: (docId: string) => void; onVersionUploaded: () => void;
  isStaff: boolean; canDelete: boolean; onDelete: (docId: string) => void;
}) => {
  if (documents.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-primary/10 rounded">{categoryIcons[category]}</div>
        <h2 className="text-h3">{DOCUMENT_CATEGORIES[category].label}</h2>
        <Badge variant="outline" className="ml-auto">{documents.length}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map(doc => (
          <DocumentCard key={doc.id} doc={doc} onViewHistory={onViewHistory} onVersionUploaded={onVersionUploaded} isStaff={isStaff} canDelete={canDelete} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
};

const DocumentosContent = () => {
  const { projectId } = useParams();
  const { project, loading: projectLoading } = useProject();
  const { documents, loading, error, getLatestByCategory, getVersionHistory, refetch } = useDocuments(projectId);
  const { isStaff } = useUserRole();
  const { can } = useCan();
  const deleteDocMutation = useDeleteDocumentMutation();
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);

  const canUpload = can('documents:upload');
  const canDelete = can('documents:delete');

  const handleDelete = (docId: string) => {
    deleteDocMutation.mutate(docId);
  };

  const historyDocs = historyDocId ? getVersionHistory(historyDocId) : [];

  if (projectLoading || loading) {
    return <ContentSkeleton variant="cards" rows={6} />;
  }

  const categories = Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[];
  const categoriesWithDocs = categories.filter(cat => getLatestByCategory(cat).length > 0);

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
          description={canUpload ? "Envie o primeiro documento do projeto para começar." : "Os documentos serão disponibilizados em breve pela equipe técnica."}
        >
          {canUpload && projectId && <DocumentUpload projectId={projectId} onSuccess={refetch} />}
        </EmptyState>
      ) : (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start h-auto min-h-[44px] p-1 bg-muted/50 scrollbar-none">
            <TabsTrigger value="all" className="shrink-0 whitespace-nowrap min-h-[36px]">Todos ({documents.length})</TabsTrigger>
            {categoriesWithDocs.map(cat => (
              <TabsTrigger key={cat} value={cat} className="shrink-0 whitespace-nowrap min-h-[36px]">{DOCUMENT_CATEGORIES[cat].label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-8 mt-6">
            {categoriesWithDocs.map(cat => (
              <CategorySection key={cat} category={cat} documents={getLatestByCategory(cat)}
                onViewHistory={setHistoryDocId} onVersionUploaded={refetch} isStaff={isStaff} canDelete={canDelete} onDelete={handleDelete} />
            ))}
          </TabsContent>

          {categoriesWithDocs.map(cat => (
            <TabsContent key={cat} value={cat} className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getLatestByCategory(cat).map(doc => (
                  <DocumentCard key={doc.id} doc={doc} onViewHistory={setHistoryDocId} onVersionUploaded={refetch} isStaff={isStaff} canDelete={canDelete} onDelete={handleDelete} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Version History Dialog */}
      <Dialog open={!!historyDocId} onOpenChange={(open) => !open && setHistoryDocId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />Histórico de Versões
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {historyDocs.map((doc, index) => (
              <div key={doc.id} className={`p-3 rounded-lg border ${index === 0 ? 'border-primary bg-primary/5' : 'border-border'}`}>
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
                </div>
                {doc.checksum && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
                    <ShieldCheck className="w-3 h-3 text-[hsl(var(--success))]" />
                    <span className="truncate" title={doc.checksum}>SHA256: {doc.checksum}</span>
                  </div>
                )}
                {doc.description && <p className="text-caption text-muted-foreground mt-2 italic">{doc.description}</p>}
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

export default DocumentosContent;
