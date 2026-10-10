import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CalendarDays, HardHat, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCan } from "@/hooks/useCan";
import {
  useProjectActivities,
  type ProjectActivity,
} from "@/hooks/useProjectActivities";
import { useStartProjectExecution } from "@/hooks/useStartProjectExecution";
import type { JourneyStage } from "@/hooks/useProjectJourney";

interface Props {
  projectId: string;
  isProjectPhase: boolean;
  stages: JourneyStage[];
}

const dismissKey = (id: string) => `phase_banner_dismissed_${id}`;

// "Lembrar depois" vale só para a sessão: o banner existe justamente para a
// obra não ficar esquecida na fase de projeto (cliente sem ver o cronograma).
function readDismissed(projectId: string): boolean {
  try {
    return sessionStorage.getItem(dismissKey(projectId)) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(projectId: string) {
  try {
    sessionStorage.setItem(dismissKey(projectId), "1");
  } catch {
    // Sem storage (aba anônima/bloqueada): fica dispensado só neste render.
  }
}

/**
 * Cronograma "de verdade": ao menos uma atividade e não só o modelo de
 * placeholders (todas na mesma data), que a RPC `start_project_execution`
 * recusa.
 */
function hasRealSchedule(activities: ProjectActivity[]): boolean {
  if (!activities.length) return false;
  if (activities.length === 1) return true;
  const starts = activities.map((a) => a.planned_start).sort();
  const ends = activities.map((a) => a.planned_end).sort();
  return starts[0] !== ends[ends.length - 1];
}

const isExecutivoStage = (stage: JourneyStage) =>
  stage.name.toLowerCase().includes("projeto executivo");

/**
 * Banner da equipe para tirar a obra da fase de projeto: enquanto
 * `is_project_phase = true` o cliente fica preso na Jornada e não vê o
 * cronograma. Aparece quando já há cronograma cadastrado (inicia a obra na
 * hora) ou quando o Projeto Executivo foi concluído (lembra de cadastrar o
 * cronograma). Cliente nunca vê.
 */
export function ProjectPhaseCompletionBanner({
  projectId,
  isProjectPhase,
  stages,
}: Props) {
  const { can } = useCan();
  const canStart = can("journey:edit_stages");
  const enabled = canStart && isProjectPhase;
  // Só busca atividades quando o banner pode aparecer (nada para o cliente).
  const { activities, loading } = useProjectActivities(
    enabled ? projectId : undefined,
  );
  const { start, isPending } = useStartProjectExecution();
  const [dismissed, setDismissed] = useState(() => readDismissed(projectId));

  if (!enabled || dismissed || loading) return null;

  const scheduleReady = hasRealSchedule(activities);
  const executivoDone = stages.some(
    (s) => isExecutivoStage(s) && s.status === "completed",
  );
  if (!scheduleReady && !executivoDone) return null;

  const handleStart = async () => {
    // Sem data: a RPC usa o início da primeira atividade. Toasts ficam no hook.
    await start(projectId, null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    writeDismissed(projectId);
  };

  return (
    <Alert className="mb-4 border-warning/30 bg-warning/10 [&>svg]:text-warning">
      {scheduleReady ? (
        <HardHat className="h-4 w-4" />
      ) : (
        <CalendarClock className="h-4 w-4" />
      )}
      <AlertTitle>
        {scheduleReady
          ? "O cliente ainda não vê o cronograma"
          : "Projeto Executivo concluído"}
      </AlertTitle>
      <AlertDescription className="mt-1 space-y-3">
        <p className="text-sm text-muted-foreground">
          {scheduleReady
            ? "O cronograma já está cadastrado, mas o cliente ainda não vê: a obra está em fase de projeto."
            : "Quando a obra começar, cadastre o cronograma e inicie a obra para o cliente acompanhar."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {scheduleReady ? (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <HardHat className="h-3.5 w-3.5" />
              )}
              Iniciar obra e liberar cronograma
            </Button>
          ) : (
            <Button size="sm" asChild className="gap-1.5">
              <Link to={`/obra/${projectId}/cronograma`}>
                <CalendarDays className="h-3.5 w-3.5" />
                Cadastrar cronograma
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            disabled={isPending}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Lembrar depois
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
