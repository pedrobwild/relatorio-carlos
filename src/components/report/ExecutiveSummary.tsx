import { WeeklyReportData, DeliverableItem } from "@/types/weeklyReport";
import { CheckCircle2 } from "lucide-react";

interface ExecutiveSummaryProps {
  data: WeeklyReportData;
}

const ExecutiveSummary = ({ data }: ExecutiveSummaryProps) => {
  return (
    <div className="space-y-4">
      {/* Summary Text */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">Resumo Executivo</h3>
        </div>
        <div className="p-4 sm:p-6">
          <div className="text-sm sm:text-base text-foreground/85 leading-relaxed sm:leading-7 text-justify space-y-4">
            {data.executiveSummary.split('\n\n').map((paragraph, index) => (
              <p key={index} className="first-letter:text-lg first-letter:font-medium first-letter:text-foreground">{paragraph}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Deliverables Completed This Week */}
      {data.deliverablesCompleted.length > 0 && (
        <div className="bg-card rounded-lg border border-border">
          <div className="p-4 sm:p-5 border-b border-border">
            <h3 className="text-sm sm:text-base font-semibold text-foreground">Entregáveis concluídos na semana</h3>
          </div>
          <div className="p-4 sm:p-5">
            <ul className="space-y-2">
              {data.deliverablesCompleted.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/80">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{item.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummary;
