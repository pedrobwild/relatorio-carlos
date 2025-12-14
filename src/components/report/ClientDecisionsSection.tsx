import { ClientDecision } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Calendar } from "lucide-react";
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
        <h3 className="text-sm sm:text-base font-semibold text-foreground">Decisões e Aprovações do Cliente</h3>
      </div>
      
      <div className="divide-y divide-border">
        {pendingDecisions.map((decision) => (
          <div key={decision.id} className="p-4 sm:p-5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">{decision.description}</p>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs shrink-0">
                Pendente
              </Badge>
            </div>
            
            {decision.options && decision.options.length > 0 && (
              <div className="text-xs text-foreground/70">
                <span className="font-medium">Opções: </span>
                {decision.options.join(" | ")}
              </div>
            )}
            
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <Calendar className="w-3 h-3 shrink-0 text-foreground" />
                <span>Prazo para decisão: {format(new Date(decision.dueDate), "dd/MM", { locale: ptBR })}</span>
              </div>
              <p className="text-destructive text-[10px] sm:text-xs leading-snug">
                <span className="font-medium">Importante:</span> Será acrescido 1 dia à data de entrega a cada dia sem retorno após o vencimento do prazo.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientDecisionsSection;
