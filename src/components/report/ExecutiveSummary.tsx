import { WeeklyReportData, DeliverableItem } from "@/types/weeklyReport";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ExecutiveSummaryProps {
  data: WeeklyReportData;
}

const ExecutiveSummary = ({ data }: ExecutiveSummaryProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const paragraphs = data.executiveSummary.split('\n\n');
  const firstParagraph = paragraphs[0];
  const remainingParagraphs = paragraphs.slice(1);

  return (
    <div className="space-y-3">
      {/* Summary Text - Collapsible on Mobile */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-primary-dark">
          <h3 className="text-sm sm:text-base font-semibold text-white">Resumo Executivo</h3>
        </div>
        
        {/* Desktop: Always show full content */}
        <div className="hidden sm:block p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-foreground/80 leading-snug text-justify space-y-2">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        {/* Mobile: Collapsible content */}
        <div className="sm:hidden">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="p-3">
              <p className="text-xs text-foreground/80 leading-snug text-justify">
                {firstParagraph}
              </p>
              
              <CollapsibleContent className="overflow-hidden">
                <div className="space-y-2 mt-2">
                  {remainingParagraphs.map((paragraph, index) => (
                    <p 
                      key={index} 
                      className="text-xs text-foreground/80 leading-snug text-justify"
                      style={{
                        animationDelay: `${(index + 1) * 50}ms`,
                        animation: isOpen ? 'fade-in 0.3s ease-out forwards' : undefined,
                        opacity: isOpen ? 0 : 1
                      }}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
            
            {remainingParagraphs.length > 0 && (
              <CollapsibleTrigger asChild>
                <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-[10px] font-medium text-primary hover:bg-primary/5 transition-colors">
                  <span>{isOpen ? "Ver menos" : "Continuar lendo"}</span>
                  {!isOpen && <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-[9px] font-semibold">+{remainingParagraphs.length}</span>}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            )}
          </Collapsible>
        </div>
      </div>

      {/* Deliverables Completed This Week */}
      {data.deliverablesCompleted.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-primary-dark">
            <h3 className="text-sm sm:text-base font-semibold text-white">Entregáveis concluídos na semana</h3>
          </div>
          <div className="p-3 sm:p-4">
            <ul className="space-y-2.5">
              {data.deliverablesCompleted.map((item) => (
                <li key={item.id} className="space-y-1">
                  <div className="flex items-start gap-1.5 text-xs sm:text-sm text-foreground font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success shrink-0 mt-0.5" />
                    <span className="leading-snug">{item.description}</span>
                  </div>
                  {item.subItems && item.subItems.length > 0 && (
                    <ul className="ml-4 sm:ml-5 space-y-0.5 border-l-2 border-border pl-2.5">
                      {item.subItems.map((subItem, subIndex) => (
                        <li 
                          key={subItem.id} 
                          className="text-[10px] sm:text-xs text-foreground/70 leading-snug"
                          style={{ 
                            animationDelay: `${(subIndex + 1) * 30}ms`,
                            animation: 'fade-in 0.3s ease-out forwards',
                            opacity: 0
                          }}
                        >
                          {subItem.description}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummary;
