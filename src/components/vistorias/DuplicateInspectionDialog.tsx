import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateInspection,
  useInspectionItems,
  useInspection,
} from "@/hooks/useInspections";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { INSPECTION_TYPES, type InspectionType } from "./inspectionConstants";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If set, pre-fills checklist items from this inspection */
  duplicateFromInspectionId?: string;
}

export function DuplicateInspectionDialog({
  projectId,
  open,
  onOpenChange,
  duplicateFromInspectionId,
}: Props) {
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [activityId, setActivityId] = useState<string>("");
  const [inspectionType, setInspectionType] =
    useState<InspectionType>("rotina");
  const [clientPresent, setClientPresent] = useState(false);
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ description: string }[]>([]);
  const [newItemText, setNewItemText] = useState("");

  const createInspection = useCreateInspection();

  const { data: sourceItems, isLoading: loadingSource } = useInspectionItems(
    duplicateFromInspectionId,
  );
  const { data: sourceInspection } = useInspection(duplicateFromInspectionId);

  // Pre-fill items and type from source inspection
  useEffect(() => {
    if (sourceItems && sourceItems.length > 0) {
      setItems(sourceItems.map((i) => ({ description: i.description })));
    }
  }, [sourceItems]);

  useEffect(() => {
    if (sourceInspection) {
      setInspectionType(
        ((sourceInspection as any).inspection_type ||
          "rotina") as InspectionType,
      );
      setClientPresent((sourceInspection as any).client_present || false);
      setClientName((sourceInspection as any).client_name || "");
    }
  }, [sourceInspection]);

  const { data: activities = [] } = useQuery({
    queryKey: ["project-activities", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_activities")
        .select("id, description")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });

  const handleAddCustomItem = () => {
    if (!newItemText.trim()) return;
    setItems((prev) => [...prev, { description: newItemText.trim() }]);
    setNewItemText("");
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (items.length === 0) return;
    createInspection.mutate(
      {
        project_id: projectId,
        activity_id:
          activityId && activityId !== "none" ? activityId : undefined,
        inspection_date: inspectionDate,
        notes: notes || undefined,
        inspection_type: inspectionType,
        client_present: clientPresent,
        client_name:
          clientPresent && clientName.trim() ? clientName.trim() : undefined,
        items: items.map((item, i) => ({
          description: item.description,
          sort_order: i,
        })),
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[100dvh] sm:max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Duplicar Vistoria</DialogTitle>
        </DialogHeader>

        {loadingSource ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Inspection type */}
            <div className="space-y-2">
              <Label>Tipo de Vistoria</Label>
              <Select
                value={inspectionType}
                onValueChange={(v) => setInspectionType(v as InspectionType)}
              >
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {INSPECTION_TYPES.map((t) => (
                    <SelectItem
                      key={t.value}
                      value={t.value}
                      className="min-h-[44px]"
                    >
                      {t.emoji} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data da vistoria</Label>
              <Input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="h-11 sm:h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Atividade vinculada (opcional)</Label>
              <Select value={activityId} onValueChange={setActivityId}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue placeholder="Selecione uma atividade" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {activities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações gerais..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-3">
              <Label>Itens do checklist (copiados)</Label>

              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar item..."
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustomItem()}
                  className="h-11 sm:h-10"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleAddCustomItem}
                  disabled={!newItemText.trim()}
                  className="h-11 w-11 sm:h-10 sm:w-10 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {items.length > 0 && (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2.5 text-sm gap-2"
                    >
                      <span className="truncate text-xs sm:text-sm">
                        {item.description}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 sm:h-7 sm:w-7 shrink-0"
                        onClick={() => handleRemoveItem(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "item" : "itens"} no
                checklist
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              items.length === 0 || createInspection.isPending || loadingSource
            }
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            {createInspection.isPending ? "Criando..." : "Criar Vistoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
