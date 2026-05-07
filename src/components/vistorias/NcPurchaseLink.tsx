import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useProjectPurchases,
  type PurchaseInput,
} from "@/hooks/useProjectPurchases";
import type { NonConformity } from "@/hooks/useNonConformities";
import { toast } from "sonner";

interface Props {
  nc: NonConformity;
}

export function NcPurchaseLink({ nc }: Props) {
  const [open, setOpen] = useState(false);
  const { addPurchase } = useProjectPurchases(nc.project_id, false);
  const [form, setForm] = useState({
    item_name: `[NC] ${nc.title}`,
    description:
      `Solicitação gerada a partir da NC: ${nc.title}\n${nc.description || ""}`.trim(),
    estimated_cost: "",
  });

  const isCriticalOrHigh = nc.severity === "critical" || nc.severity === "high";

  if (!isCriticalOrHigh) return null;

  const handleSubmit = () => {
    if (!form.item_name.trim()) return;

    const requiredByDate = new Date();
    requiredByDate.setDate(
      requiredByDate.getDate() + (nc.severity === "critical" ? 3 : 7),
    );

    addPurchase.mutate(
      {
        project_id: nc.project_id,
        item_name: form.item_name.trim(),
        description: form.description.trim() || null,
        estimated_cost: form.estimated_cost
          ? parseFloat(form.estimated_cost)
          : null,
        status: "pending",
        quantity: 1,
        unit: "un",
        lead_time_days: nc.severity === "critical" ? 3 : 7,
        required_by_date: requiredByDate.toISOString().split("T")[0],
        notes: `Prioridade: ${nc.severity === "critical" ? "URGENTE" : "ALTA"} — Originada de NC`,
      } satisfies PurchaseInput,
      {
        onSuccess: () => {
          toast.success("Solicitação de compra criada");
          setOpen(false);
        },
        onError: (err: Error) => {
          toast.error("Erro: " + err.message);
        },
      },
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        Gerar Solicitação de Compra
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Nova Solicitação de Compra
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="p-2 rounded bg-muted/50 text-xs">
              <p className="text-muted-foreground">Vinculada à NC:</p>
              <p className="font-medium">{nc.title}</p>
              <Badge variant="destructive" className="mt-1 text-[10px]">
                {nc.severity === "critical" ? "Crítica" : "Alta"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label>Nome do item</Label>
              <Input
                value={form.item_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, item_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Custo estimado (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                value={form.estimated_cost}
                onChange={(e) =>
                  setForm((p) => ({ ...p, estimated_cost: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.item_name.trim() || addPurchase.isPending}
            >
              {addPurchase.isPending ? "Criando..." : "Criar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
