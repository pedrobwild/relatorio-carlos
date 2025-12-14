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

  // Calculate activity stats from report data
  const totalActivities = reportData.activities.length;
  const completedActivities = reportData.activities.filter(a => a.actualEnd).length;
  const startedActivities = reportData.activities.filter(a => a.actualStart).length;

  return (
    <div className="min-h-screen p-3 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-4 -ml-2"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div ref={reportRef}>
          <ReportHeader
            projectName={reportData.projectName}
            unitName={reportData.unitName}
            clientName={reportData.clientName}
            startDate={reportData.startDate}
            endDate={reportData.endDate}
            completedActivities={completedActivities}
            totalActivities={totalActivities}
            startedActivities={startedActivities}
            onExportPDF={handleExportPDF}
            isExporting={isExporting}
          />

        <div className="bg-card rounded-xl shadow-card overflow-hidden animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b-2 border-border px-3 md:px-6">
              <TabsList className="bg-transparent h-auto p-0 gap-0 w-full md:w-auto">
                <TabsTrigger
                  value="curvaS"
                  className="flex-1 md:flex-none data-[state=active]:bg-accent data-[state=active]:text-primary data-[state=active]:border-b-4 data-[state=active]:border-primary data-[state=inactive]:border-b-4 data-[state=inactive]:border-transparent rounded-none px-3 md:px-8 py-3 md:py-4 font-bold text-xs md:text-base transition-all"
                >
                  <BarChart3 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                  Curva S
                </TabsTrigger>
                <TabsTrigger
                  value="relatorio"
                  className="flex-1 md:flex-none data-[state=active]:bg-accent data-[state=active]:text-primary data-[state=active]:border-b-4 data-[state=active]:border-primary data-[state=inactive]:border-b-4 data-[state=inactive]:border-transparent rounded-none px-3 md:px-8 py-3 md:py-4 font-bold text-xs md:text-base transition-all"
                >
                  <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                  Relatório
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-3 md:p-8">
              <TabsContent value="curvaS" className="mt-0">
                <SCurveChart activities={reportData.activities} />
                <ScheduleTable activities={reportData.activities} />
              </TabsContent>

              <TabsContent value="relatorio" className="mt-0">
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
