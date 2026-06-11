import { useMemo, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutosaveIndicator } from "@/components/ui/AutosaveIndicator";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { PurchaseType } from "@/hooks/useProjectPurchases";

interface BulkItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  notes: string;
  required_by_date: string;
}

const UNITS = ["un", "m²", "m", "kg", "L", "cx", "pc", "rolo", "saco"];

const newItem = (): BulkItem => ({
  id: crypto.randomUUID(),
  item_name: "",
  quantity: 1,
  unit: "un",
  notes: "",
  required_by_date: "",
});

interface DraftState {
  projectId: string;
  items: BulkItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
  purchaseType?: PurchaseType;
}

export function BulkPurchaseRequestDialog({
  open,
  onOpenChange,
  defaultProjectId,
  purchaseType = "produto",
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjectsQuery();

  const draftKey = `bulk-purchase-${defaultProjectId || "global"}-${purchaseType}`;
  const { values, setValues, clearDraft } = useFormDraft<DraftState>({
    key: draftKey,
    initialValues: {
      projectId: defaultProjectId || "",
      items: [newItem()],
    },
    debounceMs: 800,
  });

  const [submitting, setSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Track draft persistence indicator
  useMemo(() => {
    setLastSavedAt(new Date());
  }, [values]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateItem = (id: string, patch: Partial<BulkItem>) => {
    setValues((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  };

  const addRow = () => {
    setValues((prev) => ({ ...prev, items: [...prev.items, newItem()] }));
  };

  const removeRow = (id: string) => {
    setValues((prev) => ({
      ...prev,
      items:
        prev.items.length > 1
          ? prev.items.filter((it) => it.id !== id)
          : prev.items,
    }));
  };

  const validItems = values.items.filter(
    (it) => it.item_name.trim() && it.required_by_date,
  );

  const canSubmit = !!values.projectId && validItems.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!user?.id || !canSubmit) return;
    setSubmitting(true);
    try {
      const today = new Date();
      const payload = validItems.map((it) => {
        const required = new Date(it.required_by_date + "T00:00:00");
        const leadTime = Math.max(
          1,
          Math.ceil(
            (required.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );
        return {
          project_id: values.projectId,
          item_name: it.item_name.trim(),
          quantity: it.quantity || 1,
          unit: it.unit || "un",
          notes: it.notes.trim() || null,
          required_by_date: it.required_by_date,
          lead_time_days: leadTime,
          purchase_type: purchaseType,
          status: "pending" as const,
          created_by: user.id,
        };
      });

      const { error } = await supabase
        .from("project_purchases")
        .insert(payload);

      if (error) throw error;

      toast.success(
        validItems.length === 1
          ? "Solicitação criada"
          : `${validItems.length} solicitações criadas`,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchases.list(values.projectId),
      });
      clearDraft();
      setLastSavedAt(null);
      onOpenChange(false);
    } catch (err) {
      console.error("Bulk purchase request error:", err);
      toast.error(
        err instanceof Error ? err.message : "Erro ao criar solicitações",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar compra (vários itens)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Obra */}
          <div>
            <Label htmlFor="bulk-project">Obra *</Label>
            <Select
              value={values.projectId}
              onValueChange={(v) =>
                setValues((prev) => ({ ...prev, projectId: v }))
              }
            >
              <SelectTrigger id="bulk-project">
                <SelectValue placeholder="Selecione a obra" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items list */}
          <div className="space-y-3">
            {values.items.map((it, idx) => (
              <div
                key={it.id}
                className="rounded-lg border bg-card p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Item {idx + 1}
                  </span>
                  {values.items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(it.id)}
                      type="button"
                      aria-label={`Remover item ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px] gap-2">
                  <div>
                    <Label className="text-xs">Item / Produto *</Label>
                    <Input
                      value={it.item_name}
                      onChange={(e) =>
                        updateItem(it.id, { item_name: e.target.value })
                      }
                      placeholder="Ex: Piso porcelanato 60x60"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Qtd *</Label>
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(it.id, {
                          quantity: parseFloat(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade *</Label>
                    <Select
                      value={it.unit}
                      onValueChange={(v) => updateItem(it.id, { unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-2">
                  <div>
                    <Label className="text-xs">Observação curta</Label>
                    <Textarea
                      rows={2}
                      value={it.notes}
                      onChange={(e) =>
                        updateItem(it.id, { notes: e.target.value })
                      }
                      placeholder="Detalhes / marca / cor (opcional)"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      Data necessária na obra *
                    </Label>
                    <Input
                      type="date"
                      value={it.required_by_date}
                      onChange={(e) =>
                        updateItem(it.id, { required_by_date: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={addRow}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar outro item
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <AutosaveIndicator lastSavedAt={lastSavedAt} />
          <div className="flex gap-2 sm:ml-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Concluir ({validItems.length})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
