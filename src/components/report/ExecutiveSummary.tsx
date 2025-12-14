import { WeeklyReportData, DeliverableItem } from "@/types/weeklyReport";
import { CheckCircle2, FileText } from "lucide-react";

interface ExecutiveSummaryProps {
  data: WeeklyReportData;
}

const ExecutiveSummary = ({ data }: ExecutiveSummaryProps) => {
  return (
    <div className="space-y-4">
      {/* Summary Text */}
      <div className="bg-card rounded-lg p-4 sm:p-5 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <h3 className="text-base sm:text-lg font-semibold text-foreground">Resumo Executivo</h3>
        </div>
        <p className="text-sm sm:text-base text-foreground/80 leading-relaxed">
          {data.executiveSummary}
        </p>
      </div>

      {/* Deliverables Completed This Week */}
      {data.deliverablesCompleted.length > 0 && (
        <div className="bg-card rounded-lg p-4 sm:p-5 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground">Entregáveis concluídos na semana</h3>
          </div>
          <ul className="space-y-2.5">
            {data.deliverablesCompleted.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5 text-sm sm:text-base text-foreground/80">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span className="leading-relaxed">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummary;
