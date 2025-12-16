import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, Loader2, AlertCircle } from "lucide-react";
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
import { useProject } from "@/contexts/ProjectContext";
import { isDemoMode } from "@/config/flags";
import bwildLogo from "@/assets/bwild-logo.png";

// Demo data for projects without real data yet
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

const Index = () => {
  const navigate = useNavigate();
  const { project, loading: projectLoading, error: projectError } = useProject();
  const [activeTab, setActiveTab] = useState("curvaS");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedWeeklyReport, setSelectedWeeklyReport] = useState<WeeklyReport | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const reportRef = useRef<HTMLDivElement>(null);

  // TODO: In production, activities will be loaded from the database
  // For now, we use demo data structure
  
  // Use real project data if available, demo data only in demo mode
  const reportData: ReportData | null = useMemo(() => {
    if (project) {
      // Project exists - use project info with demo activities for now
      // TODO: Load real activities from database when available
      if (isDemoMode) {
        return {
          projectName: project.name,
          unitName: project.unit_name || '',
          clientName: '', // TODO: Load from project_customers
          startDate: project.planned_start_date,
          endDate: project.planned_end_date,
          reportDate: new Date().toISOString().split('T')[0],
          activities: demoReportData.activities,
        };
      }
      
      // Project exists but no activity data yet
      if (isDemoMode) {
        // In demo mode, show demo activities with project info
        return {
          projectName: project.name,
          unitName: project.unit_name || '',
          clientName: project.customer_name || '',
          startDate: project.planned_start_date,
          endDate: project.planned_end_date,
          reportDate: new Date().toISOString().split('T')[0],
          activities: demoReportData.activities, // Use demo activities
        };
      }
      
      // In production with no activities, return minimal data
      return {
        projectName: project.name,
        unitName: project.unit_name || '',
        clientName: project.customer_name || '',
        startDate: project.planned_start_date,
        endDate: project.planned_end_date,
        reportDate: new Date().toISOString().split('T')[0],
        activities: [],
      };
    }
    
    // No project at all
    if (isDemoMode) {
      return demoReportData;
    }
    
    return null;
  }, [project]);

  const allWeeklyReports = useMemo(() => {
    if (!reportData || reportData.activities.length === 0) return [];
    return generateWeeklyReports(reportData.startDate, reportData.reportDate, reportData.activities);
  }, [reportData]);

  const reportsChronological = useMemo(() => {
    return [...allWeeklyReports].reverse();
  }, [allWeeklyReports]);

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

  if (projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{projectError}</p>
          <button onClick={() => navigate(-1)} className="text-primary underline">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // No data available state (production mode without demo data)
  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Dados ainda não disponíveis</h2>
          <p className="text-muted-foreground mb-4">
            Os dados desta obra ainda não foram carregados. Entre em contato com seu engenheiro responsável.
          </p>
          <button onClick={() => navigate(-1)} className="text-primary underline">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // Empty activities state (production mode with project but no activities)
  if (reportData.activities.length === 0) {
    return (
      <div className="min-h-screen min-h-[100dvh] pb-safe">
        {/* Fixed Mobile Header */}
        <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border md:hidden px-3 py-2.5">
          <div className="flex flex-col items-center gap-0.5">
            <img src={bwildLogo} alt="Bwild" className="h-6 w-auto" />
            <h1 className="font-bold text-xl text-foreground">Portal do Cliente</h1>
          </div>
        </div>

        <div className="p-3 md:p-4 lg:p-6 xl:p-8">
          <div className="max-w-[1600px] mx-auto">
            {/* Basic project header */}
            <div className="bg-card rounded-xl shadow-card p-6 mb-6">
              <h2 className="text-xl font-bold mb-2">{reportData.projectName} {reportData.unitName && `– ${reportData.unitName}`}</h2>
              <p className="text-muted-foreground">{reportData.clientName}</p>
              <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                <span>Início: {new Date(reportData.startDate).toLocaleDateString('pt-BR')}</span>
                <span>Término: {new Date(reportData.endDate).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            {/* Empty state message */}
            <div className="bg-card rounded-xl shadow-card p-8 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Cronograma em preparação</h3>
              <p className="text-muted-foreground">
                O cronograma de atividades desta obra ainda está sendo preparado.
                Você receberá uma notificação quando os dados estiverem disponíveis.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe">
      {/* Fixed Mobile Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border md:hidden px-3 py-2.5">
        <div className="flex flex-col items-center gap-0.5 opacity-0 animate-fade-in" style={{ animationDelay: "0ms" }}>
          <img src={bwildLogo} alt="Bwild" className="h-6 w-auto" />
          <h1 className="font-bold text-xl text-foreground">Portal do Cliente</h1>
        </div>
      </div>

      <div className="p-3 md:p-4 lg:p-6 xl:p-8">
        <div className="max-w-[1600px] mx-auto">
          <div ref={reportRef}>
            <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <ReportHeader
                projectName={reportData.projectName}
                unitName={reportData.unitName}
                clientName={reportData.clientName}
                startDate={reportData.startDate}
                endDate={reportData.endDate}
                reportDate={reportData.reportDate}
                activities={reportData.activities}
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
                        value="relatorio"
                        className="relative flex-1 md:flex-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground rounded-none px-3 md:px-5 py-2.5 md:py-3 font-semibold text-xs md:text-sm transition-all after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Relatórios Semanais
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <div className="p-3 md:p-4 lg:p-6">
                  <TabsContent value="curvaS" className="mt-0 focus-visible:outline-none">
                    <SCurveChart activities={reportData.activities} reportDate={reportData.reportDate} />
                    <ScheduleTable activities={reportData.activities} reportDate={reportData.reportDate} />
                  </TabsContent>

                  <TabsContent value="relatorio" className="mt-0 focus-visible:outline-none">
                    {selectedWeeklyReport ? (
                      <>
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
                        <WeeklyReportTemplate data={isDemoMode ? week10SeedData : week10SeedData /* TODO: Load real data */} />
                      </>
                    ) : (
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
