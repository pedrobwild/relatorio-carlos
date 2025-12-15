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
    className="p-4 sm:p-5 space-y-2"
    style={{ 
      animationDelay: `${animationDelay}ms`,
      animation: animationDelay > 0 ? 'fade-in 0.3s ease-out forwards' : undefined,
      opacity: animationDelay > 0 ? 0 : 1
    }}
  >
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
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
          {format(new Date(decision.dueDate), "dd/MM", { locale: ptBR })}
        </span>
        <span className="text-foreground/70">Prazo para decisão</span>
      </div>
      <p className="text-destructive text-[10px] sm:text-xs leading-snug">
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
    <div className="bg-card rounded-lg border border-border">
      <div className="p-4 sm:p-5 border-b border-border">
        <h3 className="text-sm sm:text-base font-semibold text-foreground">Decisões e Aprovações do Cliente</h3>
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
              <button className="w-full py-3 px-4 border-t border-border flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>{isOpen ? "Ver menos" : `Ver mais ${remainingDecisions.length} item${remainingDecisions.length > 1 ? 's' : ''}`}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </div>
    </div>
  );
};

export default ClientDecisionsSection;
