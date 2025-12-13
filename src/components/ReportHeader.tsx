import bwildLogo from "@/assets/bwild-logo.png";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

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
  const completedPercentage = ((completedActivities / totalActivities) * 100).toFixed(1);
  const startedPercentage = ((startedActivities / totalActivities) * 100).toFixed(1);

  return (
    <header className="bg-card rounded-xl shadow-card p-4 md:p-8 mb-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
        <img 
          src={bwildLogo} 
          alt="Bwild Logo" 
          className="h-10 md:h-14 w-auto"
        />
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-6 w-full md:w-auto">
          <div className="text-left md:text-right flex-1">
            <h1 className="text-xl md:text-3xl font-bold text-foreground mb-1">
              Relatório de Obra
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">{projectName} - {unitName}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{clientName}</p>
          </div>
          {onExportPDF && (
            <Button
              onClick={onExportPDF}
              disabled={isExporting}
              className="w-full md:w-auto"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? "Gerando..." : "Exportar PDF"}
            </Button>
          )}
        </div>
      </div>

      <div className="border-t-2 border-border pt-4 md:pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <StatCard label="Início da Obra" value={startDate} />
          <StatCard label="Previsão de Término" value={endDate} />
          <StatCard
            label="Atividades Concluídas"
            value={`${completedActivities}/${totalActivities}`}
            subValue={`${completedPercentage}%`}
            variant="success"
          />
          <StatCard
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
  label: string;
  value: string;
  subValue?: string;
  variant?: "default" | "success" | "info";
}

const StatCard = ({ label, value, subValue, variant = "default" }: StatCardProps) => {
  const valueColorClass = {
    default: "text-primary",
    success: "text-success",
    info: "text-info",
  }[variant];

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <p className={`text-xl md:text-2xl font-bold ${valueColorClass}`}>{value}</p>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      )}
    </div>
  );
};

export default ReportHeader;
