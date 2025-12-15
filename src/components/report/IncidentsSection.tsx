import { Incident } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertOctagon, Calendar, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface IncidentsSectionProps {
  incidents: Incident[];
}

const IncidentItem = ({ incident, animationDelay = 0 }: { incident: Incident; animationDelay?: number }) => (
  <div 
    className="p-4 sm:p-5 space-y-3"
    style={{ 
      animationDelay: `${animationDelay}ms`,
      animation: animationDelay > 0 ? 'fade-in 0.3s ease-out forwards' : undefined,
      opacity: animationDelay > 0 ? 0 : 1
    }}
  >
    {/* Ocorrência */}
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertOctagon className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Ocorrência</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-primary/10 px-2 py-0.5 rounded-md">
          <Calendar className="w-3 h-3" />
          {format(new Date(incident.occurrenceDate), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      </div>
      <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed ml-5.5">{incident.occurrence}</p>
    </div>

    {/* Causa */}
    <div className="bg-secondary rounded-lg p-2.5 sm:p-3 space-y-1.5">
      <p className="text-xs font-bold text-foreground">Causa</p>
      <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">{incident.cause}</p>
    </div>

    {/* Ação */}
    <div className="bg-secondary rounded-lg p-2.5 sm:p-3 space-y-1.5">
      <p className="text-xs font-bold text-foreground">Ação</p>
      <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">{incident.action}</p>
    </div>

    {/* Impacto */}
    <div className="bg-secondary rounded-lg p-2.5 sm:p-3 space-y-1.5">
      <p className="text-xs font-bold text-foreground">Impacto</p>
      <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">{incident.impact}</p>
    </div>
  </div>
);

const IncidentsSection = ({ incidents }: IncidentsSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!incidents || incidents.length === 0) {
    return null;
  }

  const firstIncident = incidents[0];
  const remainingIncidents = incidents.slice(1);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 sm:p-5 bg-primary-dark">
          <h3 className="text-sm sm:text-base font-semibold text-white">Intercorrências de Obra</h3>
        </div>
        
        {/* Desktop: Always show all */}
        <div className="hidden sm:block divide-y divide-border">
          {incidents.map((incident) => (
            <IncidentItem key={incident.id} incident={incident} />
          ))}
        </div>

        {/* Mobile: Collapsible */}
        <div className="sm:hidden">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="divide-y divide-border">
              {firstIncident && <IncidentItem incident={firstIncident} />}
              
              <CollapsibleContent className="divide-y divide-border overflow-hidden">
                {remainingIncidents.map((incident, index) => (
                  <IncidentItem key={incident.id} incident={incident} animationDelay={isOpen ? (index + 1) * 50 : 0} />
                ))}
              </CollapsibleContent>
            </div>
            
            {remainingIncidents.length > 0 && (
              <CollapsibleTrigger asChild>
                <button className="w-full py-3 px-4 border-t border-border flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                  <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                  {!isOpen && <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-[10px] font-semibold">+{remainingIncidents.length}</span>}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            )}
          </Collapsible>
        </div>
      </div>
    </div>
  );
};

export default IncidentsSection;
