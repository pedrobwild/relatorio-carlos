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
      <div className="p-4 sm:p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary shrink-0" />
          <h3 className="text-base sm:text-lg font-semibold text-foreground">Decisões e Aprovações do Cliente</h3>
        </div>
      </div>
      
      <div className="divide-y divide-border">
        {pendingDecisions.map((decision) => (
          <div key={decision.id} className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm sm:text-base font-medium text-foreground leading-snug">{decision.description}</p>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs shrink-0">
                Pendente
              </Badge>
            </div>
            
            {decision.options && decision.options.length > 0 && (
              <div className="text-xs sm:text-sm text-foreground/70">
                <span className="font-medium">Opções: </span>
                {decision.options.join(" | ")}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-start gap-1.5 text-destructive">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span><span className="font-medium">Se atrasar:</span> {decision.impactIfDelayed}</span>
              </div>
              <div className="flex items-center gap-1.5 text-warning font-semibold">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
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
