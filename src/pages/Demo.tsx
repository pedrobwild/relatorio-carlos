import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, Activity, GanttChartSquare, ArrowLeft, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import ReportHeader from "@/components/ReportHeader";
import SCurveChart from "@/components/SCurveChart";
import ScheduleTable from "@/components/ScheduleTable";
import GanttChart from "@/components/GanttChart";
import ActivityDetailsPanel from "@/components/ActivityDetailsPanel";
import WeeklyReportTemplate from "@/components/report/WeeklyReportTemplate";
import WeeklyReportsHistory, { generateWeeklyReports } from "@/components/WeeklyReportsHistory";
import WeeklyReportHeader from "@/components/WeeklyReportHeader";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import { ReportData, WeeklyReport, Activity as ActivityType } from "@/types/report";
import { week10SeedData } from "@/data/week10SeedData";
import bwildLogo from "@/assets/bwild-logo.png";

// Demo data - Hub Brooklyn 502
const demoReportData: ReportData = {
  projectName: "Hub Brooklyn",
  unitName: "502",
  clientName: "Pedro Alves",
  startDate: "2025-07-01",
  endDate: "2025-09-14",
  reportDate: "2025-09-08",
  activities: [
    { description: "Preparação e Mobilização", plannedStart: "2025-07-01", plannedEnd: "2025-07-05", actualStart: "2025-07-01", actualEnd: "2025-07-04", weight: 5 },
    { description: "Proteções, demolições e infraestrutura", plannedStart: "2025-07-07", plannedEnd: "2025-07-18", actualStart: "2025-07-05", actualEnd: "2025-07-19", weight: 15 },
    { description: "Pisos, revestimentos, bancadas e box", plannedStart: "2025-07-21", plannedEnd: "2025-08-03", actualStart: "2025-07-21", actualEnd: "2025-08-03", weight: 20 },
    { description: "Pinturas e metais", plannedStart: "2025-08-04", plannedEnd: "2025-08-10", actualStart: "2025-08-06", actualEnd: "2025-08-12", weight: 10 },
    { description: "Instalações e elétrica", plannedStart: "2025-08-11", plannedEnd: "2025-08-17", actualStart: "2025-08-14", actualEnd: "2025-08-17", weight: 10 },
    { description: "Marcenaria", plannedStart: "2025-08-20", plannedEnd: "2025-09-05", actualStart: "2025-08-20", actualEnd: "2025-09-05", weight: 33 },
    { description: "Etapa atual: Instalação de mobiliário e eletros", plannedStart: "2025-09-08", plannedEnd: "2025-09-10", actualStart: "2025-09-08", actualEnd: "", weight: 3 },
    { description: "Limpeza fina", plannedStart: "2025-09-11", plannedEnd: "2025-09-11", actualStart: "", actualEnd: "", weight: 2 },
    { description: "Vistoria de qualidade", plannedStart: "2025-09-12", plannedEnd: "2025-09-12", actualStart: "", actualEnd: "", weight: 1 },
    { description: "Conclusão", plannedStart: "2025-09-14", plannedEnd: "2025-09-14", actualStart: "", actualEnd: "", weight: 1 },
  ],
};

export default function Demo() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("curvaS");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedWeeklyReport, setSelectedWeeklyReport] = useState<WeeklyReport | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [showFullChart, setShowFullChart] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const allWeeklyReports = generateWeeklyReports(
    demoReportData.startDate, 
    demoReportData.reportDate, 
    demoReportData.activities
  );
  const reportsChronological = [...allWeeklyReports].reverse();

  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    setIsExporting(true);
    toast.info("Gerando PDF...");

    try {
      const element = reportRef.current;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Demo_Relatorio_Obra_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
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

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background">
      {/* Demo Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-accent/30 via-background to-accent/30 border-b border-accent">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/gestao')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-2">
                <img src={bwildLogo} alt="Bwild" className="h-6" />
                <Badge variant="outline" className="bg-accent text-accent-foreground border-accent">
                  <Presentation className="h-3 w-3 mr-1" />
                  AMBIENTE DE DEMONSTRAÇÃO
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Dados fictícios para apresentação
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 md:p-4 lg:p-6 xl:p-8">
        <div className="max-w-[1600px] mx-auto">
          <div ref={reportRef}>
            <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <ReportHeader
                projectName={demoReportData.projectName}
                unitName={demoReportData.unitName}
                clientName={demoReportData.clientName}
                startDate={demoReportData.startDate}
                endDate={demoReportData.endDate}
                reportDate={demoReportData.reportDate}
                activities={demoReportData.activities}
              />
            </div>

            <div className="bg-card rounded-xl shadow-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="border-b border-border bg-secondary/30">
                  <div className="px-3 md:px-5">
                    <TabsList className="bg-transparent h-auto p-0 gap-0 w-full md:w-auto overflow-x-auto">
                      <TabsTrigger
                        value="curvaS"
                        className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-3 md:px-5 py-2.5 md:py-3 font-semibold text-xs md:text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                      >
                        <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                        Curva S
                      </TabsTrigger>
                      <TabsTrigger
                        value="gantt"
                        className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-3 md:px-5 py-2.5 md:py-3 font-semibold text-xs md:text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                      >
                        <GanttChartSquare className="w-3.5 h-3.5 mr-1.5" />
                        Gantt
                      </TabsTrigger>
                      <TabsTrigger
                        value="relatorio"
                        className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-3 md:px-5 py-2.5 md:py-3 font-semibold text-xs md:text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Relatórios
                      </TabsTrigger>
                      <TabsTrigger
                        value="atividade"
                        className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-3 md:px-5 py-2.5 md:py-3 font-semibold text-xs md:text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                      >
                        <Activity className="w-3.5 h-3.5 mr-1.5" />
                        Atividade
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <div className="p-3 md:p-4 lg:p-6">
                  <div className="flex gap-4">
                    {/* Main content area */}
                    <div className={selectedActivityId ? "flex-1 min-w-0" : "w-full"}>
                      <TabsContent value="curvaS" className="mt-0 focus-visible:outline-none">
                        <SCurveChart 
                          activities={demoReportData.activities} 
                          reportDate={demoReportData.reportDate}
                          showFullChart={showFullChart}
                          onShowFullChartChange={setShowFullChart}
                        />
                        <ScheduleTable 
                          activities={demoReportData.activities} 
                          reportDate={demoReportData.reportDate}
                          selectedActivityId={selectedActivityId}
                          onActivitySelect={setSelectedActivityId}
                        />
                      </TabsContent>

                      <TabsContent value="gantt" className="mt-0 focus-visible:outline-none">
                        <GanttChart 
                          activities={demoReportData.activities} 
                          reportDate={demoReportData.reportDate}
                          editable={false}
                          showFullChart={showFullChart}
                          onShowFullChartChange={setShowFullChart}
                          selectedActivityId={selectedActivityId}
                          onActivitySelect={setSelectedActivityId}
                        />
                        <ScheduleTable 
                          activities={demoReportData.activities} 
                          reportDate={demoReportData.reportDate}
                          selectedActivityId={selectedActivityId}
                          onActivitySelect={setSelectedActivityId}
                        />
                      </TabsContent>

                      <TabsContent value="relatorio" className="mt-0 focus-visible:outline-none">
                        {selectedWeeklyReport ? (
                          <>
                            <WeeklyReportHeader
                              weeklyReport={selectedWeeklyReport}
                              activities={demoReportData.activities}
                              onPreviousWeek={handlePreviousWeek}
                              onNextWeek={handleNextWeek}
                              onBackToList={handleBackToList}
                              onExportPDF={handleExportPDF}
                              isExporting={isExporting}
                              hasPrevious={selectedWeekIndex > 0}
                              hasNext={selectedWeekIndex < reportsChronological.length - 1}
                            />
                            <WeeklyReportTemplate data={week10SeedData} />
                          </>
                        ) : (
                          <WeeklyReportsHistory
                            projectStartDate={demoReportData.startDate}
                            reportDate={demoReportData.reportDate}
                            activities={demoReportData.activities}
                            onReportClick={handleReportClick}
                          />
                        )}
                      </TabsContent>

                      <TabsContent value="atividade" className="mt-0 focus-visible:outline-none">
                        <ActivityTimeline projectId="demo" />
                      </TabsContent>
                    </div>

                    {/* Activity Details Panel - visible on desktop when activity selected */}
                    {selectedActivityId && (activeTab === 'curvaS' || activeTab === 'gantt') && (
                      <div className="hidden lg:block w-80 shrink-0">
                        <ActivityDetailsPanel
                          activity={demoReportData.activities.find((a, i) => (a.id || `demo-${i}`) === selectedActivityId) || null}
                          activities={demoReportData.activities}
                          onClose={() => setSelectedActivityId(null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
