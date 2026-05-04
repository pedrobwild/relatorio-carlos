import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CompleteStageButtonProps {
  stageName: string;
  stageId: string;
  projectId: string;
  nextStageName?: string | null;
  isPending: boolean;
  onComplete: (
    opts: { stageId: string; projectId: string },
    callbacks?: { onSuccess?: () => void },
  ) => void;
  onSuccess?: () => void;
}

export function CompleteStageButton({
  stageName,
  stageId,
  projectId,
  nextStageName,
  isPending,
  onComplete,
  onSuccess,
}: CompleteStageButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          className="h-12 sm:h-10 gap-1.5 text-xs min-h-[44px] w-full sm:w-auto sm:ml-auto"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Concluir etapa
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Concluir "{stageName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            A data de conclusão será registrada e a próxima etapa
            {nextStageName ? ` ("${nextStageName}")` : ""} será liberada
            automaticamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-[44px]">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-[44px]"
            onClick={() => onComplete({ stageId, projectId }, { onSuccess })}
          >
            Sim, concluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CompletedBadge() {
  return (
    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-[hsl(var(--success))] font-medium sm:ml-auto py-2">
      <CheckCircle2 className="h-4 w-4" />
      Etapa concluída
    </div>
  );
}
