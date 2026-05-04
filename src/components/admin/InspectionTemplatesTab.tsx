import { useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Pencil,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

interface InspectionTemplate {
  id: string;
  category: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export function InspectionTemplatesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "",
    description: "",
    sort_order: 0,
    is_active: true,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin-inspection-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_templates")
        .select("*")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return data as InspectionTemplate[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: {
      id?: string;
      category: string;
      description: string;
      sort_order: number;
      is_active: boolean;
    }) => {
      if (params.id) {
        const { error } = await supabase
          .from("inspection_templates")
          .update({
            category: params.category,
            description: params.description,
            sort_order: params.sort_order,
            is_active: params.is_active,
          })
          .eq("id", params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inspection_templates").insert({
          category: params.category,
          description: params.description,
          sort_order: params.sort_order,
          is_active: params.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-inspection-templates"],
      });
      queryClient.invalidateQueries({ queryKey: ["inspection-templates"] });
      setDialogOpen(false);
      toast.success(editingId ? "Item atualizado" : "Item criado");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inspection_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-inspection-templates"],
      });
      queryClient.invalidateQueries({ queryKey: ["inspection-templates"] });
      toast.success("Item removido");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from("inspection_templates")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-inspection-templates"],
      });
      queryClient.invalidateQueries({ queryKey: ["inspection-templates"] });
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ category: "", description: "", sort_order: 0, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (t: InspectionTemplate) => {
    setEditingId(t.id);
    setForm({
      category: t.category,
      description: t.description,
      sort_order: t.sort_order,
      is_active: t.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.category.trim() || !form.description.trim()) return;
    upsertMutation.mutate({ id: editingId ?? undefined, ...form });
  };

  // Group templates by category
  const grouped = templates.reduce(
    (acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    },
    {} as Record<string, InspectionTemplate[]>,
  );

  const categories = Object.keys(grouped).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Templates de Checklist</h2>
          <p className="text-sm text-muted-foreground">
            Itens padrão para vistorias, organizados por categoria.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Item
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhum template de checklist"
          description="Crie itens padrão para agilizar a criação de vistorias."
        />
      ) : (
        categories.map((cat) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                {cat}
                <Badge variant="secondary" className="text-[10px]">
                  {grouped[cat].length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {grouped[cat].map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <span
                      className={`text-sm truncate ${!t.is_active ? "line-through text-muted-foreground" : ""}`}
                    >
                      {t.description}
                    </span>
                    {!t.is_active && (
                      <Badge variant="outline" className="text-[10px]">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ id: t.id, is_active: checked })
                      }
                      className="scale-75"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMutation.mutate(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Item" : "Novo Item de Checklist"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input
                placeholder="Ex: Estrutura, Elétrica, Hidráulica..."
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value }))
                }
                list="categories-list"
              />
              <datalist id="categories-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Descrição do item</Label>
              <Input
                placeholder="Ex: Verificar prumo das paredes"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    sort_order: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) =>
                  setForm((p) => ({ ...p, is_active: v }))
                }
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !form.category.trim() ||
                !form.description.trim() ||
                upsertMutation.isPending
              }
            >
              {upsertMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
