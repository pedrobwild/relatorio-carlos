import { ArrowLeft, Download, FileText, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import bwildLogo from "@/assets/bwild-logo.png";
import PDFViewer from "@/components/PDFViewer";

const Contrato = () => {
  const pdfUrl = "/documents/contrato-bwild.pdf";

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "Contrato_Bwild.pdf";
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
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/relatorio">
              <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={bwildLogo} alt="Bwild" className="h-6 sm:h-7 w-auto" />
              <div className="h-5 w-px bg-border/60 hidden sm:block" />
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary hidden sm:block" />
                <h1 className="font-bold text-base sm:text-lg text-foreground">Contrato</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenInNewTab}
              className="h-10 w-10 sm:hidden"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-5 h-5" />
            </Button>
            <Button onClick={handleDownload} className="gap-2 h-10">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-hidden">
        <div className="max-w-5xl mx-auto h-full">
          <div className="h-[calc(100vh-100px)] sm:h-[calc(100vh-120px)]">
            <PDFViewer url={pdfUrl} title="Contrato de Prestação de Serviços" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contrato;
