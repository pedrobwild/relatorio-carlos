import bwildLogo from "@/assets/bwild-logo.png";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Target, FileText, CheckCircle2 } from "lucide-react";
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
    if (a.actualEnd && a.plannedEnd) {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      const actualEnd = new Date(a.actualEnd + "T00:00:00");
      const diffDays = Math.ceil((actualEnd.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
      totalDeviation += diffDays;
    } else if (a.actualStart && a.plannedStart && !a.actualEnd) {
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
  
  // Determine schedule status
  const getScheduleStatus = () => {
    if (totalDeviation <= 0) return { label: "Em dia", color: "text-success", bgColor: "bg-success/10" };
    if (totalDeviation <= 3) return { label: "Atenção", color: "text-warning", bgColor: "bg-warning/10" };
    return { label: "Atrasado", color: "text-destructive", bgColor: "bg-destructive/10" };
  };
  
  const scheduleStatus = getScheduleStatus();

  return (
    <header className="bg-card rounded-xl shadow-card overflow-hidden mb-4 md:mb-6 animate-fade-in">
      {/* Top Section - Branding & Actions */}
      <div className="relative">
        {/* Gradient accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
        
        <div className="p-5 md:p-6 lg:p-8 pt-6 md:pt-7 lg:pt-9">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            {/* Logo with container */}
            <div className="flex items-center gap-4">
              <div className="bg-background rounded-xl p-2.5 shadow-sm border border-border/50">
                <img 
                  src={bwildLogo} 
                  alt="Bwild" 
                  className="h-8 md:h-10 w-auto"
                />
              </div>
              
              {/* Desktop: Inline project badge */}
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-xs font-medium text-foreground/50 uppercase tracking-wider">Relatório de Obra</span>
              </div>
            </div>

            {/* Export Button - Desktop */}
            {onExportPDF && (
              <Button
                onClick={onExportPDF}
                disabled={isExporting}
                size="default"
                className="hidden md:inline-flex shadow-sm gap-2"
              >
                <Download className="w-4 h-4" />
                {isExporting ? "Gerando..." : "Exportar PDF"}
              </Button>
            )}
          </div>

          {/* Project Title Section */}
          <div className="space-y-3 mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight leading-none">
                {projectName}
              </h1>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm md:text-base font-semibold">
                {unitName}
              </span>
            </div>
            
            {clientName && (
              <div className="flex items-center gap-2 text-sm md:text-base">
                <span className="text-foreground/60">Cliente:</span>
                <span className="font-semibold text-foreground">{clientName}</span>
              </div>
            )}
          </div>

          {/* Mobile Export Button */}
          {onExportPDF && (
            <Button
              onClick={onExportPDF}
              disabled={isExporting}
              className="w-full h-12 text-base font-semibold md:hidden"
              size="lg"
            >
              <Download className="w-5 h-5 mr-2" />
              {isExporting ? "Gerando..." : "Exportar PDF"}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Section */}
      <div className="border-t border-border bg-muted/30">
        <div className="p-4 md:p-6 lg:p-8">
          {/* Mobile: Horizontal scroll cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 md:hidden snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
            <MetricCard 
              label="Início"
              value={formatDate(startDate, baseYear)}
              sublabel="Previsto"
            />
            <MetricCard 
              label="Término"
              value={formatDate(endDate, baseYear)}
              sublabel="Meta"
            />
            <MetricCard 
              label="Relatório"
              value={formatDate(reportDate, baseYear)}
              sublabel="Emissão"
            />
            <ProgressMetricCard
              percentage={completionPercentage}
              completed={completedActivities}
              total={activities.length}
              status={scheduleStatus}
            />
          </div>
          
          {/* Desktop: Grid layout */}
          <div className="hidden md:grid md:grid-cols-4 gap-4 lg:gap-6">
            <MetricCard 
              label="Início"
              value={formatDate(startDate, baseYear)}
              sublabel="Previsto"
            />
            <MetricCard 
              label="Término"
              value={formatDate(endDate, baseYear)}
              sublabel="Meta"
            />
            <MetricCard 
              label="Relatório"
              value={formatDate(reportDate, baseYear)}
              sublabel="Emissão"
            />
            <ProgressMetricCard
              percentage={completionPercentage}
              completed={completedActivities}
              total={activities.length}
              status={scheduleStatus}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  sublabel: string;
}

const MetricCard = ({ label, value, sublabel }: MetricCardProps) => {
  return (
    <div className="min-w-[130px] md:min-w-0 snap-start bg-card rounded-xl p-4 border border-border/60 hover:border-border hover:shadow-sm transition-all duration-200">
      <div className="flex flex-col">
        <span className="text-xs text-foreground/50 uppercase tracking-wider font-medium mb-1">
          {sublabel}
        </span>
        <span className="text-2xl md:text-3xl font-bold text-foreground tabular-nums leading-none mb-1">
          {value}
        </span>
        <span className="text-sm text-foreground/70 font-medium">
          {label}
        </span>
      </div>
    </div>
  );
};

interface ProgressMetricCardProps {
  percentage: number;
  completed: number;
  total: number;
  status: { label: string; color: string; bgColor: string };
}

const ProgressMetricCard = ({ percentage, completed, total, status }: ProgressMetricCardProps) => {
  return (
    <div className="min-w-[160px] md:min-w-0 snap-start bg-card rounded-xl p-4 border border-border/60 hover:border-border hover:shadow-sm transition-all duration-200">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-foreground/50 uppercase tracking-wider font-medium">
            Progresso
          </span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
            <CheckCircle2 className="w-3 h-3" />
            {status.label}
          </span>
        </div>
        
        <div className="flex items-end justify-between gap-3 mb-2">
          <span className="text-3xl md:text-4xl font-bold text-primary tabular-nums leading-none">
            {percentage}%
          </span>
          <span className="text-sm text-foreground/60 font-medium pb-1">
            {completed}/{total} etapas
          </span>
        </div>
        
        <Progress value={percentage} className="h-2" />
      </div>
    </div>
  );
};

export default ReportHeader;
