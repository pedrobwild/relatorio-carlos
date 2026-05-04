import { AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { formatDateFull } from "./types";

interface DateChangeAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalDate: string;
  newDate: string;
  reason: string;
  contractClause: string;
}

export function DateChangeAlert({
  open,
  onOpenChange,
  originalDate,
  newDate,
  reason,
  contractClause,
}: DateChangeAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="w-5 h-5" />
            Prazo Final Alterado
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <p>
              A data prevista de término foi alterada de{" "}
              <span className="font-semibold line-through text-muted-foreground">
                {formatDateFull(originalDate)}
              </span>{" "}
              para{" "}
              <span className="font-semibold text-foreground">
                {formatDateFull(newDate)}
              </span>
              .
            </p>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
              <p className="text-sm font-medium text-warning mb-1">Motivo:</p>
              <p className="text-sm text-foreground">
                {reason}, de acordo com a{" "}
                <span className="font-semibold">cláusula {contractClause}</span>{" "}
                do contrato.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Entendi</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
