/**
 * Confirmação de "Sair" que protege o que ainda não foi enviado.
 *
 * Feito / Não feito e fotos registrados sem sinal ficam guardados no
 * aparelho até chegarem ao sistema. Sair com isso pendente apagaria esses
 * registros — então, se houver algo na fila desta conta, pergunta antes:
 * esperar o envio ou sair mesmo assim (e apagar do aparelho).
 */
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
import { unsentPhrase } from "@/hooks/useSignOutGuard";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Registros desta conta ainda no aparelho (atualiza ao vivo). */
  pendingCount: number;
  /** Sair normalmente (nada pendente). */
  onSignOut: () => void;
  /** Apagar o que não foi enviado e sair. */
  onDiscardAndSignOut: () => void;
}

export function SignOutConfirmDialog({ open, onOpenChange, pendingCount, onSignOut, onDiscardAndSignOut }: DialogProps) {
  const hasPending = pendingCount > 0;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{hasPending ? "Há registros não enviados" : "Sair da sua conta?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasPending
              ? `${unsentPhrase(pendingCount)} (Feito / Não feito ou fotos guardados sem sinal). ` +
                "Se sair agora, eles serão apagados deste aparelho e não chegarão ao sistema. " +
                "Conecte-se e espere o envio para não perder nada."
              : "Suas pendências continuam aqui. Você pode entrar de novo a qualquer momento."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{hasPending ? "Esperar o envio" : "Cancelar"}</AlertDialogCancel>
          {hasPending ? (
            <AlertDialogAction
              onClick={onDiscardAndSignOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sair mesmo assim
            </AlertDialogAction>
          ) : (
            <AlertDialogAction onClick={onSignOut}>Sair</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
