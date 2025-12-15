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
    <div className="space-y-4">
      {/* Summary Text - Collapsible on Mobile */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 sm:p-5 bg-primary-dark">
          <h3 className="text-sm sm:text-base font-semibold text-white">Resumo Executivo</h3>
        </div>
        
        {/* Desktop: Always show full content */}
        <div className="hidden sm:block p-4 sm:p-5">
          <div className="text-sm sm:text-base text-foreground/80 leading-relaxed text-justify space-y-3">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        {/* Mobile: Collapsible content */}
        <div className="sm:hidden">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="p-4">
              <p className="text-sm text-foreground/80 leading-relaxed text-justify">
                {firstParagraph}
              </p>
              
              <CollapsibleContent className="overflow-hidden">
                <div className="space-y-3 mt-3">
                  {remainingParagraphs.map((paragraph, index) => (
                    <p 
                      key={index} 
                      className="text-sm text-foreground/80 leading-relaxed text-justify"
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
                <button className="w-full py-3 px-4 border-t border-border flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                  <span>{isOpen ? "Ver menos" : "Continuar lendo"}</span>
                  {!isOpen && <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-[10px] font-semibold">+{remainingParagraphs.length}</span>}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            )}
          </Collapsible>
        </div>
      </div>

      {/* Deliverables Completed This Week */}
      {data.deliverablesCompleted.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-4 sm:p-5 bg-primary-dark">
            <h3 className="text-sm sm:text-base font-semibold text-white">Entregáveis concluídos na semana</h3>
          </div>
          <div className="p-4 sm:p-5">
            <ul className="space-y-3">
              {data.deliverablesCompleted.map((item) => (
                <li key={item.id} className="space-y-1.5">
                  <div className="flex items-start gap-2 text-sm sm:text-base text-foreground font-medium">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item.description}</span>
                  </div>
                  {item.subItems && item.subItems.length > 0 && (
                    <ul className="ml-5 sm:ml-6 space-y-1 border-l-2 border-border pl-3">
                      {item.subItems.map((subItem, subIndex) => (
                        <li 
                          key={subItem.id} 
                          className="text-xs sm:text-sm text-foreground/70 leading-relaxed"
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
