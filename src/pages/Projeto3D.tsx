import { ArrowLeft, Download, ExternalLink, FileText, Box, Play, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import bwildLogo from "@/assets/bwild-logo.png";
import PDFViewer from "@/components/PDFViewer";
import VideoPlayer from "@/components/VideoPlayer";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
import { useDocuments, ProjectDocument } from "@/hooks/useDocuments";

const Projeto3D = () => {
  const { projectId } = useParams();
  const { paths } = useProjectNavigation();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const { documents, loading: docsLoading, getLatestByCategory } = useDocuments(projectId);
  
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

  const hasDocument = !!projeto3dDoc?.url;

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
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
              <h1 className="text-h2">Projeto 3D</h1>
            </div>
          </div>
          {hasDocument && (
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
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
                {/* Left: Video */}
                {hasVideo && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden h-fit">
                    <div className="flex items-center gap-2 p-3 border-b border-border bg-primary-dark">
                      <Play className="w-4 h-4 text-white" />
                      <h2 className="text-h3 text-white">Tour Virtual 3D</h2>
                    </div>
                    <VideoPlayer src={videoUrl} title="Tour Virtual 3D" />
                  </div>
                )}

                {/* Right: PDF */}
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
                {/* Video Player Section */}
                {hasVideo && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-border bg-primary-dark">
                      <Play className="w-4 h-4 text-white" />
                      <h2 className="text-h3 text-white">Tour Virtual 3D</h2>
                    </div>
                    <VideoPlayer src={videoUrl} title="Tour Virtual 3D" />
                  </div>
                )}

                {/* PDF Section */}
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
    </div>
  );
};

export default Projeto3D;
