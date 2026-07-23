/**
 * DeliveryStatusBadge — Onda E2 (aditivo, staff-only)
 *
 * Badge compacta que mostra o estado de entrega derivado da tabela
 * `purchase_receipts`. Não interfere com o status logístico existente.
 */
import { Badge } from "@/components/ui/badge";
import { usePurchaseReceipts } from "@/hooks/usePurchaseReceipts";
import { addBusinessDays } from "@/lib/businessDays";
import { parseLocalDate } from "@/lib/dates";

interface Props {
  purchaseId: string;
  expectedDeliveryDate?: string | null;
  expectedQuantity?: number | null;
  expectedTotal?: number | null;
}

export function DeliveryStatusBadge({
  purchaseId,
  expectedDeliveryDate,
  expectedQuantity,
  expectedTotal,
}: Props) {
  const { data: receipts = [] } = usePurchaseReceipts(purchaseId);

  const totalQty = receipts.reduce((s, r) => s + Number(r.quantidade ?? 0), 0);
  const totalVal = receipts.reduce((s, r) => s + Number(r.valor ?? 0), 0);
  const qtyExp = Number(expectedQuantity ?? 0);
  const valExp = Number(expectedTotal ?? 0);

  const fullyReceived =
    (qtyExp > 0 && totalQty >= qtyExp - 0.0001) ||
    (qtyExp === 0 && valExp > 0 && totalVal >= valExp - 0.0001);
  const partial = !fullyReceived && receipts.length > 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expected = expectedDeliveryDate
    ? parseLocalDate(expectedDeliveryDate)
    : null;
  const overdue = expected != null && expected < today && !fullyReceived;

  if (fullyReceived) {
    return (
      <Badge
        variant="outline"
        className="ml-1 border-success/40 bg-success/10 text-success text-[10px] px-1 h-4"
        title="Recebimento integral registrado"
      >
        Recebido
      </Badge>
    );
  }

  if (overdue) {
    return (
      <Badge
        variant="outline"
        className="ml-1 border-destructive/40 bg-destructive/10 text-destructive text-[10px] px-1 h-4"
        title="Entrega vencida sem recebimento total"
      >
        Entrega atrasada
      </Badge>
    );
  }

  if (partial) {
    return (
      <Badge
        variant="outline"
        className="ml-1 border-warning/40 bg-warning/10 text-warning text-[10px] px-1 h-4"
        title="Recebimento parcial"
      >
        Parcial
      </Badge>
    );
  }

  if (expected != null) {
    const in3 = addBusinessDays(today, 3);
    const soon = expected <= in3;
    if (soon) {
      return (
        <Badge
          variant="outline"
          className="ml-1 border-warning/40 bg-warning/10 text-warning text-[10px] px-1 h-4"
          title="Entrega próxima sem recebimento"
        >
          Entrega próxima
        </Badge>
      );
    }
  }

  return null;
}

export default DeliveryStatusBadge;
