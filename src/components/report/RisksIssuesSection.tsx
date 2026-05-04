import { RiskIssue } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  MessageCircleQuestion,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface RisksIssuesSectionProps {
  issues: RiskIssue[];
  isStaff?: boolean;
  onResolve?: (issueId: string) => void;
  onClarify?: (issueId: string) => void;
}

const RiskItem = ({
  issue,
  isStaff,
  onResolve,
  onClarify,
  animationDelay = 0,
}: {
  issue: RiskIssue;
  isStaff?: boolean;
  onResolve?: (id: string) => void;
  onClarify?: (id: string) => void;
  animationDelay?: number;
}) => (
  <div
    className="px-5 py-3 sm:px-6 sm:py-4 space-y-2.5"
    style={{
      animationDelay: `${animationDelay}ms`,
      animation:
        animationDelay > 0 ? "fade-in 0.3s ease-out forwards" : undefined,
      opacity: animationDelay > 0 ? 0 : 1,
    }}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-foreground leading-[1.6]">
            {issue.title}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 ml-5">
          <span className="text-xs font-semibold text-foreground bg-primary/10 px-1.5 py-0.5 rounded">
            {format(new Date(issue.dueDate), "dd/MM", { locale: ptBR })}
          </span>
        </div>
      </div>
    </div>

    {issue.actionPlan && issue.actionPlan.trim().length > 0 && (
      <div className="bg-secondary rounded-lg p-3 space-y-1.5">
        <p className="text-xs font-bold text-foreground uppercase tracking-wide">
          Plano de Ação
        </p>
        <div className="text-sm text-foreground/80 leading-[1.6] space-y-1">
          {issue.actionPlan
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map((line, idx) => (
              <p key={idx}>
                {idx + 1}) {line.trim()}
              </p>
            ))}
        </div>
      </div>
    )}

    {/* Action buttons */}
    <div className="flex items-center gap-2 ml-5">
      {isStaff && onResolve && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-[hsl(var(--success))] hover:text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/10 gap-1.5"
          onClick={() => onResolve(issue.id)}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Já resolvido
        </Button>
      )}
      {!isStaff && onClarify && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-primary hover:bg-primary/10 gap-1.5"
          onClick={() => onClarify(issue.id)}
        >
          <MessageCircleQuestion className="w-3.5 h-3.5" />
          Preciso de esclarecimento
        </Button>
      )}
    </div>
  </div>
);

const RisksIssuesSection = ({
  issues,
  isStaff,
  onResolve,
  onClarify,
}: RisksIssuesSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Desktop: show first 3, collapsible for rest
  const visibleDesktop = issues.slice(0, 3);
  const hiddenDesktop = issues.slice(3);
  const [showAllDesktop, setShowAllDesktop] = useState(false);

  const firstIssue = issues[0];
  const remainingIssues = issues.slice(1);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-primary-dark">
        <h3 className="text-base font-semibold text-white tracking-tight">
          Gestão de Riscos
        </h3>
      </div>

      {/* Desktop: Show first 3, collapsible for rest */}
      <div className="hidden sm:block">
        <div className="divide-y divide-border">
          {visibleDesktop.map((issue) => (
            <RiskItem
              key={issue.id}
              issue={issue}
              isStaff={isStaff}
              onResolve={onResolve}
              onClarify={onClarify}
            />
          ))}
        </div>
        {hiddenDesktop.length > 0 && (
          <Collapsible open={showAllDesktop} onOpenChange={setShowAllDesktop}>
            <CollapsibleContent className="divide-y divide-border overflow-hidden">
              {hiddenDesktop.map((issue, index) => (
                <RiskItem
                  key={issue.id}
                  issue={issue}
                  isStaff={isStaff}
                  onResolve={onResolve}
                  onClarify={onClarify}
                  animationDelay={showAllDesktop ? (index + 1) * 50 : 0}
                />
              ))}
            </CollapsibleContent>
            <CollapsibleTrigger asChild>
              <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-tiny font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>
                  {showAllDesktop
                    ? "Ver menos"
                    : `Ver todos ${issues.length} itens`}
                </span>
                {!showAllDesktop && (
                  <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-tiny font-semibold">
                    +{hiddenDesktop.length}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform duration-200",
                    showAllDesktop && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </div>

      {/* Mobile: Collapsible */}
      <div className="sm:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="divide-y divide-border">
            {firstIssue && (
              <RiskItem
                issue={firstIssue}
                isStaff={isStaff}
                onResolve={onResolve}
                onClarify={onClarify}
              />
            )}

            <CollapsibleContent className="divide-y divide-border overflow-hidden">
              {remainingIssues.map((issue, index) => (
                <RiskItem
                  key={issue.id}
                  issue={issue}
                  isStaff={isStaff}
                  onResolve={onResolve}
                  onClarify={onClarify}
                  animationDelay={isOpen ? (index + 1) * 50 : 0}
                />
              ))}
            </CollapsibleContent>
          </div>

          {remainingIssues.length > 0 && (
            <CollapsibleTrigger asChild>
              <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-tiny font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                {!isOpen && (
                  <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-tiny font-semibold">
                    +{remainingIssues.length}
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

export default RisksIssuesSection;
