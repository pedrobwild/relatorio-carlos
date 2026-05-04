import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { journeyCopy } from "@/constants/journeyCopy";
import { useCreateStageDate } from "@/hooks/useStageDates";

const ORDINALS = [
  "primeira",
  "segunda",
  "terceira",
  "quarta",
  "quinta",
  "sexta",
  "sétima",
  "oitava",
  "nona",
  "décima",
];

function getNextDeliveryTitle(existingCount: number): string {
  const ordinal = ORDINALS[existingCount] || `${existingCount + 1}ª`;
  return `Entrega da ${ordinal} versão`;
}

interface CreateStageDateFormProps {
  projectId: string;
  stageKey: string;
  existingCount: number;
  onClose: () => void;
}

export function CreateStageDateForm({
  projectId,
  stageKey,
  existingCount,
  onClose,
}: CreateStageDateFormProps) {
  const autoTitle = getNextDeliveryTitle(existingCount);
  const create = useCreateStageDate(projectId);

  return (
    <div
      className="p-4 rounded-xl border border-dashed border-primary/30 bg-accent/30 space-y-3"
      role="form"
      aria-label="Novo prazo de entrega"
    >
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Plus className="h-3.5 w-3.5 text-primary" aria-hidden />
        Novo prazo de entrega
      </p>
      <div className="px-3 py-2 rounded-md bg-muted/40 border border-border/50">
        <p className="text-xs text-muted-foreground">Título automático:</p>
        <p className="text-sm font-medium text-foreground">{autoTitle}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-11 gap-1.5 min-w-[44px]"
          disabled={create.isPending}
          onClick={() => {
            create.mutate(
              {
                stage_key: stageKey,
                date_type: "end_planned",
                title: autoTitle,
              },
              {
                onSuccess: () => onClose(),
                onError: () => toast.error(journeyCopy.errors.create_date),
              },
            );
          }}
        >
          {create.isPending ? (
            <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
          Criar prazo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 min-w-[44px]"
          onClick={onClose}
        >
          {journeyCopy.dates.create.cancel}
        </Button>
      </div>
    </div>
  );
}
