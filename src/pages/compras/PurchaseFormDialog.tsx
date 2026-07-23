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
import type { PurchaseInput, PurchaseType } from "@/hooks/useProjectPurchases";
import { AutosaveIndicator } from "@/components/ui/AutosaveIndicator";
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
import type { PaymentInstallment } from "./PaymentScheduleSection";
import { RecebimentosSection } from "@/components/compras/RecebimentosSection";


interface PurchaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  formData: Partial<PurchaseInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<PurchaseInput>>>;
  activities: { id: string; description: string; planned_start: string }[];
  onActivityChange: (activityId: string) => void;
  onLeadTimeChange: (leadTime: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  paymentInstallments: PaymentInstallment[];
  onPaymentInstallmentsChange: (installments: PaymentInstallment[]) => void;
  editingPurchaseId?: string;
  /** When the form was last autosaved as a draft (only applies to new purchases). */
  draftLastSavedAt?: Date | null;
}

const UNITS = [
  { value: "un", label: "Unidade (un)" },
  { value: "m²", label: "Metro Quadrado (m²)" },
  { value: "m", label: "Metro Linear (m)" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "L", label: "Litro (L)" },
  { value: "cx", label: "Caixa (cx)" },
  { value: "pc", label: "Peça (pc)" },
  { value: "rolo", label: "Rolo" },
  { value: "saco", label: "Saco" },
];

export function PurchaseFormDialog({
  open,
  onOpenChange,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  draftLastSavedAt,
  editingPurchaseId,
}: PurchaseFormDialogProps) {
  const purchaseType = formData.purchase_type || "produto";
  const isPrestador = purchaseType === "prestador";


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar" : "Novo"}{" "}
            {isPrestador ? "Prestador" : "Produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Item / Produto */}
          <div>
            <Label htmlFor="item_name">
              {isPrestador ? "Nome do Serviço" : "Nome do Produto"} *
            </Label>
            <Input
              id="item_name"
              value={formData.item_name || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  item_name: e.target.value,
                }))
              }
              placeholder={
                isPrestador
                  ? "Ex: Instalação de piso"
                  : "Ex: Piso porcelanato 60x60"
              }
            />
          </div>

          {/* Quantidade + Unidade (apenas produto) */}
          {!isPrestador && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantidade *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={formData.quantity || 1}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity: parseFloat(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="unit">Unidade *</Label>
                <Select
                  value={formData.unit || "un"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, unit: value }))
                  }
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Observação curta */}
          <div>
            <Label htmlFor="notes">Observação curta</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Detalhes / marca / cor (opcional)"
              rows={2}
            />
          </div>

          {/* Data necessária na obra */}
          <div>
            <Label htmlFor="required_by_date">
              {isPrestador
                ? "Data início do serviço"
                : "Data necessária na obra"}{" "}
              *
            </Label>
            <Input
              id="required_by_date"
              type="date"
              value={formData.required_by_date || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  required_by_date: e.target.value,
                }))
              }
            />
          </div>
        </div>

        {isEditing && editingPurchaseId && (
          <RecebimentosSection
            purchaseId={editingPurchaseId}
            expectedQuantity={!isPrestador ? (formData.quantity ?? null) : null}
            expectedTotal={formData.estimated_cost ?? null}
          />
        )}



        <DialogFooter className="gap-2 sm:justify-between">
          {!isEditing ? (
            <AutosaveIndicator
              lastSavedAt={draftLastSavedAt ?? null}
              className="self-center"
            />
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="min-h-[44px]"
              onClick={onSubmit}
              disabled={
                !formData.item_name || !formData.required_by_date || isSubmitting
              }
            >
              {isEditing ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeletePurchaseDialogProps {
  open: boolean;
  onOpenChange: () => void;
  onDelete: () => void;
}

export function DeletePurchaseDialog({
  open,
  onOpenChange,
  onDelete,
}: DeletePurchaseDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este item? Esta ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className="bg-destructive text-destructive-foreground"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
