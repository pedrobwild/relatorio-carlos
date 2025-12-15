import { RiskIssue } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    className="p-4 sm:p-5 space-y-2.5"
    style={{ 
      animationDelay: `${animationDelay}ms`,
      animation: animationDelay > 0 ? 'fade-in 0.3s ease-out forwards' : undefined,
      opacity: animationDelay > 0 ? 0 : 1
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">{issue.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 mt-1.5 ml-5.5">
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
            {format(new Date(issue.dueDate), "dd/MM", { locale: ptBR })}
          </span>
        </div>
      </div>
    </div>
    
    <div className="bg-secondary rounded-lg p-2.5 sm:p-3">
      <p className="text-xs font-bold text-foreground mb-1">Plano de Ação</p>
      <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-1">
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
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 sm:p-5 border-b border-border">
          <h3 className="text-sm sm:text-base font-semibold text-foreground">Gestão de Riscos</h3>
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
                <button className="w-full py-3 px-4 border-t border-border flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                  <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                  {!isOpen && <span className="bg-primary/10 px-1.5 py-0.5 rounded text-[10px] font-semibold">+{remainingIssues.length}</span>}
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

export default RisksIssuesSection;
