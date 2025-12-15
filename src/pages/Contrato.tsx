import { ArrowLeft, Download, ExternalLink, FileText, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import bwildLogo from "@/assets/bwild-logo.png";
import PDFViewer from "@/components/PDFViewer";

interface Aditivo {
  id: string;
  title: string;
  month: string;
  year: string;
  pdfUrl: string;
}

const Contrato = () => {
  const mainContractUrl = "/documents/contrato-bwild.pdf";
  
  const aditivos: Aditivo[] = [
    {
      id: "julho",
      title: "Aditivo ao Contrato",
      month: "Julho",
      year: "2025",
      pdfUrl: "/documents/aditivo-julho.pdf"
    },
    {
      id: "novembro",
      title: "Aditivo ao Contrato",
      month: "Novembro",
      year: "2025",
      pdfUrl: "/documents/aditivo-novembro.pdf"
    }
  ];

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = (url: string) => {
    window.open(url, "_blank");
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
              <h1 className="font-semibold text-base text-foreground">Contrato</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenInNewTab(mainContractUrl)}
              className="h-9 w-9 rounded-full sm:hidden hover:bg-primary/10"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button onClick={() => handleDownload(mainContractUrl, "Contrato_Bwild.pdf")} size="sm" className="gap-2 h-9">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 p-2 sm:p-4 md:p-6 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="h-[calc(100vh-100px)] sm:h-[calc(100vh-120px)]">
            <PDFViewer url={mainContractUrl} title="Contrato de Prestação de Serviços" />
          </div>

          {/* Aditivos Section */}
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Aditivos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aditivos.map((aditivo) => (
                <Dialog key={aditivo.id}>
                  <DialogTrigger asChild>
                    <div className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-foreground">{aditivo.title}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium text-primary">{aditivo.month} {aditivo.year}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 flex flex-col">
                    <DialogHeader className="p-4 border-b border-border shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <DialogTitle className="text-base">{aditivo.title}</DialogTitle>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium text-primary">{aditivo.month} {aditivo.year}</span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleDownload(aditivo.pdfUrl, `Aditivo_${aditivo.month}_${aditivo.year}.pdf`)}
                          size="sm"
                          className="gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden p-2">
                      <PDFViewer url={aditivo.pdfUrl} title={`${aditivo.title} - ${aditivo.month} ${aditivo.year}`} />
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contrato;
