import bwildLogo from "@/assets/bwild-logo.png";
import { Button } from "@/components/ui/button";
import { Download, FileText, Box, Ruler, DollarSign, Headphones } from "lucide-react";
import { Activity } from "@/types/report";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  const quickLinks = [
    { icon: FileText, label: "Contrato", href: "#contrato" },
    { icon: Box, label: "Projeto 3D", href: "#projeto-3d" },
    { icon: Ruler, label: "Projeto Executivo", href: "#projeto-executivo" },
    { icon: DollarSign, label: "Financeiro", href: "#financeiro" },
    { icon: Headphones, label: "Suporte", href: "#suporte" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <header className="bg-card rounded-xl border border-border overflow-hidden mb-4 md:mb-6 animate-fade-in">
        <div className="p-4 md:p-5">
          {/* Row 1: Logo + Project + Quick Links + Export */}
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

            <div className="flex items-center gap-2">
              {/* Quick Links - Desktop */}
              <div className="hidden md:flex items-center gap-1 mr-2">
                {quickLinks.map((link) => (
                  <Tooltip key={link.label}>
                    <TooltipTrigger asChild>
                      <a
                        href={link.href}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <link.icon className="w-4 h-4" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {link.label}
                    </TooltipContent>
                  </Tooltip>
                ))}
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

          {/* Quick Links - Mobile */}
          <div className="flex md:hidden items-center justify-start gap-1 mb-4 overflow-x-auto pb-1">
            {quickLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground bg-muted/50 hover:bg-accent hover:text-foreground transition-colors whitespace-nowrap"
              >
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
              </a>
            ))}
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
    </TooltipProvider>
  );
};

export default ReportHeader;
