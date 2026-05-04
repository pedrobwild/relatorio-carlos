import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useCreateInspection } from "@/hooks/useInspections";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  INSPECTION_TYPES,
  TYPE_TO_TEMPLATE_CATEGORY,
  type InspectionType,
} from "./inspectionConstants";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInspectionDialog({
  projectId,
  open,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const [inspectionType, setInspectionType] =
    useState<InspectionType>("rotina");
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [activityId, setActivityId] = useState<string>("");
  const [inspectorUserId, setInspectorUserId] = useState<string>(
    user?.id ?? "",
  );
  const [notes, setNotes] = useState("");
  const [clientPresent, setClientPresent] = useState(false);
  const [clientName, setClientName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [items, setItems] = useState<{ description: string }[]>([]);
  const [newItemText, setNewItemText] = useState("");

  const createInspection = useCreateInspection();

  // Set default inspector to current user
  useEffect(() => {
    if (user?.id && !inspectorUserId) setInspectorUserId(user.id);
  }, [user?.id]);

  // Fetch project activities for linking
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

  // Fetch staff users for inspector select
  const { data: staffUsers = [] } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users_profile")
        .select("id, nome")
        .in("perfil", ["admin", "engineer", "manager", "gestor"])
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch inspection templates from DB
  const { data: templatesByCategory = {} } = useQuery({
    queryKey: ["inspection-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_templates")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).reduce(
        (acc: Record<string, string[]>, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item.description);
          return acc;
        },
        {} as Record<string, string[]>,
      );
    },
    staleTime: 1000 * 60 * 60,
  });

  // Auto-load template when type changes
  useEffect(() => {
    const templateCat = TYPE_TO_TEMPLATE_CATEGORY[inspectionType];
    if (templateCat && templatesByCategory[templateCat] && items.length === 0) {
      const categoryItems = templatesByCategory[templateCat];
      setItems(categoryItems.map((desc: string) => ({ description: desc })));
    }
  }, [inspectionType, templatesByCategory]);

  const handleAddCategory = (category: string) => {
    const categoryItems = templatesByCategory[category] || [];
    const newItems = categoryItems
      .filter((desc: string) => !items.some((i) => i.description === desc))
      .map((desc: string) => ({ description: desc }));
    setItems((prev) => [...prev, ...newItems]);
    setSelectedCategory("");
  };

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
        inspector_user_id: inspectorUserId || undefined,
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

  const categories = Object.keys(templatesByCategory);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[100dvh] sm:max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Nova Vistoria</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Inspection type */}
          <div className="space-y-2">
            <Label>
              Tipo de Vistoria <span className="text-destructive">*</span>
            </Label>
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

          {/* Date */}
          <div className="space-y-2">
            <Label>Data da vistoria</Label>
            <Input
              type="date"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              className="h-11 sm:h-10"
            />
          </div>

          {/* Inspector */}
          <div className="space-y-2">
            <Label>Vistoriador responsável</Label>
            <Select value={inspectorUserId} onValueChange={setInspectorUserId}>
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue placeholder="Selecione o vistoriador" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {staffUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Activity link */}
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

          {/* Client present toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="client-present" className="cursor-pointer">
                Cliente/morador presente
              </Label>
              <Switch
                id="client-present"
                checked={clientPresent}
                onCheckedChange={setClientPresent}
              />
            </div>
            {clientPresent && (
              <Input
                placeholder="Nome do acompanhante..."
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-11 sm:h-10"
              />
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações gerais da vistoria..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="min-h-[44px]"
            />
          </div>

          {/* Checklist builder */}
          <div className="space-y-3">
            <Label>Itens do checklist</Label>

            {/* Category presets from DB */}
            <Select value={selectedCategory} onValueChange={handleAddCategory}>
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue placeholder="Adicionar checklist padrão..." />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom item */}
            <div className="flex gap-2">
              <Input
                placeholder="Item personalizado..."
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

            {/* Items list */}
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
            disabled={items.length === 0 || createInspection.isPending}
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            {createInspection.isPending ? "Criando..." : "Criar Vistoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
