/**
 * RecebimentosSection — Onda E2 (aditivo, staff-only)
 *
 * Seção de recebimentos parciais/totais de uma compra. Não altera nenhum
 * comportamento do formulário existente. Só aparece em modo edição.
 */
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dates";

import {
  usePurchaseReceipts,
  useCreatePurchaseReceipt,
  useDeletePurchaseReceipt,
} from "@/hooks/usePurchaseReceipts";

interface Props {
  purchaseId: string;
  expectedQuantity?: number | null;
  expectedTotal?: number | null;
}

function fmtDate(value: string): string {
  try {
    return format(parseLocalDate(value), "dd MMM yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function RecebimentosSection({
  purchaseId,
  expectedQuantity,
  expectedTotal,
}: Props) {
  const { data: receipts = [], isLoading } = usePurchaseReceipts(purchaseId);
  const create = useCreatePurchaseReceipt(purchaseId);
  const remove = useDeletePurchaseReceipt(purchaseId);

  const [receivedOn, setReceivedOn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [quantidade, setQuantidade] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const totals = useMemo(() => {
    let qty = 0;
    let val = 0;
    for (const r of receipts) {
      qty += Number(r.quantidade ?? 0);
      val += Number(r.valor ?? 0);
    }
    return { qty, val };
  }, [receipts]);

  const qtyExp = Number(expectedQuantity ?? 0);
  const valExp = Number(expectedTotal ?? 0);
  const isFullyReceived =
    (qtyExp > 0 && totals.qty >= qtyExp - 0.0001) ||
    (qtyExp === 0 && valExp > 0 && totals.val >= valExp - 0.0001);
  const isPartiallyReceived = !isFullyReceived && receipts.length > 0;

  function reset() {
    setQuantidade("");
    setValor("");
    setNotes("");
  }

  async function submit() {
    if (!receivedOn) return;
    await create.mutateAsync({
      received_on: receivedOn,
      quantidade: quantidade ? Number(quantidade) : null,
      valor: valor ? Number(valor) : null,
      notes: notes.trim() ? notes.trim() : null,
    });
    reset();
  }

  return (
    <section
      aria-label="Recebimentos"
      className="mt-2 rounded-lg border border-border/60 bg-muted/20 p-3"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">
            Recebimentos
          </h3>
          {isFullyReceived && (
            <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
              Recebido integralmente
            </Badge>
          )}
          {isPartiallyReceived && (
            <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
              Parcial
            </Badge>
          )}
          {receipts.length === 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              Nada recebido
            </Badge>
          )}
        </div>
      </header>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : receipts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum recebimento registrado ainda.
        </p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {receipts.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border/50 bg-background p-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {fmtDate(r.received_on)}
                  </span>
                  {r.quantidade != null && (
                    <span className="text-muted-foreground tabular-nums">
                      {Number(r.quantidade).toLocaleString("pt-BR")} recebido
                    </span>
                  )}
                  {r.valor != null && (
                    <span className="text-muted-foreground tabular-nums">
                      {fmtCurrency(Number(r.valor))}
                    </span>
                  )}
                </div>
                {r.notes && (
                  <p className="mt-0.5 text-muted-foreground line-clamp-2">
                    {r.notes}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setPendingDelete(r.id)}
                aria-label="Remover recebimento"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(qtyExp > 0 || valExp > 0) && receipts.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          {qtyExp > 0 && (
            <div>
              Quantidade:{" "}
              <span className="tabular-nums font-medium text-foreground">
                {totals.qty.toLocaleString("pt-BR")} / {qtyExp.toLocaleString("pt-BR")}
              </span>
            </div>
          )}
          {valExp > 0 && (
            <div>
              Valor:{" "}
              <span className="tabular-nums font-medium text-foreground">
                {fmtCurrency(totals.val)} / {fmtCurrency(valExp)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className={cn("rounded-md border border-dashed border-border/60 bg-background p-3")}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Registrar recebimento
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <Label htmlFor="receipt_date" className="text-xs">
              Data *
            </Label>
            <Input
              id="receipt_date"
              type="date"
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="receipt_qty" className="text-xs">
              Quantidade
            </Label>
            <Input
              id="receipt_qty"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder={qtyExp > 0 ? `Prev. ${qtyExp}` : "opcional"}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="receipt_val" className="text-xs">
              Valor recebido
            </Label>
            <Input
              id="receipt_val"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="opcional (R$)"
              className="h-9"
            />
          </div>
        </div>
        <div className="mt-2">
          <Label htmlFor="receipt_notes" className="text-xs">
            Observação
          </Label>
          <Textarea
            id="receipt_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="NF, lote, avaria, etc."
            rows={2}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            className="min-h-[36px] gap-1"
            onClick={submit}
            disabled={!receivedOn || create.isPending}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {create.isPending ? "Registrando…" : "Registrar"}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover recebimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O recebimento será removido dos registros desta compra. Você pode
              registrar de novo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={async () => {
                if (pendingDelete) {
                  await remove.mutateAsync(pendingDelete);
                  setPendingDelete(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default RecebimentosSection;
