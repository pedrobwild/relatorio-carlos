/**
 * Gaveta "Não feito": motivo (lista fixa, obrigatório) + observação opcional.
 * Dois toques: escolhe o motivo e confirma.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { OPS_REASON_LABEL } from "@/lib/opsLabels";
import type { OpsBlockReason } from "@/infra/repositories/ops.repository";

const REASONS = Object.keys(OPS_REASON_LABEL) as OpsBlockReason[];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityTitle: string;
  saving?: boolean;
  onConfirm: (reason: OpsBlockReason, notes: string | null) => void;
}

export function NaoFeitoSheet({ open, onOpenChange, activityTitle, saving, onConfirm }: Props) {
  const [reason, setReason] = useState<OpsBlockReason | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setReason(null);
      setNotes("");
    }
  }, [open]);

  const needsNotes = reason === "outro";
  const canConfirm = !!reason && (!needsNotes || notes.trim().length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto w-full max-w-lg rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Por que não foi feito?</SheetTitle>
          <SheetDescription className="line-clamp-2">{activityTitle}</SheetDescription>
        </SheetHeader>

        <div role="radiogroup" aria-label="Motivo" className="mt-4 grid grid-cols-2 gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "min-h-[48px] rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                reason === r
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {OPS_REASON_LABEL[r]}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="nao-feito-notes">
            Observação {needsNotes ? "(obrigatória)" : "(opcional)"}
          </Label>
          <Textarea
            id="nao-feito-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: argamassa chega amanhã às 8h"
            rows={2}
          />
        </div>

        <SheetFooter className="mt-5 flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] flex-1 sm:flex-none"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-[48px] flex-1 sm:flex-none"
            disabled={!canConfirm || saving}
            onClick={() => reason && onConfirm(reason, notes.trim() || null)}
          >
            Confirmar não feito
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
