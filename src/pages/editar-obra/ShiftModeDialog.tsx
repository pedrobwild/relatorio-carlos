import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import type { ShiftMode } from '@/lib/shiftActivityDates';

interface ShiftModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startChanged: boolean;
  endChanged: boolean;
  activityCount: number;
  onConfirm: (mode: ShiftMode | null) => void;
}

export function ShiftModeDialog({
  open,
  onOpenChange,
  startChanged,
  endChanged,
  activityCount,
  onConfirm,
}: ShiftModeDialogProps) {
  const [mode, setMode] = useState<ShiftMode>('proportional');

  const handleConfirm = (chosen: ShiftMode | null) => {
    onOpenChange(false);
    onConfirm(chosen);
  };

  // If only the start changed, both modes produce the same result. Suggest preserve-duration.
  const onlyStart = startChanged && !endChanged;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recalcular cronograma?</AlertDialogTitle>
          <AlertDialogDescription>
            Você alterou as datas planejadas do projeto. Como deseja atualizar as {activityCount} atividade(s) do cronograma?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as ShiftMode)} className="space-y-3 py-2">
          <div className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer" onClick={() => setMode('preserve-duration')}>
            <RadioGroupItem value="preserve-duration" id="preserve" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="preserve" className="cursor-pointer font-medium">
                Manter duração de cada atividade
              </Label>
              <p className="text-tiny text-muted-foreground mt-1">
                Desloca todas as atividades a partir do novo início. Cada atividade conserva sua duração original. O novo término do projeto é ignorado.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer" onClick={() => setMode('proportional')}>
            <RadioGroupItem value="proportional" id="proportional" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="proportional" className="cursor-pointer font-medium">
                Encaixar proporcionalmente na nova janela
                {onlyStart && <span className="text-tiny text-muted-foreground font-normal"> (igual ao anterior se só o início mudou)</span>}
              </Label>
              <p className="text-tiny text-muted-foreground mt-1">
                Escala as durações das atividades para preencher exatamente o intervalo entre o novo início e o novo fim do projeto.
              </p>
            </div>
          </div>
        </RadioGroup>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleConfirm(null)}>
            Não recalcular
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => handleConfirm(mode)}>
            Aplicar e salvar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
