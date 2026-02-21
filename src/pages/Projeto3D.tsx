import { useState } from "react";
import { Download, ExternalLink, FileText, Box, Play, Loader2, Info, Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import DOMPurify from "dompurify";

const Projeto3D = () => {
  const { projectId } = useParams();
  const { paths } = useProjectNavigation();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const { documents, loading: docsLoading, getLatestByCategory } = useDocuments(projectId);
  const { isStaff } = useUserRole();
  const { instruction, loading: instrLoading, save: saveInstruction } = usePageInstructions(projectId, 'projeto_3d');
  const [editorOpen, setEditorOpen] = useState(false);

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
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-primary-dark">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-white" />
            <h2 className="text-h3 text-white">Instruções</h2>
          </div>
          {isStaff && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => setEditorOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <div className="p-4">
          {hasInstructions ? (
            <div
              className="prose prose-sm max-w-none text-foreground [&_p]:mb-2 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:mb-0.5 [&_*]:!text-sm"
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
    </div>
  );
};

export default Projeto3D;
