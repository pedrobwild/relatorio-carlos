import { RiskIssue } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface RisksIssuesSectionProps {
  issues: RiskIssue[];
}

const RiskItem = ({ issue, animationDelay = 0 }: { issue: RiskIssue; animationDelay?: number }) => (
  <div 
    className="p-2.5 sm:p-3 space-y-2"
    style={{ 
      animationDelay: `${animationDelay}ms`,
      animation: animationDelay > 0 ? 'fade-in 0.3s ease-out forwards' : undefined,
      opacity: animationDelay > 0 ? 0 : 1
    }}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">{issue.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 ml-5">
          <span className="text-[10px] font-semibold text-foreground bg-primary/10 px-1.5 py-0.5 rounded">
            {format(new Date(issue.dueDate), "dd/MM", { locale: ptBR })}
          </span>
        </div>
      </div>
    </div>
    
    <div className="bg-secondary rounded-lg p-2 space-y-1">
      <p className="text-xs font-bold text-foreground">Plano de Ação</p>
      <div className="text-xs text-foreground/80 leading-snug space-y-0.5">
        {issue.actionPlan.split('\n').map((line, idx) => (
          <p key={idx}>{idx + 1}) {line.trim()}</p>
        ))}
      </div>
    </div>
  </div>
);

const RisksIssuesSection = ({ issues }: RisksIssuesSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const firstIssue = issues[0];
  const remainingIssues = issues.slice(1);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-primary-dark">
        <h3 className="text-sm sm:text-base font-semibold text-white">Gestão de Riscos</h3>
      </div>
      
      {/* Desktop: Always show all */}
      <div className="hidden sm:block divide-y divide-border">
        {issues.map((issue) => (
          <RiskItem key={issue.id} issue={issue} />
        ))}
      </div>

      {/* Mobile: Collapsible */}
      <div className="sm:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="divide-y divide-border">
            {firstIssue && <RiskItem issue={firstIssue} />}
            
            <CollapsibleContent className="divide-y divide-border overflow-hidden">
              {remainingIssues.map((issue, index) => (
                <RiskItem key={issue.id} issue={issue} animationDelay={isOpen ? (index + 1) * 50 : 0} />
              ))}
            </CollapsibleContent>
          </div>
          
          {remainingIssues.length > 0 && (
            <CollapsibleTrigger asChild>
              <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-[10px] font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                {!isOpen && <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-[9px] font-semibold">+{remainingIssues.length}</span>}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </div>
    </div>
  );
};

export default RisksIssuesSection;
