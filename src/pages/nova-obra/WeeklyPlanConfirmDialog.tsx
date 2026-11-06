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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  messages: string[];
  onConfirm: () => void;
}

/** Confirmação quando o cronograma semanal passa do fim pelo contrato. */
export function WeeklyPlanConfirmDialog({
  open,
  onOpenChange,
  messages,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cronograma passa do prazo do contrato</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {messages.map((m) => (
                <p key={m}>{m}</p>
              ))}
              <p>Quer cadastrar a obra mesmo assim?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-[44px]">Revisar</AlertDialogCancel>
          <AlertDialogAction className="min-h-[44px]" onClick={onConfirm}>
            Cadastrar assim mesmo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
