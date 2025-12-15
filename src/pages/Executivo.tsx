import { useState } from "react";
import { ArrowLeft, Download, ExternalLink, FileText, Award, Ruler, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import bwildLogo from "@/assets/bwild-logo.png";
import PDFViewer from "@/components/PDFViewer";

const Executivo = () => {
  const pdfUrl = "/documents/projeto-executivo.pdf";
  const artPdfUrl = "/documents/art-exemplo.pdf";
  const planoReformaPdfUrl = "/documents/plano-reforma.pdf";
  const hasDocument = true;
  const [artModalOpen, setArtModalOpen] = useState(false);
  const [planoReformaModalOpen, setPlanoReformaModalOpen] = useState(false);

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

  const handleDownloadPlanoReforma = () => {
    const link = document.createElement("a");
    link.href = planoReformaPdfUrl;
    link.download = "Plano_Reforma_Bwild.pdf";
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
              <h1 className="text-h2">Projeto Executivo</h1>
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
        <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-auto">
          <div className="max-w-5xl mx-auto w-full flex flex-col gap-3">
            {/* PDF Viewer */}
            <div>
              <PDFViewer url={pdfUrl} title="Projeto Executivo" />
            </div>

            {/* ART Section */}
            <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 shrink-0">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-h3 truncate">ART - Anotação de Responsabilidade Técnica</h3>
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
                  <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-4 pr-12 border-b border-border flex-shrink-0">
                      <div className="flex items-center justify-between gap-4">
                        <DialogTitle className="flex items-center gap-2 text-base">
                          <Award className="w-5 h-5 text-primary shrink-0" />
                          <span className="truncate">ART - Responsabilidade Técnica</span>
                        </DialogTitle>
                        <Button onClick={handleDownloadArt} size="sm" variant="outline" className="gap-2 shrink-0">
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Download</span>
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

            {/* Plano de Reforma Section */}
            <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 shrink-0">
                    <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-h3 truncate">Plano de Reforma</h3>
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
                  <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-4 pr-12 border-b border-border flex-shrink-0">
                      <div className="flex items-center justify-between gap-4">
                        <DialogTitle className="flex items-center gap-2 text-base">
                          <ClipboardList className="w-5 h-5 text-primary shrink-0" />
                          <span className="truncate">Plano de Reforma</span>
                        </DialogTitle>
                        <Button onClick={handleDownloadPlanoReforma} size="sm" variant="outline" className="gap-2 shrink-0">
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Download</span>
                        </Button>
                      </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden p-2">
                      <PDFViewer url={planoReformaPdfUrl} title="Plano de Reforma" />
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