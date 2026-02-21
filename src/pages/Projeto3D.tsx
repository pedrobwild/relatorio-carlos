import { useState } from "react";
import { Download, ExternalLink, FileText, Box, Play, Loader2, Info, Pencil, Layers, MessageSquareWarning, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PDFViewer from "@/components/PDFViewer";
import VideoPlayer from "@/components/VideoPlayer";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
import { useDocuments, ProjectDocument } from "@/hooks/useDocuments";
import { useUserRole } from "@/hooks/useUserRole";
import { usePageInstructions } from "@/hooks/usePageInstructions";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectSubNav } from "@/components/layout/ProjectSubNav";
import { RichTextEditorModal } from "@/components/report/RichTextEditorModal";
import { VersionsListModal } from "@/components/projeto3d/VersionsListModal";
import { use3DVersions } from "@/hooks/use3DVersions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DOMPurify from "dompurify";

const Projeto3D = () => {
  const { projectId } = useParams();
  const { paths } = useProjectNavigation();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const { documents, loading: docsLoading, getLatestByCategory } = useDocuments(projectId);
  const { isStaff } = useUserRole();
  const { instruction, loading: instrLoading, save: saveInstruction } = usePageInstructions(projectId, 'projeto_3d');
  const [editorOpen, setEditorOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [revisionDetailVersion, setRevisionDetailVersion] = useState<number | null>(null);

  const { versions } = use3DVersions(projectId);
  const pendingRevisions = versions.filter(v => v.revision_requested_at);

  const projeto3dDoc = getLatestByCategory('projeto_3d')[0];
  const loading = projectLoading || docsLoading;

  // TODO: Load video from storage as well
  const videoUrl = "/videos/projeto-3d-tour.mov";
  const hasVideo = true;

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
    if (doc.url) window.open(doc.url, "_blank");
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

  const hasDocument = !!projeto3dDoc?.url;
  const hasInstructions = !!instruction?.content_html && instruction.content_html !== '<p><br></p>';

  const InstructionsCard = () => {
    if (!hasInstructions && !isStaff) return null;

    return (
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="pt-6 px-6 pb-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Instruções</h3>
                {isStaff && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditorOpen(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              {hasInstructions ? (
                <div
                  className="prose prose-sm max-w-none text-muted-foreground [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mb-1 [&_li]:leading-relaxed [&_*]:!text-sm [&_strong]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(instruction!.content_html) }}
                />
              ) : (
                <button
                  onClick={() => setEditorOpen(true)}
                  className="w-full py-6 text-sm text-muted-foreground hover:text-foreground border-2 border-dashed border-border rounded-lg transition-colors hover:border-primary/30"
                >
                  Clique para adicionar instruções
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
      <PageHeader
        title="Projeto 3D"
        backTo={paths.relatorio}
        breadcrumbs={[
          { label: "Minhas Obras", href: "/minhas-obras" },
          { label: project?.name || "Obra", href: paths.relatorio },
          { label: "Projeto 3D" },
        ]}
      >
        {hasDocument && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenInNewTab(projeto3dDoc)}
              className="h-9 w-9 rounded-full sm:hidden hover:bg-primary/10"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button onClick={() => handleDownload(projeto3dDoc)} size="sm" className="gap-2 h-9">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </>
        )}
      </PageHeader>
      <ProjectSubNav />

      <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Instructions Card */}
          <InstructionsCard />

          {/* 3D Versions Button */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Versões do Projeto 3D</h3>
                  <p className="text-xs text-muted-foreground">Imagens com comentários posicionáveis</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)} className="gap-1.5">
                <Layers className="h-4 w-4" />
                Gerenciar
              </Button>
            </div>
          </div>

          {/* Revision Request Banners — visible to staff */}
          {isStaff && pendingRevisions.length > 0 && (
            <div className="space-y-3">
              {pendingRevisions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center gap-3 p-4 bg-[hsl(var(--warning-light))] border border-[hsl(var(--warning)/0.2)] rounded-xl"
                >
                  <MessageSquareWarning className="h-5 w-5 text-[hsl(var(--warning))] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Solicitação de Revisão — Versão {version.version_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Solicitada em {format(new Date(version.revision_requested_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => setRevisionDetailVersion(version.version_number)}
                  >
                    Ver detalhes
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!hasDocument && !hasVideo ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Box className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-body text-muted-foreground">Projeto 3D não disponível</p>
              <p className="text-caption mt-1">O documento será disponibilizado em breve</p>
            </div>
          ) : (
            <>
              {/* Desktop: Two-column layout */}
              <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
                {hasVideo && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden h-fit">
                    <div className="flex items-center gap-2 p-3 border-b border-border bg-primary-dark">
                      <Play className="w-4 h-4 text-white" />
                      <h2 className="text-h3 text-white">Tour Virtual 3D</h2>
                    </div>
                    <VideoPlayer src={videoUrl} title="Tour Virtual 3D" />
                  </div>
                )}
                {hasDocument && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center gap-2 p-3 border-b border-border bg-primary-dark">
                      <FileText className="w-4 h-4 text-white" />
                      <h2 className="text-h3 text-white">Projeto 3D - PDF</h2>
                    </div>
                    <div className="h-[600px]">
                      <PDFViewer url={projeto3dDoc.url!} title="Projeto 3D" />
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile/Tablet: Stack layout */}
              <div className="lg:hidden space-y-6">
                {hasVideo && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-border bg-primary-dark">
                      <Play className="w-4 h-4 text-white" />
                      <h2 className="text-h3 text-white">Tour Virtual 3D</h2>
                    </div>
                    <VideoPlayer src={videoUrl} title="Tour Virtual 3D" />
                  </div>
                )}
                {hasDocument && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-border bg-primary-dark">
                      <FileText className="w-4 h-4 text-white" />
                      <h2 className="text-h3 text-white">Projeto 3D - PDF</h2>
                    </div>
                    <div className="h-[500px] sm:h-[600px]">
                      <PDFViewer url={projeto3dDoc.url!} title="Projeto 3D" />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rich Text Editor Modal for Instructions */}
      {isStaff && (
        <RichTextEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          value={instruction?.content_html || ''}
          onSave={saveInstruction}
          title="Editar Instruções — Projeto 3D"
        />
      )}

      {/* 3D Versions Modal */}
      {projectId && (
        <VersionsListModal
          projectId={projectId}
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
        />
      )}

      {/* Revision Detail Modal */}
      <Dialog open={revisionDetailVersion !== null} onOpenChange={(open) => { if (!open) setRevisionDetailVersion(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-[hsl(var(--warning))]" />
              Solicitação de Revisão
            </DialogTitle>
          </DialogHeader>
          {revisionDetailVersion !== null && (() => {
            const version = pendingRevisions.find(v => v.version_number === revisionDetailVersion);
            if (!version) return <p className="text-sm text-muted-foreground">Versão não encontrada.</p>;
            return (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Versão {version.version_number}</p>
                  <p className="text-xs text-muted-foreground">
                    Solicitada em {format(new Date(version.revision_requested_at!), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  O cliente finalizou os apontamentos e solicitou a revisão desta versão do Projeto 3D. 
                  Acesse a versão para conferir os comentários e realizar os ajustes necessários.
                </p>
                <Button className="w-full gap-2" onClick={() => {
                  setRevisionDetailVersion(null);
                  setVersionsOpen(true);
                }}>
                  <Layers className="h-4 w-4" />
                  Abrir versões
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projeto3D;
