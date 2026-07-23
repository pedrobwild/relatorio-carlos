/**
 * CriarBaselineDialog — cria um snapshot congelado do cronograma atual.
 * Se `makeCurrent` estiver marcado e já existir baseline atual, exibe
 * AlertDialog de confirmação antes de substituir.
 * Staff-only (parent controla escopo).
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCreateBaseline,
  useCurrentBaseline,
} from "@/hooks/useActivityProgress";

interface CriarBaselineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function CriarBaselineDialog({
  open,
  onOpenChange,
  projectId,
}: CriarBaselineDialogProps) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const { data: current } = useCurrentBaseline(projectId);
  const createMutation = useCreateBaseline();

  const reset = () => {
    setName("");
    setNotes("");
    setMakeCurrent(true);
    setConfirmReplace(false);
  };

  const submit = async () => {
    await createMutation.mutateAsync({
      project_id: projectId,
      name: name.trim(),
      notes: notes.trim() || null,
      makeCurrent,
    });
    reset();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (makeCurrent && current) {
      setConfirmReplace(true);
      return;
    }
    void submit();
  };

  const canSubmit = name.trim().length > 0 && !createMutation.isPending;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) reset();
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar baseline do cronograma</DialogTitle>
            <DialogDescription>
              Congela as atividades atuais como referência histórica para a
              curva S. Você pode ter várias baselines, mas apenas uma marcada
              como atual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="baseline-name">Nome</Label>
              <Input
                id="baseline-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Baseline aprovada em Jan/26"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="baseline-notes">Observações (opcional)</Label>
              <Textarea
                id="baseline-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Contexto da aprovação, versão do cronograma etc."
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={makeCurrent}
                onCheckedChange={(v) => setMakeCurrent(v === true)}
                className="mt-0.5"
              />
              <span className="leading-tight">
                Marcar como baseline atual
                <span className="block text-xs text-muted-foreground">
                  A curva S usa a baseline atual por padrão.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={!canSubmit}>
              {createMutation.isPending ? "Criando…" : "Criar baseline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir baseline atual?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe uma baseline atual (
              <strong>{current?.name}</strong>). A anterior será preservada no
              histórico, mas deixará de ser a referência da curva S.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmReplace(false);
                void submit();
              }}
            >
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
