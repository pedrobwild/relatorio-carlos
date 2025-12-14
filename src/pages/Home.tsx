import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Building2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateReportModal from "@/components/CreateReportModal";
import { ReportData } from "@/types/report";
import bwildLogo from "@/assets/bwild-logo.png";

// Start date: 01/07/2025, End date: 10/09/2025
// Report generated on: 22/08/2025 (activity 6 in progress)
const sampleReportData: ReportData = {
  projectName: "Hub Brooklyn",
  unitName: "502",
  clientName: "Pedro Alves",
  startDate: "2025-07-01",
  endDate: "2025-09-10",
  reportDate: "2025-08-22", // Data de geração do relatório
  activities: [
    {
      description: "Fundação e Terraplanagem",
      plannedStart: "2025-07-01",
      plannedEnd: "2025-07-10",
      actualStart: "2025-07-01",
      actualEnd: "2025-07-10",
    },
    {
      description: "Estrutura - Pilares e Vigas",
      plannedStart: "2025-07-11",
      plannedEnd: "2025-07-18",
      actualStart: "2025-07-11",
      actualEnd: "2025-07-18",
    },
    {
      description: "Alvenaria Externa",
      plannedStart: "2025-07-21",
      plannedEnd: "2025-07-28",
      actualStart: "2025-07-21",
      actualEnd: "2025-07-30", // 2 dias após previsto
    },
    {
      description: "Instalações Elétricas",
      plannedStart: "2025-07-29",
      plannedEnd: "2025-08-05",
      actualStart: "2025-07-31", // 2 dias após previsto
      actualEnd: "2025-08-06", // 1 dia após previsto
    },
    {
      description: "Instalações Hidráulicas",
      plannedStart: "2025-08-06",
      plannedEnd: "2025-08-13",
      actualStart: "2025-08-04", // 2 dias ANTES do previsto
      actualEnd: "2025-08-12", // 1 dia antes do previsto
    },
    {
      description: "Revestimento Interno",
      plannedStart: "2025-08-14",
      plannedEnd: "2025-08-25",
      actualStart: "2025-08-12", // 2 dias ANTES do previsto
      actualEnd: "", // Em andamento em 22/08/2025
    },
    {
      description: "Pintura e Acabamentos",
      plannedStart: "2025-08-26",
      plannedEnd: "2025-09-04",
      actualStart: "",
      actualEnd: "",
    },
    {
      description: "Limpeza Final e Entrega",
      plannedStart: "2025-09-05",
      plannedEnd: "2025-09-10",
      actualStart: "",
      actualEnd: "",
    },
  ],
};

const Home = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleCreateReport = (data: ReportData) => {
    sessionStorage.setItem("currentReport", JSON.stringify(data));
    setIsModalOpen(false);
    navigate("/relatorio");
  };

  const handleViewSample = () => {
    sessionStorage.setItem("currentReport", JSON.stringify(sampleReportData));
    navigate("/relatorio");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-4 md:p-6 border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={bwildLogo} 
              alt="Bwild Logo" 
              className="h-8 md:h-10 w-auto"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="max-w-2xl w-full text-center space-y-8 animate-fade-in">
          {/* Hero Section */}
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-primary shadow-lg mb-4">
              <FileText className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Relatório de Obra
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Crie relatórios profissionais de acompanhamento de obra com curva S e cronograma detalhado.
            </p>
          </div>

          {/* Features */}
          <div className="grid gap-4 md:grid-cols-3 text-left">
            <div className="p-4 rounded-xl bg-card border border-border">
              <Building2 className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Dados do Projeto</h3>
              <p className="text-sm text-muted-foreground">
                Registre informações do empreendimento e cliente.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <svg className="w-8 h-8 text-primary mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M7 16c3-4 5-8 10-11" />
              </svg>
              <h3 className="font-semibold text-foreground mb-1">Curva S</h3>
              <p className="text-sm text-muted-foreground">
                Visualize o progresso previsto vs realizado.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <svg className="w-8 h-8 text-primary mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <h3 className="font-semibold text-foreground mb-1">Cronograma</h3>
              <p className="text-sm text-muted-foreground">
                Acompanhe atividades e identifique atrasos.
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="gradient-primary text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="w-5 h-5 mr-2" />
              Criar Novo Relatório
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 border-primary/30 hover:bg-primary/5 transition-all"
              onClick={handleViewSample}
            >
              <Eye className="w-5 h-5 mr-2" />
              Ver Exemplo
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} Bwild. Todos os direitos reservados.
      </footer>

      {/* Create Report Modal */}
      <CreateReportModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCreateReport={handleCreateReport}
      />
    </div>
  );
};

export default Home;
