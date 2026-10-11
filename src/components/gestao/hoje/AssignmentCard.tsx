/**
 * Card de uma alocação do dia. Feito com um toque; Não feito abre a gaveta
 * de motivo. Botões grandes (48 px) porque é usado em pé, na obra, no celular.
 */
import { AlertTriangle, Check, Flame, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OPS_REASON_LABEL } from "@/lib/opsLabels";
import { doneAtLabel } from "@/lib/hojeDia";
import type { OpsDayAssignment } from "@/infra/repositories/ops.repository";
import { AssignmentPhotos } from "./AssignmentPhotos";

interface Props {
  assignment: OpsDayAssignment;
  who: string;
  doneByName?: string | null;
  materialsMissing?: number;
  canConfirm: boolean;
  busy?: boolean;
  onDone: () => void;
  onNotDone: () => void;
  onUndo: () => void;
}

export function AssignmentCard({
  assignment: a,
  who,
  doneByName,
  materialsMissing = 0,
  canConfirm,
  busy,
  onDone,
  onNotDone,
  onUndo,
}: Props) {
  const title = a.activity?.title ?? "Atividade";
  const stage = a.activity?.stage?.description ?? "Sem etapa";
  const at = doneAtLabel(a.done_at);
  const state = a.outcome ?? "pendente";

  return (
    <article
      aria-label={title}
      data-state={state}
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm transition-colors",
        state === "feito" && "border-success/40 bg-success/5",
        state === "nao_feito" && "border-warning/50 bg-warning/5",
        state === "pendente" && "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {a.activity?.is_critical && (
          <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
            <Flame className="h-3 w-3" aria-hidden="true" />
            Crítica
          </Badge>
        )}
        <span className="truncate">{stage}</span>
      </div>

      <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">{title}</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">{who}</p>

      {materialsMissing > 0 && state === "pendente" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {materialsMissing === 1 ? "Falta 1 material na obra" : `Faltam ${materialsMissing} materiais na obra`}
        </p>
      )}

      {state === "pendente" ? (
        canConfirm ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              className="min-h-[48px] bg-success text-success-foreground hover:bg-success/90"
              disabled={busy}
              onClick={onDone}
              aria-label={`Marcar como feito: ${title}`}
            >
              <Check className="h-5 w-5" aria-hidden="true" />
              Feito
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[48px]"
              disabled={busy}
              onClick={onNotDone}
              aria-label={`Marcar como não feito: ${title}`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
              Não feito
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Planejado. A confirmação abre no dia.</p>
        )
      ) : (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("text-sm font-medium", state === "feito" ? "text-success" : "text-warning")}>
              {state === "feito" ? (
                <>
                  Feito{at ? ` às ${at}` : ""}
                  {doneByName ? ` · ${doneByName}` : ""}
                </>
              ) : (
                <>
                  Não feito
                  {a.not_done_reason ? ` · ${OPS_REASON_LABEL[a.not_done_reason]}` : ""}
                </>
              )}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[40px] shrink-0 px-2 text-muted-foreground"
              disabled={busy}
              onClick={onUndo}
              aria-label={`Desfazer confirmação: ${title}`}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Desfazer
            </Button>
          </div>
          {a.notes && <p className="text-sm text-foreground/80">{a.notes}</p>}
          <AssignmentPhotos assignment={a} />
        </div>
      )}
    </article>
  );
}
