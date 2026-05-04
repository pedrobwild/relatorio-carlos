import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, FileText, Building2, Eye, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import CreateReportModal from "@/components/CreateReportModal";
import { ReportData } from "@/types/report";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/config/flags";

// Demo data - only used when isDemoMode is true
const sampleReportData: ReportData = {
  projectName: "Hub Brooklyn",
  unitName: "502",
  clientName: "Pedro Alves",
  startDate: "2025-07-01",
  endDate: "2025-09-14",
  reportDate: "2025-09-08",
  activities: [
    {
      id: "home-1",
      description: "Preparação e Mobilização",
      plannedStart: "2025-07-01",
      plannedEnd: "2025-07-05",
      actualStart: "2025-07-01",
      actualEnd: "2025-07-04",
      weight: 5,
    },
    {
      id: "home-2",
      description: "Proteções, demolições e infraestrutura",
      plannedStart: "2025-07-07",
      plannedEnd: "2025-07-18",
      actualStart: "2025-07-05",
      actualEnd: "2025-07-19",
      weight: 15,
    },
    {
      id: "home-3",
      description: "Pisos, revestimentos, bancadas e box",
      plannedStart: "2025-07-21",
      plannedEnd: "2025-08-03",
      actualStart: "2025-07-21",
      actualEnd: "2025-08-03",
      weight: 20,
    },
    {
      id: "home-4",
      description: "Pinturas e metais",
      plannedStart: "2025-08-04",
      plannedEnd: "2025-08-10",
      actualStart: "2025-08-06",
      actualEnd: "2025-08-12",
      weight: 10,
    },
    {
      id: "home-5",
      description: "Instalações e elétrica",
      plannedStart: "2025-08-11",
      plannedEnd: "2025-08-17",
      actualStart: "2025-08-14",
      actualEnd: "2025-08-17",
      weight: 10,
    },
    {
      id: "home-6",
      description: "Marcenaria",
      plannedStart: "2025-08-20",
      plannedEnd: "2025-09-05",
      actualStart: "2025-08-20",
      actualEnd: "2025-09-05",
      weight: 33,
    },
    {
      id: "home-7",
      description: "Etapa atual: Instalação de mobiliário e eletros",
      plannedStart: "2025-09-08",
      plannedEnd: "2025-09-10",
      actualStart: "2025-09-08",
      actualEnd: "",
      weight: 3,
    },
    {
      id: "home-8",
      description: "Limpeza fina",
      plannedStart: "2025-09-11",
      plannedEnd: "2025-09-11",
      actualStart: "",
      actualEnd: "",
      weight: 2,
    },
    {
      id: "home-9",
      description: "Vistoria de qualidade",
      plannedStart: "2025-09-12",
      plannedEnd: "2025-09-12",
      actualStart: "",
      actualEnd: "",
      weight: 1,
    },
    {
      id: "home-10",
      description: "Conclusão",
      plannedStart: "2025-09-14",
      plannedEnd: "2025-09-14",
      actualStart: "",
      actualEnd: "",
      weight: 1,
    },
  ],
};

const Home = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleCreateReport = (data: ReportData) => {
    sessionStorage.setItem("currentReport", JSON.stringify(data));
    setIsModalOpen(false);
    // BUG FIX: Rota /relatorio é legacy e redireciona para /minhas-obras
    // Em demo mode, vai para uma obra demo ou mostra mensagem
    navigate("/minhas-obras");
  };

  const handleViewSample = () => {
    if (!isDemoMode) {
      return; // Should not be callable in production
    }
    sessionStorage.setItem("currentReport", JSON.stringify(sampleReportData));
    // BUG FIX: Rota /relatorio é legacy
    navigate("/minhas-obras");
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-gradient-to-br from-background via-accent/20 to-primary/10 relative overflow-x-hidden">
      {/* Subtle decorative elements - using Bwild purple tones */}
      <div className="absolute top-0 right-0 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-gradient-radial from-primary/10 via-accent/5 to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-gradient-radial from-primary/8 via-accent/3 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      {/* Header */}
      <AppHeader />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-5 md:p-8 relative z-10">
        <div className="max-w-2xl w-full text-center space-y-6 md:space-y-8">
          {/* Hero Section */}
          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col items-center gap-2 md:gap-3 animate-fade-in">
              <h1 className="text-h1 text-3xl md:text-5xl tracking-tight">
                Portal do Cliente
              </h1>
            </div>
            <p className="text-body text-muted-foreground max-w-md mx-auto leading-relaxed animate-fade-in [animation-delay:100ms] opacity-0 [animation-fill-mode:forwards] px-2">
              {isDemoMode
                ? "Crie relatórios profissionais de acompanhamento de obra com curva S e cronograma detalhado."
                : "Acompanhe suas obras com transparência e profissionalismo."}
            </p>
          </div>

          {/* Features - Horizontal scroll on mobile */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-4 scrollbar-hide snap-x snap-mandatory">
            <div className="min-w-[200px] md:min-w-0 p-4 rounded-xl bg-card border border-border hover-scale animate-fade-in [animation-delay:200ms] opacity-0 [animation-fill-mode:forwards] snap-start">
              <Building2 className="w-7 h-7 md:w-8 md:h-8 text-primary mb-2 md:mb-3" />
              <h3 className="text-h3 mb-1">Dados do Projeto</h3>
              <p className="text-caption">
                Registre informações do empreendimento e cliente.
              </p>
            </div>
            <div className="min-w-[200px] md:min-w-0 p-4 rounded-xl bg-card border border-border hover-scale animate-fade-in [animation-delay:300ms] opacity-0 [animation-fill-mode:forwards] snap-start">
              <svg
                className="w-7 h-7 md:w-8 md:h-8 text-primary mb-2 md:mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 3v18h18" />
                <path d="M7 16c3-4 5-8 10-11" />
              </svg>
              <h3 className="text-h3 mb-1">Curva S</h3>
              <p className="text-caption">
                Visualize o progresso previsto vs realizado.
              </p>
            </div>
            <div className="min-w-[200px] md:min-w-0 p-4 rounded-xl bg-card border border-border hover-scale animate-fade-in [animation-delay:400ms] opacity-0 [animation-fill-mode:forwards] snap-start">
              <svg
                className="w-7 h-7 md:w-8 md:h-8 text-primary mb-2 md:mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <h3 className="text-h3 mb-1">Cronograma</h3>
              <p className="text-caption">
                Acompanhe atividades e identifique atrasos.
              </p>
            </div>
          </div>

          {/* CTA Buttons - Only show demo buttons in demo mode */}
          {isDemoMode ? (
            <div className="flex flex-col gap-3 md:flex-row md:gap-4 justify-center animate-fade-in [animation-delay:500ms] opacity-0 [animation-fill-mode:forwards] px-2 md:px-0">
              <Button
                size="lg"
                className="gradient-primary text-base md:text-lg px-6 md:px-8 py-5 md:py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 w-full md:w-auto"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus className="w-5 h-5 mr-2" />
                Criar Novo Relatório
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 border-primary/30 hover:bg-primary/5 transition-all hover:scale-105 w-full md:w-auto"
                onClick={handleViewSample}
              >
                <Eye className="w-5 h-5 mr-2" />
                Ver Exemplo
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 animate-fade-in [animation-delay:500ms] opacity-0 [animation-fill-mode:forwards] px-2 md:px-0">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p className="text-body">
                  Acesse suas obras pelo menu de navegação ou entre em contato
                  com seu engenheiro.
                </p>
              </div>
              {isAuthenticated && (
                <Link to="/minhas-obras">
                  <Button size="lg" className="gradient-primary">
                    Ver Minhas Obras
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-caption border-t border-border/50 bg-card/20 backdrop-blur-sm">
        © {new Date().getFullYear()} Bwild. Todos os direitos reservados.
      </footer>

      {/* Create Report Modal - Only in demo mode */}
      {isDemoMode && (
        <CreateReportModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onCreateReport={handleCreateReport}
        />
      )}
    </div>
  );
};

export default Home;
