import bwildLogo from "@/assets/bwild-logo.png";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Target, CheckCircle2, PlayCircle } from "lucide-react";

interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  completedActivities: number;
  totalActivities: number;
  startedActivities: number;
  onExportPDF?: () => void;
  isExporting?: boolean;
}

const ReportHeader = ({
  projectName,
  unitName,
  clientName,
  startDate,
  endDate,
  completedActivities,
  totalActivities,
  startedActivities,
  onExportPDF,
  isExporting = false,
}: ReportHeaderProps) => {
  const completedPercentage = ((completedActivities / totalActivities) * 100).toFixed(0);
  const startedPercentage = ((startedActivities / totalActivities) * 100).toFixed(0);

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
            value={startDate}
            variant="default"
          />
          <StatCard 
            icon={Target}
            label="Previsão de Término" 
            value={endDate}
            variant="default"
          />
          <StatCard
            icon={CheckCircle2}
            label="Atividades Concluídas"
            value={`${completedActivities}/${totalActivities}`}
            subValue={`${completedPercentage}%`}
            variant="success"
          />
          <StatCard
            icon={PlayCircle}
            label="Atividades Iniciadas"
            value={`${startedActivities}/${totalActivities}`}
            subValue={`${startedPercentage}%`}
            variant="info"
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

export default ReportHeader;