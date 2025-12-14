import { LookaheadTask } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, AlertTriangle, User, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LookaheadSectionProps {
  tasks: LookaheadTask[];
}

const getRiskBadge = (risk: LookaheadTask["risk"]) => {
  switch (risk) {
    case "baixo":
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">Baixo</Badge>;
    case "médio":
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">Médio</Badge>;
    case "alto":
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Alto</Badge>;
  }
};

const LookaheadSection = ({ tasks }: LookaheadSectionProps) => {
  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Plano da Próxima Semana (Lookahead 7 dias)</h3>
        </div>
      </div>
      
      <div className="divide-y divide-border">
        {tasks.map((task) => (
          <div key={task.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {format(new Date(task.date), "dd/MM", { locale: ptBR })}
                  </span>
                  {getRiskBadge(task.risk)}
                </div>
                <p className="text-sm font-medium text-foreground">{task.description}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                <span>Pré-requisito: {task.prerequisites}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{task.responsible}</span>
              </div>
            </div>
            
            {task.riskReason && (
              <div className="flex items-start gap-1.5 text-xs text-warning bg-warning/10 p-2 rounded">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>{task.riskReason}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LookaheadSection;
