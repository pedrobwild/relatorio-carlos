import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReportHeader from "@/components/ReportHeader";
import SCurveChart from "@/components/SCurveChart";
import ScheduleTable from "@/components/ScheduleTable";
import TechnicalReport from "@/components/TechnicalReport";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { ReportData } from "@/types/report";

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("curvaS");
  const [isExporting, setIsExporting] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedData = sessionStorage.getItem("currentReport");
    if (storedData) {
      setReportData(JSON.parse(storedData));
    } else {
      // Redirect to home if no report data
      navigate("/");
    }
  }, [navigate]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    setIsExporting(true);
    toast.info("Gerando PDF...");

    try {
      const element = reportRef.current;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Relatorio_Obra_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!reportData) {
    return null;
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Voltar
        </Button>

        <div ref={reportRef}>
          <ReportHeader
            projectName={reportData.projectName}
            unitName={reportData.unitName}
            clientName={reportData.clientName}
            startDate={reportData.startDate}
            endDate={reportData.endDate}
            activities={reportData.activities}
            onExportPDF={handleExportPDF}
            isExporting={isExporting}
          />

          <div className="bg-card rounded-xl shadow-card overflow-hidden animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Tabs Navigation */}
              <div className="border-b border-border bg-secondary/30">
                <div className="px-4 md:px-6">
                  <TabsList className="bg-transparent h-auto p-0 gap-0 w-full md:w-auto overflow-x-auto">
                    <TabsTrigger
                      value="curvaS"
                      className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-4 md:px-6 py-3.5 md:py-4 font-semibold text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Curva S
                    </TabsTrigger>
                    <TabsTrigger
                      value="relatorio"
                      className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-4 md:px-6 py-3.5 md:py-4 font-semibold text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Relatório
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-4 md:p-6 lg:p-8">
                <TabsContent value="curvaS" className="mt-0 focus-visible:outline-none">
                  <SCurveChart activities={reportData.activities} />
                  <ScheduleTable activities={reportData.activities} />
                </TabsContent>

                <TabsContent value="relatorio" className="mt-0 focus-visible:outline-none">
                  <TechnicalReport />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;