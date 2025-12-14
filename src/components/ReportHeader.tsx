import bwildLogo from "@/assets/bwild-logo.png";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Target, FileText } from "lucide-react";
import { Activity } from "@/types/report";
import { Progress } from "@/components/ui/progress";

interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  reportDate: string;
  activities: Activity[];
  onExportPDF?: () => void;
  isExporting?: boolean;
}

// Formata data como dd/mm ou dd/mm/aa se for ano diferente do ano base
const formatDate = (dateStr: string, baseYear?: number): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  
  if (baseYear && year !== baseYear) {
    return `${day}/${month}/${year.toString().slice(-2)}`;
  }
  return `${day}/${month}`;
};

// Calcula o desvio total em dias considerando início e término
const calculateTotalDeviation = (activities: Activity[]): number => {
  let totalDeviation = 0;
  
  activities.forEach(a => {
    // Para atividades concluídas, usar o desvio do término
    if (a.actualEnd && a.plannedEnd) {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      const actualEnd = new Date(a.actualEnd + "T00:00:00");
      const diffDays = Math.ceil((actualEnd.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
      totalDeviation += diffDays;
    }
    // Para atividades em andamento, usar o desvio do início
    else if (a.actualStart && a.plannedStart && !a.actualEnd) {
      const plannedStart = new Date(a.plannedStart + "T00:00:00");
      const actualStart = new Date(a.actualStart + "T00:00:00");
      const diffDays = Math.ceil((actualStart.getTime() - plannedStart.getTime()) / (1000 * 60 * 60 * 24));
      totalDeviation += diffDays;
    }
  });
  
  return totalDeviation;
};

const ReportHeader = ({
  projectName,
  unitName,
  clientName,
  startDate,
  endDate,
  reportDate,
  activities,
  onExportPDF,
  isExporting = false,
}: ReportHeaderProps) => {
  const baseYear = startDate ? new Date(startDate + "T00:00:00").getFullYear() : new Date().getFullYear();
  
  // Calculate completion percentage
  const completedActivities = activities.filter(a => a.actualEnd).length;
  const completionPercentage = Math.round((completedActivities / activities.length) * 100);
  
  // Calculate total deviation
  const totalDeviation = calculateTotalDeviation(activities);

  return (
    <header className="bg-card rounded-xl shadow-card overflow-hidden mb-4 md:mb-6 animate-fade-in">
      {/* Top Section - Logo, Title, Export */}
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4">
          {/* Mobile: Compact layout */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
            {/* Logo - Hidden on mobile (shown in sticky header) */}
            <div className="shrink-0 hidden md:block">
              <img 
                src={bwildLogo} 
                alt="Logo" 
                className="h-8 md:h-10 w-auto opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>

            {/* Title & Info */}
            <div className="flex-1 md:text-right">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                {projectName} – {unitName}
              </h1>
              {clientName && (
                <p className="text-sm text-muted-foreground mt-1">
                  Cliente: {clientName}
                </p>
              )}
            </div>

            {/* Export Button - Desktop */}
            {onExportPDF && (
              <div className="hidden md:block shrink-0">
                <Button
                  onClick={onExportPDF}
                  disabled={isExporting}
                  size="default"
                  className="shadow-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? "Gerando..." : "Exportar PDF"}
                </Button>
              </div>
            )}
          </div>

          {/* Export Button - Mobile (Floating Action Button style) */}
          {onExportPDF && (
            <div className="md:hidden">
              <Button
                onClick={onExportPDF}
                disabled={isExporting}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                {isExporting ? "Gerando..." : "Exportar PDF"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Section - Horizontal scroll on mobile */}
      <div className="border-t border-border bg-secondary/30 px-3 py-3 md:px-6 md:py-5 lg:px-8 lg:py-6">
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 md:grid md:grid-cols-4 md:gap-4 snap-x snap-mandatory scrollbar-hide">
          <div className="min-w-[140px] md:min-w-0 snap-start">
            <StatCard 
              icon={Calendar}
              label="Início" 
              value={formatDate(startDate, baseYear)}
            />
          </div>
          <div className="min-w-[140px] md:min-w-0 snap-start">
            <StatCard 
              icon={Target}
              label="Término" 
              value={formatDate(endDate, baseYear)}
            />
          </div>
          <div className="min-w-[140px] md:min-w-0 snap-start">
            <StatCard 
              icon={FileText}
              label="Relatório" 
              value={formatDate(reportDate, baseYear)}
            />
          </div>
          <div className="min-w-[160px] md:min-w-0 snap-start">
            <ProgressCard
              completionPercentage={completionPercentage}
              completedActivities={completedActivities}
              totalActivities={activities.length}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

const StatCard = ({ icon: Icon, label, value }: StatCardProps) => {
  return (
    <div className="bg-card rounded-lg p-3 md:p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide font-medium truncate">
            {label}
          </p>
          <p className="text-base md:text-xl font-bold text-foreground tabular-nums mt-0.5">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};


interface ProgressCardProps {
  completionPercentage: number;
  completedActivities: number;
  totalActivities: number;
}

const ProgressCard = ({ completionPercentage, completedActivities, totalActivities }: ProgressCardProps) => {
  return (
    <div className="bg-card rounded-lg p-3 md:p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Conclusão
          </p>
          <span className="text-xs md:text-sm text-muted-foreground font-medium">
            {completedActivities}/{totalActivities}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={completionPercentage} className="h-2.5 flex-1" />
          <span className="text-lg md:text-xl font-bold text-primary tabular-nums min-w-[3rem] text-right">
            {completionPercentage}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportHeader;
