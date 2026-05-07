import { WeeklyReportData } from "@/types/weeklyReport";
import { Phone, Mail, Info } from "lucide-react";

interface ReportFooterProps {
  data: WeeklyReportData;
}

const ReportFooter = ({ data }: ReportFooterProps) => {
  return (
    <div className="bg-card rounded-lg border border-border p-4 sm:p-5 space-y-4">
      {/* Disclaimer */}
      <div className="flex items-start gap-3 text-xs sm:text-sm text-foreground/70">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Obras possuem variáveis e imprevistos inerentes ao processo
          construtivo. O plano de ação é contínuo e ajustado semanalmente
          conforme evolução. Qualquer dúvida, entre em contato.
        </p>
      </div>

      {/* Contact */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-foreground/60 shrink-0" />
          <span className="text-sm font-medium text-foreground">
            (11) 99999-9999
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-foreground/60 shrink-0" />
          <span className="text-sm font-medium text-foreground">
            contato@bwild.com.br
          </span>
        </div>
      </div>

      {/* Signature */}
      <div className="pt-3 border-t border-border">
        <p className="text-sm sm:text-base font-semibold text-foreground">
          {data.preparedBy}
        </p>
        <p className="text-xs sm:text-sm text-primary font-medium">
          Gestão de Obras - Bwild
        </p>
      </div>
    </div>
  );
};

export default ReportFooter;
