import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pencil, Trash2, GripVertical, Tags, Settings2, ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ───────── Types ───────── */
interface SupplierCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
  is_default: boolean;
  sort_order: number;
}

interface SupplierSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
}

/* ───────── Color options ───────── */
const COLOR_OPTIONS = [
  { label: "Azul", value: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { label: "Laranja", value: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  { label: "Roxo", value: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { label: "Verde", value: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { label: "Vermelho", value: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { label: "Amarelo", value: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { label: "Cinza", value: "bg-muted text-muted-foreground" },
];

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/* ───────── Settings labels ───────── */
const SETTINGS_LABELS: Record<string, { label: string; type: "boolean" | "number" }> = {
  avaliacao_obrigatoria: { label: "Exigir avaliação ao cadastrar fornecedor", type: "boolean" },
  prazo_entrega_padrao: { label: "Prazo de entrega padrão (dias)", type: "number" },
};

export default function FornecedoresAdmin() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── Categories ──
  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as SupplierCategory[];
    },
  });

  // ── Settings ──
  const { data: settings = [] } = useQuery({
    queryKey: ["supplier-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data as SupplierSetting[];
    },
  });

  // ── Category CRUD ──
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<SupplierCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", color: COLOR_OPTIONS[0].value });
  const [deleteConfirm, setDeleteConfirm] = useState<SupplierCategory | null>(null);

  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ name: "", color: COLOR_OPTIONS[0].value });
    setCatDialog(true);
  };

  const openEditCat = (cat: SupplierCategory) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, color: cat.color });
    setCatDialog(true);
  };

  const saveCatMut = useMutation({
    mutationFn: async () => {
      if (!catForm.name.trim()) throw new Error("Nome obrigatório");
      const slug = slugify(catForm.name);
      if (editingCat) {
        const { error } = await supabase
          .from("supplier_categories")
          .update({ name: catForm.name, slug, color: catForm.color } as any)
          .eq("id", editingCat.id);
        if (error) throw error;
      } else {
        const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) : 0;
        const { error } = await supabase
          .from("supplier_categories")
          .insert({ name: catForm.name, slug, color: catForm.color, sort_order: maxOrder + 1 } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-categories"] });
      setCatDialog(false);
      toast({ title: editingCat ? "Categoria atualizada" : "Categoria criada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCatMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-categories"] });
      setDeleteConfirm(null);
      toast({ title: "Categoria removida" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Settings mutations ──
  const updateSettingMut = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("supplier_settings")
        .update({ value: JSON.stringify(value) } as any)
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-settings"] });
      toast({ title: "Configuração atualizada" });
    },
  });

  const getSettingValue = (key: string) => {
    const s = settings.find((s) => s.key === key);
    if (!s) return null;
    try {
      return typeof s.value === "string" ? JSON.parse(s.value) : s.value;
    } catch {
      return s.value;
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gestao/fornecedores")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações de Fornecedores</h1>
          <p className="text-sm text-muted-foreground">Gerencie categorias e preferências do módulo</p>
        </div>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Categorias</CardTitle>
              <CardDescription>Organize seus fornecedores por tipo</CardDescription>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openNewCat}>
            <Plus className="h-4 w-4" /> Nova Categoria
          </Button>
        </CardHeader>
        <CardContent>
          {catLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Padrão</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        <GripVertical className="h-4 w-4 opacity-30" />
                      </TableCell>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">{cat.slug}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cat.color}>
                          {cat.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cat.is_default && (
                          <Badge variant="outline" className="text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" /> Sistema
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCat(cat)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!cat.is_default && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(cat)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Preferências</CardTitle>
              <CardDescription>Configurações gerais do módulo de fornecedores</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Boolean: avaliacao obrigatoria */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Exigir avaliação ao cadastrar fornecedor</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tornará o campo de nota obrigatório no formulário
              </p>
            </div>
            <Switch
              checked={getSettingValue("avaliacao_obrigatoria") === true || getSettingValue("avaliacao_obrigatoria") === "true"}
              onCheckedChange={(v) => updateSettingMut.mutate({ key: "avaliacao_obrigatoria", value: v })}
            />
          </div>

          {/* Number: prazo entrega padrao */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Prazo de entrega padrão (dias)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Valor sugerido ao cadastrar novo fornecedor
              </p>
            </div>
            <Input
              type="number"
              className="w-24"
              value={getSettingValue("prazo_entrega_padrao") ?? 30}
              onChange={(e) => updateSettingMut.mutate({ key: "prazo_entrega_padrao", value: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={catForm.name}
                onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Elétrica"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCatForm((p) => ({ ...p, color: c.value }))}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${c.value} ${
                      catForm.color === c.value ? "ring-2 ring-primary ring-offset-2" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="mt-1">
                <Badge variant="secondary" className={catForm.color}>
                  {catForm.name || "Nome da categoria"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveCatMut.mutate()} disabled={saveCatMut.isPending}>
              {saveCatMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir categoria</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir a categoria <strong>{deleteConfirm?.name}</strong>?
            Fornecedores com esta categoria não serão afetados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteCatMut.mutate(deleteConfirm.id)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
