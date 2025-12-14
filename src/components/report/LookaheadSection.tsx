import { LookaheadTask } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, User, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LookaheadSectionProps {
  tasks: LookaheadTask[];
}

const getRiskBadge = (risk: LookaheadTask["risk"]) => {
  switch (risk) {
    case "baixo":
      return null; // Don't show badge for low risk
    case "médio":
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">Risco Mapeado</Badge>;
    case "alto":
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Risco Mapeado</Badge>;
  }
};

const LookaheadSection = ({ tasks }: LookaheadSectionProps) => {
  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-4 sm:p-5 border-b border-border">
        <h3 className="text-sm sm:text-base font-semibold text-foreground">Plano da Próxima Semana</h3>
      </div>
      
      <div className="divide-y divide-border">
        {tasks.map((task) => (
          <div key={task.id} className="p-4 sm:p-5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {format(new Date(task.date), "dd/MM", { locale: ptBR })}
                  </span>
                  {getRiskBadge(task.risk)}
                </div>
                <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">{task.description}</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-x-3 sm:gap-y-1 text-xs text-foreground/70">
              <div className="flex items-start gap-1.5">
                <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" />
                <span><span className="font-medium">Pré-requisito:</span> {task.prerequisites}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 shrink-0" />
                <span className="font-medium">{task.responsible}</span>
              </div>
            </div>
            
            {task.riskReason && (
              <div className="flex items-start gap-2 text-xs bg-warning/10 p-2.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning" />
                <span className="leading-relaxed text-foreground">{task.riskReason}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LookaheadSection;
