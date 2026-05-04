import { ArrowLeft, Download, ExternalLink, FileText, Calendar, X, Loader2, FilePlus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import PDFViewer from "@/components/PDFViewer";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useDocuments, ProjectDocument } from "@/hooks/useDocuments";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Contrato = () => {
  const { projectId } = useParams();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const { paths } = useProjectNavigation();
  const { documents, loading: docsLoading, getLatestByCategory } = useDocuments(projectId);
  
  const mainContract = getLatestByCategory('contrato')[0];
  const aditivos = getLatestByCategory('aditivo');
  
  const loading = projectLoading || docsLoading;

  const handleDownload = async (doc: ProjectDocument) => {
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

  const handleOpenInNewTab = (doc: ProjectDocument) => {
    if (doc.url) {
      window.open(doc.url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{projectError}</p>
          <Link to="/minhas-obras" className="text-primary underline">Voltar</Link>
        </div>
      </div>
    );
  }

  const hasContract = !!mainContract?.url;

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
      {/* Header */}
      <PageHeader
        title="Contrato"
        backTo={paths.relatorio}
        maxWidth="xl"
        breadcrumbs={[
          { label: "Minhas Obras", href: "/minhas-obras" },
          { label: project?.name || "Obra", href: paths.relatorio },
          { label: "Contrato" },
        ]}
      >
        {hasContract && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenInNewTab(mainContract)}
              className="h-9 w-9 rounded-full sm:hidden hover:bg-primary/10"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button onClick={() => handleDownload(mainContract)} size="sm" className="gap-2 h-9">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </>
        )}
      </PageHeader>

      {/* Content */}
      <div className="flex-1 min-h-0 p-2 sm:p-4 md:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {!hasContract ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-body text-muted-foreground">Contrato não disponível</p>
              <p className="text-caption mt-1">O documento será disponibilizado em breve</p>
            </div>
          ) : (
            <>
              {/* Desktop: Two-column layout */}
              <div className="hidden lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 h-[calc(100vh-100px)]">
                <div className="h-full">
                  <PDFViewer url={mainContract.url!} title="Contrato de Prestação de Serviços" />
                </div>

                <div className="space-y-4">
                  {aditivos.length > 0 && (
                    <div className="bg-card border border-border rounded-lg p-4">
                      <h2 className="text-h2 mb-4">Aditivos</h2>
                      <div className="space-y-3">
                        {aditivos.map((aditivo) => (
                          <Dialog key={aditivo.id}>
                            <DialogTrigger asChild>
                              <div className="bg-secondary/50 border border-border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                    <FilePlus className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-body font-medium">{aditivo.name}</h3>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <Calendar className="w-3 h-3 text-primary" />
                                      <span className="text-caption text-primary">
                                        {format(new Date(aditivo.created_at), "MMMM yyyy", { locale: ptBR })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl w-[95vw] max-h-[95dvh] h-[90vh] p-0 flex flex-col">
                              <DialogHeader className="p-4 border-b border-border shrink-0">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <DialogTitle className="text-base">{aditivo.name}</DialogTitle>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <Calendar className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-xs font-medium text-primary">
                                        {format(new Date(aditivo.created_at), "MMMM yyyy", { locale: ptBR })}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button onClick={() => handleDownload(aditivo)} size="sm" className="gap-2">
                                      <Download className="w-4 h-4" />
                                      Download
                                    </Button>
                                    <DialogClose asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </DialogClose>
                                  </div>
                                </div>
                              </DialogHeader>
                              <div className="flex-1 overflow-hidden p-2">
                                {aditivo.url && <PDFViewer url={aditivo.url} title={aditivo.name} />}
                              </div>
                            </DialogContent>
                          </Dialog>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <p className="text-caption text-foreground/80">
                      <strong>Dica:</strong> Clique em um aditivo para visualizar o documento completo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mobile/Tablet Layout */}
              <div className="lg:hidden">
                <div className="h-[calc(100vh-100px)] sm:h-[calc(100vh-120px)]">
                  <PDFViewer url={mainContract.url!} title="Contrato de Prestação de Serviços" />
                </div>

                {aditivos.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <h2 className="text-h2">Aditivos</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {aditivos.map((aditivo) => (
                        <Dialog key={aditivo.id}>
                          <DialogTrigger asChild>
                            <div className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                  <FilePlus className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-h3">{aditivo.name}</h3>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-caption text-primary">
                                      {format(new Date(aditivo.created_at), "MMMM yyyy", { locale: ptBR })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl w-[95vw] max-h-[95dvh] h-[90vh] p-0 flex flex-col">
                            <DialogHeader className="p-4 border-b border-border shrink-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <DialogTitle className="text-base">{aditivo.name}</DialogTitle>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-xs font-medium text-primary">
                                      {format(new Date(aditivo.created_at), "MMMM yyyy", { locale: ptBR })}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button onClick={() => handleDownload(aditivo)} size="sm" className="gap-2">
                                    <Download className="w-4 h-4" />
                                    Download
                                  </Button>
                                  <DialogClose asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </DialogClose>
                                </div>
                              </div>
                            </DialogHeader>
                            <div className="flex-1 overflow-hidden p-2">
                              {aditivo.url && <PDFViewer url={aditivo.url} title={aditivo.name} />}
                            </div>
                          </DialogContent>
                        </Dialog>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contrato;
