import { WeeklyReportData, DeliverableItem } from "@/types/weeklyReport";
import { CheckCircle2 } from "lucide-react";

interface ExecutiveSummaryProps {
  data: WeeklyReportData;
}

const ExecutiveSummary = ({ data }: ExecutiveSummaryProps) => {
  return (
    <div className="space-y-4">
      {/* Summary Text */}
      <div className="bg-card rounded-lg p-4 sm:p-5 border border-border">
        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2.5">Resumo Executivo</h3>
        <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
          {data.executiveSummary}
        </p>
      </div>

      {/* Deliverables Completed This Week */}
      {data.deliverablesCompleted.length > 0 && (
        <div className="bg-card rounded-lg p-4 sm:p-5 border border-border">
          <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2.5">Entregáveis concluídos na semana</h3>
          <ul className="space-y-2">
            {data.deliverablesCompleted.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
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
