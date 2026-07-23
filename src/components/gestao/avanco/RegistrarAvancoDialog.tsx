/**
 * RegistrarAvancoDialog — dialog compacto (staff) para registrar uma
 * medição de avanço físico de uma atividade específica.
 *
 * Usado no LookaheadRow e em qualquer outra superfície staff que precise
 * lançar % parcial de conclusão da atividade.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMeasurement } from "@/hooks/useActivityProgress";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string;
  projectId: string;
  activityDescription: string;
  currentProgress?: number | null;
}

export function RegistrarAvancoDialog({
  open,
  onOpenChange,
  activityId,
  projectId,
  activityDescription,
  currentProgress,
}: Props) {
  const [pct, setPct] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [date, setDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const create = useCreateMeasurement();

  useEffect(() => {
    if (open) {
      setPct(
        currentProgress != null && Number.isFinite(currentProgress)
          ? String(currentProgress)
          : "",
      );
      setNotes("");
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, currentProgress]);

  const numericPct = Number(pct);
  const isValid =
    pct.trim() !== "" &&
    Number.isFinite(numericPct) &&
    numericPct >= 0 &&
    numericPct <= 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    await create.mutateAsync({
      activity_id: activityId,
      project_id: projectId,
      progress_pct: numericPct,
      measured_on: date,
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Registrar avanço físico</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {activityDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pct">Percentual concluído (%)</Label>
            <Input
              id="pct"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.1"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="0–100"
              autoFocus
              required
              className="h-11 text-base"
            />
            {pct.trim() !== "" && !isValid && (
              <p className="text-xs text-destructive">
                Informe um valor entre 0 e 100.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data da medição</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observação (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto rápido: quem mediu, onde parou, impedimentos…"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
              className="h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isValid || create.isPending}
              className="h-11 gap-2"
            >
              {create.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
