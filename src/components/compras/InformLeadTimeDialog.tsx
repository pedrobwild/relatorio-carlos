import { useState } from "react";
import { toast } from "sonner";
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
import { purchasesRepo } from "@/infra/repositories";
import { invalidatePurchaseQueries } from "@/lib/queryKeys";

interface Props {
  purchaseId: string;
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Suprimentos informa o prazo do fornecedor; o banco recalcula ideal e limite. */
export function InformLeadTimeDialog({ purchaseId, itemName, open, onOpenChange }: Props) {
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);
  const n = Number(days);
  const valid = days.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 365;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    const res = await purchasesRepo.confirmLeadTime(purchaseId, n);
    setSaving(false);
    if (res.error) {
      toast.error("Não foi possível salvar o prazo. Tente de novo.");
      return;
    }
    invalidatePurchaseQueries();
    toast.success("Prazo informado. As datas ideal e limite foram recalculadas.");
    onOpenChange(false);
    setDays("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Informar prazo</DialogTitle>
          <DialogDescription>{itemName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`lead-${purchaseId}`}>Prazo do fornecedor em dias úteis</Label>
          <Input
            id={`lead-${purchaseId}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-11"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            O limite passa a ser a data de necessidade menos esse prazo, e o ideal, 7 dias antes do limite.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="h-11" disabled={!valid || saving} onClick={submit}>
            {saving ? "Salvando..." : "Confirmar prazo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
