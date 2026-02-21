import { useState } from "react";
import { ArrowLeft, Download, ExternalLink, FileText, Award, Ruler, ClipboardList, CheckCircle2, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import PDFViewer from "@/components/PDFViewer";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
import { useDocuments, ProjectDocument } from "@/hooks/useDocuments";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";

const Executivo = () => {
  const { projectId } = useParams();
  const { paths } = useProjectNavigation();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const { documents, loading: docsLoading, getLatestByCategory } = useDocuments(projectId);
  
  const executivoDoc = getLatestByCategory('executivo')[0];
  const artDoc = getLatestByCategory('art_rrt')[0];
  const planoReformaDoc = getLatestByCategory('plano_reforma')[0];
  
  const loading = projectLoading || docsLoading;
  
  const [artModalOpen, setArtModalOpen] = useState(false);
  const [planoReformaModalOpen, setPlanoReformaModalOpen] = useState(false);

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

  const hasDocument = !!executivoDoc?.url;
  const hasArt = !!artDoc?.url;
  const hasPlanoReforma = !!planoReformaDoc?.url;

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
      {/* Header */}
      <PageHeader
        title="Projeto Executivo"
        backTo={paths.relatorio}
        breadcrumbs={[
          { label: "Minhas Obras", href: "/minhas-obras" },
          { label: project?.name || "Obra", href: paths.relatorio },
          { label: "Executivo" },
        ]}
      >
        {hasDocument && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenInNewTab(executivoDoc)}
              className="h-9 w-9 rounded-full sm:hidden hover:bg-primary/10"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button onClick={() => handleDownload(executivoDoc)} size="sm" className="gap-2 h-9">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </>
        )}
      </PageHeader>
      <ProjectSubNav />

      {/* Content */}
      {hasDocument ? (
        <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto w-full">
            {/* Desktop: Two-column layout */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">
              {/* Left: Main PDF */}
              <div className="space-y-4">
                {/* Tacit Approval Notice - only show if approved */}
                {executivoDoc.status === 'approved' && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-h3 text-amber-800 dark:text-amber-200 mb-1">Aprovação Tácita</h3>
                        <p className="text-caption text-amber-700 dark:text-amber-300">
                          Este projeto executivo foi considerado <strong>aprovado tacitamente</strong>, 
                          pois não houve manifestação do cliente dentro do prazo estipulado em contrato.
                        </p>
                        <Link 
                          to={paths.formalizacoes} 
                          className="inline-flex items-center gap-1.5 mt-2 text-caption text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline underline-offset-2"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Ver formalização completa
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* PDF Viewer */}
                <div className="h-[calc(100vh-260px)]">
                  <PDFViewer url={executivoDoc.url!} title="Projeto Executivo" />
                </div>
              </div>

              {/* Right: Sidebar with related documents */}
              <div className="space-y-4 sticky top-20 h-fit">
                {(hasArt || hasPlanoReforma) && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h2 className="text-h2 mb-4">Documentos Relacionados</h2>
                    <div className="space-y-3">
                      {/* ART */}
                      {hasArt && (
                        <Dialog open={artModalOpen} onOpenChange={setArtModalOpen}>
                          <DialogTrigger asChild>
                            <div className="bg-secondary/50 border border-border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                                  <Award className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-body font-medium">{artDoc.name}</h3>
                                  <p className="text-caption text-muted-foreground">Responsabilidade Técnica</p>
                                </div>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[95dvh] h-[90vh] flex flex-col p-0">
                            <DialogHeader className="p-4 pr-12 border-b border-border flex-shrink-0">
                              <div className="flex items-center justify-between gap-4">
                                <DialogTitle className="flex items-center gap-2 text-base">
                                  <Award className="w-5 h-5 text-primary shrink-0" />
                                  <span className="truncate">{artDoc.name}</span>
                                </DialogTitle>
                                <Button onClick={() => handleDownload(artDoc)} size="sm" variant="outline" className="gap-2 shrink-0">
                                  <Download className="w-4 h-4" />
                                  Download
                                </Button>
                              </div>
                            </DialogHeader>
                            <div className="flex-1 overflow-hidden p-2">
                              <PDFViewer url={artDoc.url!} title={artDoc.name} />
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {/* Plano de Reforma */}
                      {hasPlanoReforma && (
                        <Dialog open={planoReformaModalOpen} onOpenChange={setPlanoReformaModalOpen}>
                          <DialogTrigger asChild>
                            <div className="bg-secondary/50 border border-border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                                  <ClipboardList className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-body font-medium">{planoReformaDoc.name}</h3>
                                  <p className="text-caption text-muted-foreground">Planejamento da reforma</p>
                                </div>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[95dvh] h-[90vh] flex flex-col p-0">
                            <DialogHeader className="p-4 pr-12 border-b border-border flex-shrink-0">
                              <div className="flex items-center justify-between gap-4">
                                <DialogTitle className="flex items-center gap-2 text-base">
                                  <ClipboardList className="w-5 h-5 text-primary shrink-0" />
                                  <span className="truncate">{planoReformaDoc.name}</span>
                                </DialogTitle>
                                <Button onClick={() => handleDownload(planoReformaDoc)} size="sm" variant="outline" className="gap-2 shrink-0">
                                  <Download className="w-4 h-4" />
                                  Download
                                </Button>
                              </div>
                            </DialogHeader>
                            <div className="flex-1 overflow-hidden p-2">
                              <PDFViewer url={planoReformaDoc.url!} title={planoReformaDoc.name} />
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick Info */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="text-caption text-foreground/80">
                    <strong>Dica:</strong> Clique em um documento para visualizá-lo ou fazer download.
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile/Tablet: Stack layout */}
            <div className="lg:hidden flex flex-col gap-3">
              {/* Tacit Approval Notice */}
              {executivoDoc.status === 'approved' && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-h3 text-amber-800 dark:text-amber-200 mb-1">Aprovação Tácita</h3>
                      <p className="text-caption text-amber-700 dark:text-amber-300">
                        Este projeto executivo foi considerado <strong>aprovado tacitamente</strong>, 
                        pois não houve manifestação do cliente dentro do prazo estipulado em contrato.
                      </p>
                      <Link 
                        to={paths.formalizacoes} 
                        className="inline-flex items-center gap-1.5 mt-2 text-caption text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline underline-offset-2"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Ver formalização completa
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* PDF Viewer */}
              <div>
                <PDFViewer url={executivoDoc.url!} title="Projeto Executivo" />
              </div>

              {/* ART Section */}
              {hasArt && (
                <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 shrink-0">
                        <Award className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-h3 truncate">{artDoc.name}</h3>
                        <p className="text-caption">Documento de responsabilidade técnica</p>
                      </div>
                    </div>
                    <Dialog open={artModalOpen} onOpenChange={setArtModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 shrink-0">
                          <FileText className="w-4 h-4" />
                          <span className="hidden sm:inline">Visualizar</span>
                          <span className="sm:hidden">Ver</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[95dvh] h-[90vh] flex flex-col p-0">
                        <DialogHeader className="p-4 pr-12 border-b border-border flex-shrink-0">
                          <div className="flex items-center justify-between gap-4">
                            <DialogTitle className="flex items-center gap-2 text-base">
                              <Award className="w-5 h-5 text-primary shrink-0" />
                              <span className="truncate">{artDoc.name}</span>
                            </DialogTitle>
                            <Button onClick={() => handleDownload(artDoc)} size="sm" variant="outline" className="gap-2 shrink-0">
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline">Download</span>
                            </Button>
                          </div>
                        </DialogHeader>
                        <div className="flex-1 overflow-hidden p-2">
                          <PDFViewer url={artDoc.url!} title={artDoc.name} />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}

              {/* Plano de Reforma Section */}
              {hasPlanoReforma && (
                <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 shrink-0">
                        <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-h3 truncate">{planoReformaDoc.name}</h3>
                        <p className="text-caption">Documento de planejamento da reforma</p>
                      </div>
                    </div>
                    <Dialog open={planoReformaModalOpen} onOpenChange={setPlanoReformaModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 shrink-0">
                          <FileText className="w-4 h-4" />
                          <span className="hidden sm:inline">Visualizar</span>
                          <span className="sm:hidden">Ver</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[95dvh] h-[90vh] flex flex-col p-0">
                        <DialogHeader className="p-4 pr-12 border-b border-border flex-shrink-0">
                          <div className="flex items-center justify-between gap-4">
                            <DialogTitle className="flex items-center gap-2 text-base">
                              <ClipboardList className="w-5 h-5 text-primary shrink-0" />
                              <span className="truncate">{planoReformaDoc.name}</span>
                            </DialogTitle>
                            <Button onClick={() => handleDownload(planoReformaDoc)} size="sm" variant="outline" className="gap-2 shrink-0">
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline">Download</span>
                            </Button>
                          </div>
                        </DialogHeader>
                        <div className="flex-1 overflow-hidden p-2">
                          <PDFViewer url={planoReformaDoc.url!} title={planoReformaDoc.name} />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-card rounded-xl border border-border p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Ruler className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-h2">Projeto Executivo</h2>
                  <p className="text-caption">Documentação técnica detalhada</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <p className="text-body text-muted-foreground">Documento em preparação</p>
                <p className="text-caption mt-1">O arquivo será disponibilizado em breve</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Executivo;
