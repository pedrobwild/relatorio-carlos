import bwildLogo from "@/assets/bwild-logo.png";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Activity } from "@/types/report";
import { Progress } from "@/components/ui/progress";

interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
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

// Calcula o desvio total em dias das atividades concluídas
const calculateTotalDeviation = (activities: Activity[]): number => {
  let totalDeviation = 0;
  activities.forEach(a => {
    if (a.actualEnd && a.plannedEnd) {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      const actualEnd = new Date(a.actualEnd + "T00:00:00");
      const diffDays = Math.ceil((actualEnd.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
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
    <header className="bg-card rounded-xl shadow-card overflow-hidden mb-6 animate-fade-in">
      {/* Top Section - Logo, Title, Export */}
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4">
          {/* Mobile: Stack vertically, Desktop: Side by side */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Logo */}
            <div className="shrink-0">
              <img 
                src={bwildLogo} 
                alt="Logo" 
                className="h-8 md:h-10 w-auto opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>

            {/* Title & Info */}
            <div className="flex-1 md:text-right">
              <h1 className="text-lg md:text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                Relatório de Obra
              </h1>
              <p className="text-sm md:text-base font-medium text-primary mt-1">
                {projectName} – {unitName}
              </p>
              {clientName && (
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
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

          {/* Export Button - Mobile (Full Width) */}
          {onExportPDF && (
            <div className="md:hidden">
              <Button
                onClick={onExportPDF}
                disabled={isExporting}
                className="w-full"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? "Gerando..." : "Exportar PDF"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="border-t border-border bg-secondary/30 px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 md:gap-4">
          <StatCard 
            icon={Calendar}
            label="Início da Obra" 
            value={formatDate(startDate, baseYear)}
          />
          <StatCard 
            icon={Target}
            label="Previsão de Término" 
            value={formatDate(endDate, baseYear)}
          />
          <DeviationCard totalDeviation={totalDeviation} />
          <ProgressCard
            completionPercentage={completionPercentage}
            completedActivities={completedActivities}
            totalActivities={activities.length}
          />
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

interface DeviationCardProps {
  totalDeviation: number;
}

const DeviationCard = ({ totalDeviation }: DeviationCardProps) => {
  const isAhead = totalDeviation < 0;
  const isOnTime = totalDeviation === 0;
  
  const Icon = isOnTime ? Minus : isAhead ? TrendingUp : TrendingDown;
  const statusText = isOnTime ? "No prazo" : isAhead ? "Adiantado" : "Atrasado";
  const colorClass = isOnTime ? "text-muted-foreground" : isAhead ? "text-success" : "text-warning";
  const bgClass = isOnTime ? "bg-muted" : isAhead ? "bg-success/10" : "bg-warning/10";
  const iconBgClass = isOnTime ? "bg-muted" : isAhead ? "bg-success/10" : "bg-warning/10";
  
  return (
    <div className="bg-card rounded-lg p-3 md:p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg ${iconBgClass} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 md:w-5 md:h-5 ${colorClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide font-medium truncate">
            Status Geral
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-base md:text-xl font-bold tabular-nums ${colorClass}`}>
              {isOnTime ? "0d" : isAhead ? `${Math.abs(totalDeviation)}d` : `+${totalDeviation}d`}
            </span>
            <span className={`text-[10px] md:text-xs font-semibold px-1.5 py-0.5 rounded ${bgClass} ${colorClass}`}>
              {statusText}
            </span>
          </div>
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
