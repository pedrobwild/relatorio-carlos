import { ClientDecision } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, AlertCircle, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClientDecisionsSectionProps {
  decisions: ClientDecision[];
}

const ClientDecisionsSection = ({ decisions }: ClientDecisionsSectionProps) => {
  const pendingDecisions = decisions.filter(d => d.status === "pending");

  if (pendingDecisions.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Decisões e Aprovações do Cliente</h3>
        </div>
      </div>
      
      <div className="divide-y divide-border">
        {pendingDecisions.map((decision) => (
          <div key={decision.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{decision.description}</p>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs shrink-0">
                Pendente
              </Badge>
            </div>
            
            {decision.options && decision.options.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Opções: </span>
                {decision.options.join(" | ")}
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span>Se atrasar: {decision.impactIfDelayed}</span>
              </div>
              <div className="flex items-center gap-1 text-warning font-medium">
                <Calendar className="w-3 h-3" />
                <span>Precisamos até {format(new Date(decision.dueDate), "dd/MM", { locale: ptBR })}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientDecisionsSection;
