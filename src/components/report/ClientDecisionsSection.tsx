import { ClientDecision } from "@/types/weeklyReport";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ClientDecisionsSectionProps {
  decisions: ClientDecision[];
}

const DecisionItem = ({
  decision,
  animationDelay = 0,
}: {
  decision: ClientDecision;
  animationDelay?: number;
}) => {
  const dueDate = new Date(decision.dueDate);
  const daysLeft = differenceInDays(dueDate, new Date());
  const isOverdue = isPast(dueDate);
  const isUrgent = daysLeft <= 2 && !isOverdue;

  return (
    <div
      className="px-5 py-3 sm:px-6 sm:py-4 space-y-2.5"
      style={{
        animationDelay: `${animationDelay}ms`,
        animation:
          animationDelay > 0 ? "fade-in 0.3s ease-out forwards" : undefined,
        opacity: animationDelay > 0 ? 0 : 1,
      }}
    >
      {/* Actionable headline */}
      <div className="flex items-start gap-2">
        {(isOverdue || isUrgent) && (
          <AlertCircle
            className={cn(
              "w-4 h-4 shrink-0 mt-0.5",
              isOverdue ? "text-destructive" : "text-[hsl(var(--warning))]",
            )}
          />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground leading-[1.5]">
            Você precisa: {decision.description}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-[1.5]">
            até{" "}
            <span className="font-semibold text-foreground">
              {format(dueDate, "EEEE (dd/MM)", { locale: ptBR })}
            </span>
            {decision.impactIfDelayed && (
              <>
                {" "}
                para{" "}
                <span className="text-foreground/80">
                  {decision.impactIfDelayed.toLowerCase()}
                </span>
              </>
            )}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-xs shrink-0",
            isOverdue
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : isUrgent
                ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20"
                : "bg-warning/10 text-foreground border-warning/20",
          )}
        >
          {isOverdue ? "Atrasado" : isUrgent ? "Urgente" : "Pendente"}
        </Badge>
      </div>

      {decision.options && decision.options.length > 0 && (
        <div className="text-sm text-foreground/75 leading-[1.6] ml-6">
          <span className="font-medium text-foreground/90">Opções: </span>
          {decision.options.join(" | ")}
        </div>
      )}

      <div className="flex items-center gap-2 ml-6">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              isOverdue
                ? "text-destructive"
                : isUrgent
                  ? "text-[hsl(var(--warning))]"
                  : "text-muted-foreground",
            )}
          >
            {isOverdue
              ? `${Math.abs(daysLeft)} dia(s) em atraso`
              : daysLeft === 0
                ? "Vence hoje"
                : `${daysLeft} dia(s) restante(s)`}
          </span>
        </div>
      </div>

      <p className="text-destructive text-xs leading-[1.5] ml-6">
        <span className="font-medium">Importante:</span> Será acrescido 1 dia à
        data de entrega a cada dia sem retorno após o vencimento do prazo.
      </p>
    </div>
  );
};

const ClientDecisionsSection = ({ decisions }: ClientDecisionsSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const pendingDecisions = decisions.filter((d) => d.status === "pending");

  if (pendingDecisions.length === 0) return null;

  const firstDecision = pendingDecisions[0];
  const remainingDecisions = pendingDecisions.slice(1);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-primary-dark">
        <h3 className="text-base font-semibold text-white tracking-tight">
          Decisões e Aprovações do Cliente
        </h3>
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
                <DecisionItem
                  key={decision.id}
                  decision={decision}
                  animationDelay={isOpen ? (index + 1) * 50 : 0}
                />
              ))}
            </CollapsibleContent>
          </div>

          {remainingDecisions.length > 0 && (
            <CollapsibleTrigger asChild>
              <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-tiny font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                {!isOpen && (
                  <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-tiny font-semibold">
                    +{remainingDecisions.length}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </div>
    </div>
  );
};

export default ClientDecisionsSection;
