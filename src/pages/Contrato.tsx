import { ArrowLeft, Download, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import bwildLogo from "@/assets/bwild-logo.png";

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

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/relatorio">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <img src={bwildLogo} alt="Bwild" className="h-7 w-auto" />
              <div className="h-5 w-px bg-border/60" />
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h1 className="font-bold text-lg text-foreground">Contrato</h1>
              </div>
            </div>
          </div>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download PDF</span>
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 p-2 sm:p-4 md:p-6">
        <div className="max-w-5xl mx-auto h-full">
          <div className="bg-card rounded-xl border border-border overflow-hidden h-[calc(100vh-120px)] sm:h-[calc(100vh-140px)]">
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
              className="w-full h-full"
              title="Contrato de Prestação de Serviços"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contrato;
