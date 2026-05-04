import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ObservationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  notes: string;
  onSave: (notes: string) => void;
}

export function ObservationsModal({
  open,
  onOpenChange,
  itemName,
  notes,
  onSave,
}: ObservationsModalProps) {
  const [value, setValue] = useState(notes);

  // Sync internal state when modal opens with new notes
  useEffect(() => {
    if (open) setValue(notes);
  }, [open, notes]);

  const handleSave = () => {
    onSave(value);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Observações — {itemName}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="obs-text">Observações</Label>
          <Textarea
            id="obs-text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Adicione observações sobre este item..."
            rows={6}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button className="min-h-[44px]" onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
