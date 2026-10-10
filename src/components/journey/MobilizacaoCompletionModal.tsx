import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toLocalISODate } from "@/lib/localDate";
import { format, parseLocalDate } from "@/lib/dates";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  HardHat,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { addBusinessDays } from "@/lib/businessDays";
import {
  useProjectActivities,
  type ProjectActivity,
} from "@/hooks/useProjectActivities";
import { useStartProjectExecution } from "@/hooks/useStartProjectExecution";
import { useCompleteStage } from "@/hooks/useProjectJourney";

interface MobilizacaoCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mantido por compatibilidade: a RPC conclui todas as etapas pendentes. */
  stageId: string;
  projectId: string;
  onSuccess?: () => void;
}

/**
 * Resumo do cronograma para decidir se dá para iniciar a obra. Espelha as
 * regras da RPC `start_project_execution` (a validação de verdade é lá):
 * sem atividades, ou com o modelo de placeholders (todas na mesma data), o
 * cliente não teria o que acompanhar.
 */
function summarizeSchedule(activities: ProjectActivity[]) {
  if (!activities.length) {
    return { count: 0, firstStart: null, isTemplate: false };
  }
  const starts = activities.map((a) => a.planned_start).sort();
  const ends = activities.map((a) => a.planned_end).sort();
  const firstStart = starts[0];
  const lastEnd = ends[ends.length - 1];
  return {
    count: activities.length,
    firstStart,
    isTemplate: activities.length > 1 && firstStart === lastEnd,
  };
}

function formatDateBR(isoDate: string): string {
  return format(parseLocalDate(isoDate), "dd/MM/yyyy");
}

/**
 * "Iniciar obra": tira a obra da fase de projeto NESTA MESMA obra (sem clonar)
 * e libera o cronograma para o cliente. Abre a partir da etapa Mobilização.
 */
export function MobilizacaoCompletionModal({
  open,
  onOpenChange,
  stageId,
  projectId,
  onSuccess,
}: MobilizacaoCompletionModalProps) {
  const { start, isPending } = useStartProjectExecution();
  const completeStage = useCompleteStage();
  const { activities, loading: activitiesLoading } = useProjectActivities(
    open ? projectId : undefined,
  );
  // null = usuário ainda não mexeu na data; vale a sugestão calculada.
  const [customDate, setCustomDate] = useState<string | null>(null);

  useEffect(() => {
    if (open) setCustomDate(null);
  }, [open]);

  const schedule = useMemo(() => summarizeSchedule(activities), [activities]);
  // Sugestão: início da 1ª atividade (o mesmo padrão da RPC); sem cronograma,
  // 5 dias úteis a partir de hoje.
  const suggestedDate =
    schedule.firstStart ?? toLocalISODate(addBusinessDays(new Date(), 5));
  const startDate = customDate ?? suggestedDate;

  const cronogramaPath = `/obra/${projectId}/cronograma`;
  const hasNoSchedule = !activitiesLoading && schedule.count === 0;
  const isTemplateSchedule = !activitiesLoading && schedule.isTemplate;
  const canStart =
    !activitiesLoading && !hasNoSchedule && !isTemplateSchedule && !!startDate;

  const handleConfirm = async () => {
    if (!canStart) return;
    // O hook já mostra o toast de sucesso/erro com a mensagem da RPC.
    const result = await start(projectId, startDate);
    if (!result) return;
    // Obra já iniciada por outro caminho (contexto desatualizado): a RPC não
    // mexe nas etapas, então a Mobilização é concluída aqui mesmo.
    if (result.already_in_execution) {
      await completeStage.mutateAsync({ stageId, projectId });
    }
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            Iniciar obra
          </DialogTitle>
          <DialogDescription>
            A obra sai da fase de projeto aqui mesmo, nesta obra: nenhuma obra
            nova é criada. As etapas pendentes da jornada são concluídas e o
            cliente passa a acompanhar o cronograma no portal.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-4 py-2">
          {activitiesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando o cronograma...
            </div>
          ) : hasNoSchedule || isTemplateSchedule ? (
            <div
              role="alert"
              className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2"
            >
              <p className="flex items-start gap-1.5 text-sm font-medium text-foreground">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                {hasNoSchedule
                  ? "Cadastre o cronograma antes de iniciar a obra"
                  : "O cronograma ainda é o modelo (todas as atividades na mesma data)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasNoSchedule
                  ? "Sem cronograma o cliente não tem o que acompanhar."
                  : "Preencha as datas reais das atividades antes de iniciar a obra."}
              </p>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="min-h-[44px] gap-1.5"
              >
                <Link to={cronogramaPath} onClick={() => onOpenChange(false)}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  Abrir cronograma
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm text-foreground">
                Cronograma com {schedule.count}{" "}
                {schedule.count === 1 ? "atividade" : "atividades"}
                {schedule.firstStart
                  ? `, começando em ${formatDateBR(schedule.firstStart)}`
                  : ""}
                .
              </p>
            </div>
          )}

          {/* Data de início */}
          <div className="space-y-2">
            <Label
              htmlFor="mob-start-date"
              className="flex items-center gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Data de início da obra
            </Label>
            <Input
              id="mob-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setCustomDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {schedule.firstStart
                ? "Sugestão: início da primeira atividade do cronograma."
                : "Sugestão: 5 dias úteis a partir de hoje."}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="min-h-[44px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !canStart}
            className="min-h-[44px] gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Iniciando obra...
              </>
            ) : (
              <>Iniciar obra</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
