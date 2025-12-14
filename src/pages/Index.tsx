import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReportHeader from "@/components/ReportHeader";
import SCurveChart from "@/components/SCurveChart";
import ScheduleTable from "@/components/ScheduleTable";
import WeeklyReportTemplate from "@/components/report/WeeklyReportTemplate";
import WeeklyReportsHistory, { generateWeeklyReports } from "@/components/WeeklyReportsHistory";
import WeeklyReportHeader from "@/components/WeeklyReportHeader";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { ReportData, WeeklyReport } from "@/types/report";
import { week10SeedData } from "@/data/week10SeedData";
import bwildLogo from "@/assets/bwild-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("curvaS");
  const [isExporting, setIsExporting] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedWeeklyReport, setSelectedWeeklyReport] = useState<WeeklyReport | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const reportRef = useRef<HTMLDivElement>(null);

  const allWeeklyReports = useMemo(() => {
    if (!reportData) return [];
    return generateWeeklyReports(reportData.startDate, reportData.reportDate, reportData.activities);
  }, [reportData]);

  // Get reports in chronological order (oldest first) for navigation
  const reportsChronological = useMemo(() => {
    return [...allWeeklyReports].reverse();
  }, [allWeeklyReports]);

  useEffect(() => {
    const storedData = sessionStorage.getItem("currentReport");
    if (storedData) {
      setReportData(JSON.parse(storedData));
    } else {
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

  const handleReportClick = (report: WeeklyReport, index: number) => {
    setSelectedWeeklyReport(report);
    setSelectedWeekIndex(index);
  };

  const handleBackToList = () => {
    setSelectedWeeklyReport(null);
  };

  const handlePreviousWeek = () => {
    if (selectedWeekIndex > 0) {
      const newIndex = selectedWeekIndex - 1;
      setSelectedWeekIndex(newIndex);
      setSelectedWeeklyReport(reportsChronological[newIndex]);
    }
  };

  const handleNextWeek = () => {
    if (selectedWeekIndex < reportsChronological.length - 1) {
      const newIndex = selectedWeekIndex + 1;
      setSelectedWeekIndex(newIndex);
      setSelectedWeeklyReport(reportsChronological[newIndex]);
    }
  };

  if (!reportData) {
    return null;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe">
      {/* Fixed Mobile Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border md:hidden px-4 py-3">
        <div className="flex items-center justify-center gap-2.5">
          <img src={bwildLogo} alt="Bwild" className="h-5 w-auto" />
          <div className="h-4 w-px bg-border" />
          <h1 className="font-semibold text-sm text-foreground tracking-tight">Portal do Cliente</h1>
        </div>
      </div>

      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Title - Desktop only */}
          <h1 className="text-xl font-semibold text-foreground mb-4 hidden md:block">Portal do Cliente</h1>

        <div ref={reportRef}>
          <ReportHeader
            projectName={reportData.projectName}
            unitName={reportData.unitName}
            clientName={reportData.clientName}
            startDate={reportData.startDate}
            endDate={reportData.endDate}
            reportDate={reportData.reportDate}
            activities={reportData.activities}
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
                      Relatórios Semanais
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-4 md:p-6 lg:p-8">
                <TabsContent value="curvaS" className="mt-0 focus-visible:outline-none">
                  <SCurveChart activities={reportData.activities} reportDate={reportData.reportDate} />
                  <ScheduleTable activities={reportData.activities} reportDate={reportData.reportDate} />
                </TabsContent>

                <TabsContent value="relatorio" className="mt-0 focus-visible:outline-none">
                  {selectedWeeklyReport ? (
                    <>
                      {/* Weekly Report Header with Navigation */}
                      <WeeklyReportHeader
                        weeklyReport={selectedWeeklyReport}
                        activities={reportData.activities}
                        onPreviousWeek={handlePreviousWeek}
                        onNextWeek={handleNextWeek}
                        onBackToList={handleBackToList}
                        onExportPDF={handleExportPDF}
                        isExporting={isExporting}
                        hasPrevious={selectedWeekIndex > 0}
                        hasNext={selectedWeekIndex < reportsChronological.length - 1}
                      />
                      
                      {/* Week 10 Seed Data Template (for demo purposes) */}
                      <WeeklyReportTemplate data={week10SeedData} />
                    </>
                  ) : (
                    /* Weekly Reports History List */
                    <WeeklyReportsHistory
                      projectStartDate={reportData.startDate}
                      reportDate={reportData.reportDate}
                      activities={reportData.activities}
                      onReportClick={handleReportClick}
                    />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Index;