import { ClientDecision } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ClientDecisionsSectionProps {
  decisions: ClientDecision[];
}

const DecisionItem = ({ decision, animationDelay = 0 }: { decision: ClientDecision; animationDelay?: number }) => (
  <div 
    className="p-2.5 sm:p-3 space-y-2"
    style={{ 
      animationDelay: `${animationDelay}ms`,
      animation: animationDelay > 0 ? 'fade-in 0.3s ease-out forwards' : undefined,
      opacity: animationDelay > 0 ? 0 : 1
    }}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-body font-medium text-foreground leading-snug">{decision.description}</p>
      <Badge variant="outline" className="bg-warning/10 text-foreground border-warning/20 text-tiny shrink-0">
        Pendente
      </Badge>
    </div>
    
    {decision.options && decision.options.length > 0 && (
      <div className="text-caption leading-snug">
        <span className="font-medium">Opções: </span>
        {decision.options.join(" | ")}
      </div>
    )}
    
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-tiny font-semibold text-foreground bg-primary/10 px-1.5 py-0.5 rounded">
          {format(new Date(decision.dueDate), "dd/MM", { locale: ptBR })}
        </span>
        <span className="text-caption">Prazo para decisão</span>
      </div>
      <p className="text-destructive text-tiny leading-snug">
        <span className="font-medium">Importante:</span> Será acrescido 1 dia à data de entrega a cada dia sem retorno após o vencimento do prazo.
      </p>
    </div>
  </div>
);

const ClientDecisionsSection = ({ decisions }: ClientDecisionsSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const pendingDecisions = decisions.filter(d => d.status === "pending");

  if (pendingDecisions.length === 0) return null;

  const firstDecision = pendingDecisions[0];
  const remainingDecisions = pendingDecisions.slice(1);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-primary-dark">
        <h3 className="text-h2 text-white">Decisões e Aprovações do Cliente</h3>
      </div>
      
      {/* Desktop: Always show all */}
      <div className="hidden sm:block divide-y divide-border">
        {pendingDecisions.map((decision) => (
          <DecisionItem key={decision.id} decision={decision} />
        ))}
      </div>

      {/* Mobile: Collapsible */}
      <div className="sm:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="divide-y divide-border">
            <DecisionItem decision={firstDecision} />
            
            <CollapsibleContent className="divide-y divide-border overflow-hidden">
              {remainingDecisions.map((decision, index) => (
                <DecisionItem key={decision.id} decision={decision} animationDelay={isOpen ? (index + 1) * 50 : 0} />
              ))}
            </CollapsibleContent>
          </div>
          
          {remainingDecisions.length > 0 && (
            <CollapsibleTrigger asChild>
              <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-tiny font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                {!isOpen && <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-tiny font-semibold">+{remainingDecisions.length}</span>}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </div>
    </div>
  );
};

export default ClientDecisionsSection;
