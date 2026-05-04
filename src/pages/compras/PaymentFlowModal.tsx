import { useState, useEffect } from "react";
import { Plus, Trash2, Check, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PaymentFlow {
  id: string;
  installment_name: string;
  amount: number;
  due_date: string | null;
  status: string;
  sort_order: number;
  isNew?: boolean;
}

interface PaymentFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseId: string;
  projectId: string;
  itemName: string;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PaymentFlowModal({
  open,
  onOpenChange,
  purchaseId,
  projectId,
  itemName,
}: PaymentFlowModalProps) {
  const [flows, setFlows] = useState<PaymentFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const load = async () => {
      const { data, error } = await supabase
        .from("purchase_payment_flows")
        .select("*")
        .eq("purchase_id", purchaseId)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error(error);
        toast.error("Erro ao carregar fluxo de pagamento");
      } else {
        setFlows(
          (data || []).map((d) => ({
            id: d.id,
            installment_name: d.installment_name,
            amount: Number(d.amount),
            due_date: d.due_date,
            status: d.status,
            sort_order: d.sort_order,
          })),
        );
      }
      setLoading(false);
    };
    load();
  }, [open, purchaseId]);

  const addRow = () => {
    setFlows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        installment_name: `Parcela ${prev.length + 1}`,
        amount: 0,
        due_date: null,
        status: "pendente",
        sort_order: prev.length,
        isNew: true,
      },
    ]);
  };

  const updateRow = (
    id: string,
    field: keyof PaymentFlow,
    value: string | number,
  ) => {
    setFlows((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)),
    );
  };

  const removeRow = (id: string) => {
    setFlows((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing flows for this purchase then re-insert
      const { error: delError } = await supabase
        .from("purchase_payment_flows")
        .delete()
        .eq("purchase_id", purchaseId);

      if (delError) throw delError;

      if (flows.length > 0) {
        const rows = flows.map((f, i) => ({
          id: f.isNew ? undefined : f.id,
          purchase_id: purchaseId,
          project_id: projectId,
          installment_name: f.installment_name,
          amount: f.amount,
          due_date: f.due_date || null,
          status: f.status,
          sort_order: i,
        }));

        const { error: insError } = await supabase
          .from("purchase_payment_flows")
          .insert(rows);

        if (insError) throw insError;
      }

      toast.success("Fluxo de pagamento salvo");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar fluxo de pagamento");
    } finally {
      setSaving(false);
    }
  };

  const total = flows.reduce((s, f) => s + (f.amount || 0), 0);
  const paidCount = flows.filter((f) => f.status === "concluido").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Fluxo de Pagamento — {itemName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Total:{" "}
                  <strong className="text-foreground">{fmt(total)}</strong>
                </span>
                <span>
                  {paidCount}/{flows.length} concluídas
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> Nova Parcela
              </Button>
            </div>

            {flows.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma parcela cadastrada. Clique em "Nova Parcela" para
                começar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Parcela</TableHead>
                    <TableHead className="min-w-[120px]">Valor</TableHead>
                    <TableHead className="min-w-[140px]">
                      Data Pagamento
                    </TableHead>
                    <TableHead className="min-w-[130px]">Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flows.map((flow) => (
                    <TableRow key={flow.id}>
                      <TableCell>
                        <Input
                          className="h-8 text-sm"
                          value={flow.installment_name}
                          onChange={(e) =>
                            updateRow(
                              flow.id,
                              "installment_name",
                              e.target.value,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="h-8 w-28 text-sm"
                          value={flow.amount || ""}
                          onChange={(e) =>
                            updateRow(
                              flow.id,
                              "amount",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className="h-8 text-sm"
                          value={flow.due_date || ""}
                          onChange={(e) =>
                            updateRow(flow.id, "due_date", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={flow.status}
                          onValueChange={(v) => updateRow(flow.id, "status", v)}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8 w-32 text-xs",
                              flow.status === "concluido"
                                ? "bg-green-500/20 text-green-700 border-green-500/30"
                                : "bg-amber-500/20 text-amber-700 border-amber-500/30",
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              {flow.status === "concluido" ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                              <span>
                                {flow.status === "concluido"
                                  ? "Concluído"
                                  : "Pendente"}
                              </span>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Pendente
                              </div>
                            </SelectItem>
                            <SelectItem value="concluido">
                              <div className="flex items-center gap-2">
                                <Check className="h-4 w-4" /> Concluído
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeRow(flow.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
