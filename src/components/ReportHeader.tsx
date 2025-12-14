import bwildLogo from "@/assets/bwild-logo.png";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
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

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
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
  const completedActivities = activities.filter(a => a.actualEnd).length;
  const completionPercentage = Math.round((completedActivities / activities.length) * 100);

  return (
    <header className="bg-card rounded-xl border border-border overflow-hidden mb-4 md:mb-6 animate-fade-in">
      <div className="p-4 md:p-5">
        {/* Row 1: Logo + Project + Export */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <img 
              src={bwildLogo} 
              alt="Bwild" 
              className="h-8 w-auto"
            />
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:block">
              <h1 className="text-base md:text-lg font-semibold text-foreground leading-tight">
                {projectName} – {unitName}
              </h1>
              {clientName && (
                <p className="text-sm text-foreground/70">
                  {clientName}
                </p>
              )}
            </div>
          </div>

          {onExportPDF && (
            <Button
              onClick={onExportPDF}
              disabled={isExporting}
              size="sm"
              variant="outline"
              className="hidden md:inline-flex gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Gerando..." : "Exportar PDF"}
            </Button>
          )}
        </div>

        {/* Mobile: Project name */}
        <div className="sm:hidden mb-4">
          <h1 className="text-base font-semibold text-foreground leading-tight">
            {projectName} – {unitName}
          </h1>
          {clientName && (
            <p className="text-sm text-foreground/70">{clientName}</p>
          )}
        </div>

        {/* Row 2: Metrics */}
        <div className="flex items-center gap-4 md:gap-6 text-sm text-foreground/70">
          <span>
            <span className="text-foreground/50">Início:</span>{" "}
            <span className="font-medium text-foreground">01/07/2025</span>
          </span>
          <span>
            <span className="text-foreground/50">Término:</span>{" "}
            <span className="font-medium text-foreground">14/09/2025</span>
          </span>
          <span className="hidden sm:inline">
            <span className="text-foreground/50">Última atualização:</span>{" "}
            <span className="font-medium text-foreground">08/09/2025</span>
          </span>
        </div>

        {/* Mobile Export Button */}
        {onExportPDF && (
          <Button
            onClick={onExportPDF}
            disabled={isExporting}
            className="w-full mt-4 md:hidden"
            size="default"
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Gerando..." : "Exportar PDF"}
          </Button>
        )}
      </div>
    </header>
  );
};

export default ReportHeader;
