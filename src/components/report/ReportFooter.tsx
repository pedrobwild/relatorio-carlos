import { WeeklyReportData } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Mail, Calendar, Info } from "lucide-react";

interface ReportFooterProps {
  data: WeeklyReportData;
}

const ReportFooter = ({ data }: ReportFooterProps) => {
  return (
    <div className="bg-card rounded-lg border border-border p-4 space-y-4">
      {/* Next Milestones Reminder */}
      <div className="flex items-start gap-3">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Próximos marcos</p>
          <div className="flex flex-wrap gap-2">
            {data.nextMilestones.slice(0, 3).map((milestone, index) => (
              <span key={index} className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                {milestone.description} ({format(new Date(milestone.dueDate), "dd/MM", { locale: ptBR })})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Obras possuem variáveis e imprevistos inerentes ao processo construtivo. O plano de ação é contínuo e ajustado semanalmente conforme evolução. Qualquer dúvida, entre em contato.
        </p>
      </div>

      {/* Contact */}
      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">(11) 99999-9999</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">contato@bwild.com.br</span>
        </div>
      </div>

      {/* Signature */}
      <div className="pt-3 border-t border-border">
        <p className="text-sm font-semibold text-foreground">{data.preparedBy}</p>
        <p className="text-xs text-primary font-medium">Gestão de Obras - Bwild</p>
      </div>
    </div>
  );
};

export default ReportFooter;
