import bwildLogo from "@/assets/bwild-logo.png";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Target, TrendingUp, PlayCircle, ArrowRight } from "lucide-react";
import { Activity } from "@/types/report";

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
  
  // Find current activity (started but not finished)
  const currentActivity = activities.find(a => a.actualStart && !a.actualEnd);
  
  // Find next activity (not started yet)
  const nextActivity = activities.find(a => !a.actualStart);

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard 
            icon={Calendar}
            label="Início da Obra" 
            value={formatDate(startDate, baseYear)}
            variant="default"
          />
          <StatCard 
            icon={Target}
            label="Previsão de Término" 
            value={formatDate(endDate, baseYear)}
            variant="default"
          />
          <StatCard
            icon={TrendingUp}
            label="Conclusão"
            value={`${completionPercentage}%`}
            subValue={`${completedActivities}/${activities.length}`}
            variant="success"
          />
          <ActivityCard
            currentActivity={currentActivity?.description}
            nextActivity={nextActivity?.description}
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
  subValue?: string;
  variant?: "default" | "success" | "info";
}

const StatCard = ({ icon: Icon, label, value, subValue, variant = "default" }: StatCardProps) => {
  const config = {
    default: {
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-foreground",
    },
    success: {
      iconBg: "bg-success/10",
      iconColor: "text-success",
      valueColor: "text-success",
    },
    info: {
      iconBg: "bg-info/10",
      iconColor: "text-info",
      valueColor: "text-info",
    },
  };

  const { iconBg, iconColor, valueColor } = config[variant];

  return (
    <div className="bg-card rounded-lg p-3 md:p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 md:w-5 md:h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide font-medium truncate">
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <p className={`text-base md:text-xl font-bold ${valueColor} tabular-nums`}>
              {value}
            </p>
            {subValue && (
              <span className="text-xs md:text-sm text-muted-foreground font-medium">
                ({subValue})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ActivityCardProps {
  currentActivity?: string;
  nextActivity?: string;
}

const ActivityCard = ({ currentActivity, nextActivity }: ActivityCardProps) => {
  return (
    <div className="bg-card rounded-lg p-3 md:p-4 border border-border/50 hover:border-border transition-colors col-span-2 lg:col-span-1">
      <div className="flex flex-col gap-2">
        {currentActivity && (
          <div className="flex items-start gap-2">
            <div className="shrink-0 w-6 h-6 rounded-full bg-info/10 flex items-center justify-center mt-0.5">
              <PlayCircle className="w-3.5 h-3.5 text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                Em andamento
              </p>
              <p className="text-xs md:text-sm font-medium text-foreground truncate" title={currentActivity}>
                {currentActivity}
              </p>
            </div>
          </div>
        )}
        {nextActivity && (
          <div className="flex items-start gap-2">
            <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                Próxima
              </p>
              <p className="text-xs md:text-sm font-medium text-muted-foreground truncate" title={nextActivity}>
                {nextActivity}
              </p>
            </div>
          </div>
        )}
        {!currentActivity && !nextActivity && (
          <div className="flex items-center justify-center h-full py-2">
            <p className="text-xs text-muted-foreground">Obra concluída</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportHeader;
