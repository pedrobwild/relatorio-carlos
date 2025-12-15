import { LookaheadTask } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface LookaheadSectionProps {
  tasks: LookaheadTask[];
}

const getRiskBadge = (risk: LookaheadTask["risk"]) => {
  switch (risk) {
    case "baixo":
      return null; // Don't show badge for low risk
    case "médio":
      return <Badge variant="outline" className="bg-warning/10 text-foreground border-warning/20 text-xs">Risco Mapeado</Badge>;
    case "alto":
      return <Badge variant="outline" className="bg-destructive/10 text-foreground border-destructive/20 text-xs">Risco Mapeado</Badge>;
  }
};

const TaskItem = ({ task, animationDelay = 0 }: { task: LookaheadTask; animationDelay?: number }) => (
  <div 
    className="p-4 sm:p-5 space-y-2"
    style={{ 
      animationDelay: `${animationDelay}ms`,
      animation: animationDelay > 0 ? 'fade-in 0.3s ease-out forwards' : undefined,
      opacity: animationDelay > 0 ? 0 : 1
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-foreground bg-primary/10 px-2 py-0.5 rounded">
            {format(new Date(task.date), "dd/MM", { locale: ptBR })}
          </span>
          {getRiskBadge(task.risk)}
        </div>
        <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">{task.description}</p>
      </div>
    </div>
    
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-x-3 sm:gap-y-1 text-xs text-foreground/70">
      <div className="flex items-start gap-1.5">
        <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" />
        <span><span className="font-medium">Pré-requisito:</span> {task.prerequisites}</span>
      </div>
    </div>
    
    {task.riskReason && (
      <div className="flex items-start gap-2 text-xs bg-warning/10 p-2.5 rounded-lg">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning" />
        <span className="leading-relaxed text-foreground">{task.riskReason}</span>
      </div>
    )}
  </div>
);

const LookaheadSection = ({ tasks }: LookaheadSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const firstTask = tasks[0];
  const remainingTasks = tasks.slice(1);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 sm:p-5 bg-primary-dark">
        <h3 className="text-sm sm:text-base font-semibold text-white">Plano da Próxima Semana</h3>
      </div>
      
      {/* Desktop: Always show all tasks */}
      <div className="hidden sm:block divide-y divide-border">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>

      {/* Mobile: Collapsible content */}
      <div className="sm:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="divide-y divide-border">
            {firstTask && <TaskItem task={firstTask} />}
            
            <CollapsibleContent className="divide-y divide-border overflow-hidden">
              {remainingTasks.map((task, index) => (
                <TaskItem key={task.id} task={task} animationDelay={isOpen ? (index + 1) * 50 : 0} />
              ))}
            </CollapsibleContent>
          </div>
          
          {remainingTasks.length > 0 && (
            <CollapsibleTrigger asChild>
              <button className="w-full py-3 px-4 border-t border-border flex items-center justify-center gap-2 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                {!isOpen && <span className="bg-primary/10 px-1.5 py-0.5 rounded text-[10px] font-semibold">+{remainingTasks.length}</span>}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
          )}
        </Collapsible>
      </div>
    </div>
  );
};

export default LookaheadSection;
