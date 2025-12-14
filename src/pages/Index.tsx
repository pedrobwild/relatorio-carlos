import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReportHeader from "@/components/ReportHeader";
import SCurveChart from "@/components/SCurveChart";
import ScheduleTable from "@/components/ScheduleTable";
import TechnicalReport from "@/components/TechnicalReport";
import WeeklyReportsHistory from "@/components/WeeklyReportsHistory";
import WeeklyReportHeader from "@/components/WeeklyReportHeader";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { ReportData, WeeklyReport } from "@/types/report";
import { startOfWeek, endOfWeek, addWeeks, isBefore, isAfter } from "date-fns";

// Helper to generate all weekly reports
const generateAllWeeklyReports = (
  projectStartDate: string,
  reportDate: string
): WeeklyReport[] => {
  const startDate = new Date(projectStartDate);
  const currentReportDate = new Date(reportDate);
  const reports: WeeklyReport[] = [];
  
  let weekNumber = 1;
  let weekStart = startOfWeek(startDate, { weekStartsOn: 1 });
  
  while (isBefore(weekStart, currentReportDate) || weekStart.getTime() === currentReportDate.getTime()) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    reports.push({
      weekNumber,
      startDate: weekStart,
      endDate: isAfter(weekEnd, currentReportDate) ? currentReportDate : weekEnd,
      completionPercentage: 0, // Will be calculated separately
    });
    
    weekStart = addWeeks(weekStart, 1);
    weekNumber++;
    
    if (weekNumber > 52) break;
  }
  
  return reports;
};

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
    return generateAllWeeklyReports(reportData.startDate, reportData.reportDate);
  }, [reportData]);

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

  if (!reportData) {
    return null;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe">
      {/* Fixed Mobile Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border md:hidden px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="font-semibold text-sm text-foreground">Relatório de Obra</span>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Back Button - Desktop only */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground hidden md:inline-flex"
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
            reportDate={reportData.reportDate}
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
                  <SCurveChart activities={reportData.activities} reportDate={reportData.reportDate} />
                  <ScheduleTable activities={reportData.activities} />
                </TabsContent>

                <TabsContent value="relatorio" className="mt-0 focus-visible:outline-none">
                  {selectedWeeklyReport ? (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setSelectedWeeklyReport(null);
                          setSelectedWeekIndex(0);
                        }}
                      >
                        <ArrowLeft className="w-4 h-4 mr-1.5" />
                        Voltar para histórico
                      </Button>
                      <WeeklyReportHeader
                        weeklyReport={selectedWeeklyReport}
                        activities={reportData.activities}
                        totalWeeks={allWeeklyReports.length}
                        hasPrevious={selectedWeekIndex < allWeeklyReports.length - 1}
                        hasNext={selectedWeekIndex > 0}
                        onPreviousWeek={() => {
                          const newIndex = selectedWeekIndex + 1;
                          if (newIndex < allWeeklyReports.length) {
                            setSelectedWeekIndex(newIndex);
                            setSelectedWeeklyReport(allWeeklyReports[allWeeklyReports.length - 1 - newIndex]);
                          }
                        }}
                        onNextWeek={() => {
                          const newIndex = selectedWeekIndex - 1;
                          if (newIndex >= 0) {
                            setSelectedWeekIndex(newIndex);
                            setSelectedWeeklyReport(allWeeklyReports[allWeeklyReports.length - 1 - newIndex]);
                          }
                        }}
                      />
                      <TechnicalReport
                        weeklyReport={selectedWeeklyReport}
                        clientName={reportData.clientName}
                        activities={reportData.activities}
                        endDate={reportData.endDate}
                        projectStartDate={reportData.startDate}
                      />
                    </div>
                  ) : (
                    <WeeklyReportsHistory
                      projectStartDate={reportData.startDate}
                      reportDate={reportData.reportDate}
                      activities={reportData.activities}
                      onReportClick={(report) => {
                        setSelectedWeeklyReport(report);
                        // Find the index (reports are in reverse order - most recent first)
                        const index = allWeeklyReports.length - report.weekNumber;
                        setSelectedWeekIndex(index);
                      }}
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