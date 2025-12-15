import { useState } from "react";
import { ArrowLeft, Download, ExternalLink, FileText, Award, Ruler } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import bwildLogo from "@/assets/bwild-logo.png";
import PDFViewer from "@/components/PDFViewer";

const Executivo = () => {
  const pdfUrl = "/documents/projeto-executivo.pdf";
  const artPdfUrl = "/documents/art-exemplo.pdf";
  const hasDocument = true;
  const [artModalOpen, setArtModalOpen] = useState(false);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "Projeto_Executivo_Bwild.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadArt = () => {
    const link = document.createElement("a");
    link.href = artPdfUrl;
    link.download = "ART_Bwild.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(pdfUrl, "_blank");
  };

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/relatorio">
              <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-full hover:bg-primary/10">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <img src={bwildLogo} alt="Bwild" className="h-6 w-auto" />
              <span className="text-muted-foreground/40">|</span>
              <h1 className="font-semibold text-base text-foreground">Projeto Executivo</h1>
            </div>
          </div>
          {hasDocument && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenInNewTab}
                className="h-9 w-9 rounded-full sm:hidden hover:bg-primary/10"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button onClick={handleDownload} size="sm" className="gap-2 h-9">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {hasDocument ? (
        <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-hidden flex flex-col gap-4">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col gap-4">
            {/* PDF Viewer */}
            <div className="h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)]">
              <PDFViewer url={pdfUrl} title="Projeto Executivo" />
            </div>

            {/* ART Section */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">ART - Anotação de Responsabilidade Técnica</h3>
                    <p className="text-xs text-muted-foreground">Documento de responsabilidade técnica do projeto</p>
                  </div>
                </div>
                <Dialog open={artModalOpen} onOpenChange={setArtModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Visualizar ART</span>
                      <span className="sm:hidden">Ver</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-4 border-b border-border flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-primary" />
                          ART - Anotação de Responsabilidade Técnica
                        </DialogTitle>
                        <Button onClick={handleDownloadArt} size="sm" variant="outline" className="gap-2">
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden p-2">
                      <PDFViewer url={artPdfUrl} title="ART" />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
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
                  <h2 className="text-xl font-bold text-foreground">Projeto Executivo</h2>
                  <p className="text-sm text-muted-foreground">Documentação técnica detalhada</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Documento em preparação</p>
                <p className="text-sm text-muted-foreground/70 mt-1">O arquivo será disponibilizado em breve</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Executivo;