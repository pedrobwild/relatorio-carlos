import { useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAllCorrectiveActionTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type CorrectiveActionTemplate,
} from "@/hooks/useCorrectiveActionTemplates";
import { NC_CATEGORIES } from "./ncConstants";

interface FormState {
  category: string;
  title: string;
  template_text: string;
}

const emptyForm: FormState = { category: "", title: "", template_text: "" };

export function CorrectiveActionTemplatesAdmin() {
  const { data: templates = [], isLoading } = useAllCorrectiveActionTemplates();
  const createMut = useCreateTemplate();
  const updateMut = useUpdateTemplate();
  const deleteMut = useDeleteTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: CorrectiveActionTemplate) => {
    setEditingId(t.id);
    setForm({
      category: t.category,
      title: t.title,
      template_text: t.template_text,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.category || !form.title.trim() || !form.template_text.trim())
      return;
    if (editingId) {
      updateMut.mutate(
        { id: editingId, ...form },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createMut.mutate(form, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleToggle = (t: CorrectiveActionTemplate) => {
    updateMut.mutate({ id: t.id, is_active: !t.is_active });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMut.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
    }
  };

  // Group by category
  const grouped = NC_CATEGORIES.reduce<
    Record<string, CorrectiveActionTemplate[]>
  >((acc, cat) => {
    const items = templates.filter((t) => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Templates de Ação Corretiva</h3>
        <Button size="sm" className="gap-1.5 h-9" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          Novo Template
        </Button>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((t) => (
              <div
                key={t.id}
                className={`flex items-start justify-between gap-3 p-2 rounded-lg border ${
                  t.is_active ? "bg-background" : "bg-muted/50 opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.title}</span>
                    {!t.is_active && (
                      <Badge variant="outline" className="text-[9px]">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {t.template_text}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleToggle(t)}
                    title={t.is_active ? "Desativar" : "Ativar"}
                  >
                    {t.is_active ? (
                      <ToggleRight className="h-4 w-4 text-primary" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum template cadastrado.
        </p>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Template" : "Novo Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, category: v }))
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {NC_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Título</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Ex: Retrabalho de pintura"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Texto do template</Label>
              <Textarea
                value={form.template_text}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    template_text: e.target.value,
                  }))
                }
                placeholder="Descreva os passos da ação corretiva..."
                rows={4}
                className="min-h-[80px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={
                  !form.category ||
                  !form.title.trim() ||
                  !form.template_text.trim() ||
                  createMut.isPending ||
                  updateMut.isPending
                }
              >
                {createMut.isPending || updateMut.isPending
                  ? "Salvando..."
                  : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
