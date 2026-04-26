/**
 * Modal de confirmação para transições de status para "ordered" (Pedido /
 * Contratado) quando a compra ainda não está vinculada a uma etapa do
 * cronograma (`activity_id` nulo).
 *
 * Justificativa: comprar antes da definição final da etapa pode causar
 * retrabalho — o gestor precisa confirmar conscientemente.
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
} from '@/components/ui/alert-dialog';

interface OrderedConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void;
}

export function OrderedConfirmDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
}: OrderedConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Compra sem etapa do cronograma vinculada</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{itemName}</strong> ainda não está vinculada a uma etapa do
            cronograma. Comprar antes da definição final pode causar retrabalho
            (item errado, especificação trocada, prazo desalinhado).
            <br />
            <br />
            Continuar mesmo assim?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Confirmar pedido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
