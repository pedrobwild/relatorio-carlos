import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ListChecks } from "lucide-react";
import { StageChecklist } from "../StageChecklist";
import type { JourneyTodo } from "@/hooks/useProjectJourney";

interface ClientNextActionsCardProps {
  todos: JourneyTodo[];
  projectId: string;
  stageId: string;
  isAdmin: boolean;
}

export function ClientNextActionsCard({
  todos,
  projectId,
  stageId,
  isAdmin,
}: ClientNextActionsCardProps) {
  const clientTodos = todos.filter((t) => t.owner === "client");
  const allDone =
    clientTodos.length > 0 && clientTodos.every((t) => t.completed);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center mt-0.5">
            <ListChecks className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              O que você precisa fazer agora
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conclua estas ações para a reunião acontecer sem atrasos.
            </p>
          </div>
        </div>

        {clientTodos.length === 0 || allDone ? (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--success)/0.06)] border border-[hsl(var(--success)/0.15)] px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />
            <span className="text-sm text-[hsl(var(--success))] font-medium">
              Sem pendências nesta etapa. Acompanhe a confirmação da reunião
              abaixo.
            </span>
          </div>
        ) : (
          <StageChecklist
            todos={todos}
            owner="client"
            label="✔️ Suas pendências"
            projectId={projectId}
            stageId={stageId}
            isAdmin={isAdmin}
          />
        )}
      </CardContent>
    </Card>
  );
}
