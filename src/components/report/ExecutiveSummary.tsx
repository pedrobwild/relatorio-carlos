import { WeeklyReportData, DeliverableItem } from "@/types/weeklyReport";
import { CheckCircle2, FileText } from "lucide-react";

interface ExecutiveSummaryProps {
  data: WeeklyReportData;
}

const ExecutiveSummary = ({ data }: ExecutiveSummaryProps) => {
  return (
    <div className="space-y-4">
      {/* Summary Text */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Resumo Executivo</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {data.executiveSummary}
        </p>
      </div>

      {/* Deliverables Completed This Week */}
      {data.deliverablesCompleted.length > 0 && (
        <div className="bg-card rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-sm font-medium text-foreground">Entregáveis concluídos na semana</span>
          </div>
          <ul className="space-y-2">
            {data.deliverablesCompleted.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span>{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummary;
