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
      return null;
    case "médio":
      return (
        <Badge
          variant="outline"
          className="bg-warning/10 text-foreground border-warning/20 text-[10px]"
        >
          Risco Mapeado
        </Badge>
      );
    case "alto":
      return (
        <Badge
          variant="outline"
          className="bg-destructive/10 text-foreground border-destructive/20 text-[10px]"
        >
          Risco Mapeado
        </Badge>
      );
  }
};

const getActionVerb = (description: string) => {
  const lower = description.toLowerCase().trim();
  const startsWithVerb =
    /^(finalizar|iniciar|concluir|instalar|aguardar|preparar|revisar|aprovar|executar|realizar|entregar|montar|pintar|aplicar|testar|verificar)/i.test(
      lower,
    );
  if (startsWithVerb) return description;
  return description;
};

const TaskItem = ({
  task,
  animationDelay = 0,
}: {
  task: LookaheadTask;
  animationDelay?: number;
}) => (
  <div
    className="px-5 py-3 sm:px-6 sm:py-4 space-y-2"
    style={{
      animationDelay: `${animationDelay}ms`,
      animation:
        animationDelay > 0 ? "fade-in 0.3s ease-out forwards" : undefined,
      opacity: animationDelay > 0 ? 0 : 1,
    }}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold text-foreground bg-primary/10 px-1.5 py-0.5 rounded">
            {(() => {
              try {
                const d = new Date(task.date);
                return isNaN(d.getTime())
                  ? task.date
                  : format(d, "EEEE, dd/MM", { locale: ptBR });
              } catch {
                return task.date;
              }
            })()}
          </span>
          {getRiskBadge(task.risk)}
        </div>
        <p className="text-sm font-medium text-foreground leading-[1.6]">
          {getActionVerb(task.description)}
        </p>
        {task.responsible && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Responsável:{" "}
            <span className="font-medium text-foreground/80">
              {task.responsible}
            </span>
          </p>
        )}
      </div>
    </div>

    {task.prerequisites && (
      <div className="flex items-start gap-1.5 text-sm text-foreground/75">
        <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span className="leading-[1.6]">
          <span className="font-medium text-foreground/90">Depende de:</span>{" "}
          {task.prerequisites}
        </span>
      </div>
    )}

    {task.riskReason && (
      <div className="flex items-start gap-1.5 text-xs bg-warning/10 p-2.5 rounded-lg">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning" />
        <span className="leading-[1.5] text-foreground">{task.riskReason}</span>
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
      <div className="px-4 py-2.5 bg-primary-dark">
        <h3 className="text-base font-semibold text-white tracking-tight">
          Na próxima semana vamos focar em:
        </h3>
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
                <TaskItem
                  key={task.id}
                  task={task}
                  animationDelay={isOpen ? (index + 1) * 50 : 0}
                />
              ))}
            </CollapsibleContent>
          </div>

          {remainingTasks.length > 0 && (
            <CollapsibleTrigger asChild>
              <button className="w-full py-2 px-3 border-t border-border flex items-center justify-center gap-1.5 text-tiny font-medium text-primary hover:bg-primary/5 transition-colors">
                <span>{isOpen ? "Ver menos" : "Ver mais"}</span>
                {!isOpen && (
                  <span className="bg-primary/10 px-1.5 py-0.5 rounded-md text-tiny font-semibold">
                    +{remainingTasks.length}
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

export default LookaheadSection;
