import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchesSearch } from "@/lib/searchNormalize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Star,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  Building2,
  Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierPricesTab } from "@/components/fornecedores/SupplierPricesTab";
import { SupplierAttachmentsTab } from "@/components/fornecedores/SupplierAttachmentsTab";
import {
  TableSkeleton,
  EmptyState as PremiumEmptyState,
} from "@/components/ui-premium";
import {
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_TYPES,
  getSubcategoriesByType,
  type SupplierType,
} from "@/constants/supplierCategories";
import { SupplierTaxonomyFields } from "@/components/fornecedores/SupplierTaxonomyFields";
import { normalizeSupplierTaxonomy } from "@/components/fornecedores/supplierTaxonomy";

// Legacy enum kept for backward compat with DB column `categoria`
type LegacySupplierCategory =
  | "materiais"
  | "mao_de_obra"
  | "servicos"
  | "equipamentos"
  | "outros";

interface Supplier {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  categoria: LegacySupplierCategory;
  supplier_type: string | null;
  supplier_subcategory: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  endereco: string | null;
  produtos_servicos: string | null;
  condicoes_pagamento: string | null;
  prazo_entrega_dias: number | null;
  nota_avaliacao: number | null;
  observacoes: string | null;
  status: string;
  created_at: string;
}

const LEGACY_CATEGORY_LABELS: Record<LegacySupplierCategory, string> = {
  materiais: "Materiais",
  mao_de_obra: "Mão de Obra",
  servicos: "Serviços",
  equipamentos: "Equipamentos",
  outros: "Outros",
};

const emptyForm = (): Partial<Supplier> => ({
  nome: "",
  razao_social: "",
  cnpj_cpf: "",
  categoria: "outros",
  supplier_type: null,
  supplier_subcategory: null,
  telefone: "",
  email: "",
  site: "",
  cidade: "",
  estado: "",
  cep: "",
  endereco: "",
  produtos_servicos: "",
  condicoes_pagamento: "",
  prazo_entrega_dias: undefined as unknown as number,
  nota_avaliacao: undefined as unknown as number,
  observacoes: "",
  status: "ativo",
});

export default function Fornecedores() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("ativo");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Partial<Supplier>>(emptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value);
    // Reset subcategory when category changes (it may be invalid for new type)
    setSubcategoryFilter("all");
  };

  const availableSubcategories =
    categoryFilter !== "all" ? getSubcategoriesByType(categoryFilter) : [];

  const hasActiveFilters =
    search ||
    categoryFilter !== "all" ||
    subcategoryFilter !== "all" ||
    statusFilter !== "ativo";

  const clearAllFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
    setStatusFilter("ativo");
  };

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      if (editing) {
        const { error } = await supabase
          .from("fornecedores")
          .update(data as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fornecedores")
          .insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({
        title: editing ? "Fornecedor atualizado" : "Fornecedor cadastrado",
      });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fornecedores")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({ title: "Fornecedor removido" });
      setDeleteConfirm(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const LEGACY_CATEGORIA_TO_TYPE: Record<string, string> = {
    mao_de_obra: "prestadores",
    servicos: "prestadores",
    materiais: "produtos",
    equipamentos: "produtos",
    outros: "produtos",
  };

  const openEdit = (s: Supplier) => {
    const normalized = normalizeSupplierTaxonomy(
      s.supplier_type,
      s.supplier_subcategory,
    );
    const inferredType =
      normalized.supplier_type ??
      LEGACY_CATEGORIA_TO_TYPE[s.categoria ?? ""] ??
      null;
    setEditing(s);
    setForm({
      ...s,
      ...normalized,
      supplier_type: inferredType,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.nome?.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    const normalizedTaxonomy = normalizeSupplierTaxonomy(
      form.supplier_type,
      form.supplier_subcategory,
    );

    if (!normalizedTaxonomy.supplier_type) {
      toast({ title: "Categoria é obrigatória", variant: "destructive" });
      return;
    }
    if (!normalizedTaxonomy.supplier_subcategory) {
      toast({ title: "Subcategoria é obrigatória", variant: "destructive" });
      return;
    }

    const payload = { ...form, ...normalizedTaxonomy };
    if (
      payload.prazo_entrega_dias === undefined ||
      payload.prazo_entrega_dias === null
    )
      delete payload.prazo_entrega_dias;
    if (payload.nota_avaliacao === undefined || payload.nota_avaliacao === null)
      delete payload.nota_avaliacao;
    saveMutation.mutate(payload);
  };

  const filtered = suppliers.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (categoryFilter !== "all" && s.supplier_type !== categoryFilter)
      return false;
    if (
      subcategoryFilter !== "all" &&
      s.supplier_subcategory !== subcategoryFilter
    )
      return false;
    return matchesSearch(search, [
      s.nome,
      s.produtos_servicos,
      s.cnpj_cpf,
      s.cidade,
      s.supplier_subcategory,
    ]);
  });

  const renderStars = (rating: number | null) => {
    if (!rating)
      return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
        <span className="ml-1 text-xs text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  /** Display the best available category label for a supplier */
  const getCategoryDisplay = (s: Supplier) => {
    if (s.supplier_type && s.supplier_subcategory) {
      return {
        label: s.supplier_subcategory,
        type:
          SUPPLIER_TYPE_LABELS[s.supplier_type as SupplierType] ||
          s.supplier_type,
      };
    }
    // Fallback to legacy
    return {
      label: LEGACY_CATEGORY_LABELS[s.categoria] || s.categoria,
      type: null,
    };
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro e gestão de fornecedores da empresa
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Fornecedor
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ, subcategoria, cidade..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar fornecedores"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={categoryFilter}
                onValueChange={handleCategoryFilterChange}
              >
                <SelectTrigger
                  className="w-[160px]"
                  aria-label="Filtrar por categoria"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {SUPPLIER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {SUPPLIER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryFilter !== "all" && (
                <Select
                  value={subcategoryFilter}
                  onValueChange={setSubcategoryFilter}
                >
                  <SelectTrigger
                    className="w-[180px]"
                    aria-label="Filtrar por subcategoria"
                  >
                    <SelectValue placeholder="Subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas subcategorias</SelectItem>
                    {availableSubcategories.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  className="w-[120px]"
                  aria-label="Filtrar por status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="rascunho">Rascunhos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 text-xs"
                  onClick={clearAllFilters}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{suppliers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-[hsl(var(--success))]">
              {suppliers.filter((s) => s.status === "ativo").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Prestadores</p>
            <p className="text-2xl font-bold">
              {
                suppliers.filter((s) => s.supplier_type === "prestadores")
                  .length
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Produtos</p>
            <p className="text-2xl font-bold">
              {suppliers.filter((s) => s.supplier_type === "produtos").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={6} columns={6} />
            </div>
          ) : filtered.length === 0 ? (
            <PremiumEmptyState
              icon={Building2}
              title="Nenhum fornecedor encontrado"
              description="Cadastre o primeiro fornecedor ou ajuste os filtros para ver resultados."
              action={{
                label: "Cadastrar fornecedor",
                onClick: openNew,
                icon: Plus,
              }}
              bare
              size="md"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Categoria
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Contato
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Localidade
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Prazo</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const catDisplay = getCategoryDisplay(s);
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/gestao/fornecedores/${s.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{s.nome}</p>
                          {s.produtos_servicos && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {s.produtos_servicos}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="secondary" className="w-fit">
                            {catDisplay.label}
                          </Badge>
                          {catDisplay.type && (
                            <span className="text-[10px] text-muted-foreground">
                              {catDisplay.type}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {s.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {s.telefone}
                            </span>
                          )}
                          {s.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {s.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {(s.cidade || s.estado) && (
                          <span className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3" />
                            {[s.cidade, s.estado].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {s.prazo_entrega_dias
                          ? `${s.prazo_entrega_dias}d`
                          : "—"}
                      </TableCell>
                      <TableCell>{renderStars(s.nota_avaliacao)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant={
                            s.status === "ativo"
                              ? "default"
                              : s.status === "rascunho"
                                ? "outline"
                                : "secondary"
                          }
                          className={
                            s.status === "rascunho"
                              ? "border-[hsl(var(--warning))] text-[hsl(var(--warning))]"
                              : undefined
                          }
                        >
                          {s.status === "ativo"
                            ? "Ativo"
                            : s.status === "rascunho"
                              ? "Rascunho"
                              : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeleteConfirm(s.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do fornecedor e selecione a categoria principal
              com a subcategoria correspondente.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              {editing && <TabsTrigger value="precos">Preços</TabsTrigger>}
              {editing && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
            </TabsList>

            <TabsContent value="dados">
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input
                      value={form.nome || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, nome: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Razão Social</Label>
                    <Input
                      value={form.razao_social || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, razao_social: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Row 2: CNPJ + Taxonomy */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>CNPJ/CPF</Label>
                    <Input
                      value={form.cnpj_cpf || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, cnpj_cpf: e.target.value }))
                      }
                    />
                  </div>
                  <SupplierTaxonomyFields
                    supplierType={form.supplier_type}
                    supplierSubcategory={form.supplier_subcategory}
                    onSupplierTypeChange={(value) =>
                      setForm((p) => ({ ...p, supplier_type: value }))
                    }
                    onSupplierSubcategoryChange={(value) =>
                      setForm((p) => ({ ...p, supplier_subcategory: value }))
                    }
                  />
                </div>

                {/* Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={form.status || "ativo"}
                      onValueChange={(v) =>
                        setForm((p) => ({ ...p, status: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="rascunho">Rascunho</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input
                      value={form.telefone || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, telefone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Site</Label>
                    <Input
                      value={form.site || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, site: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Endereço</Label>
                    <Input
                      value={form.endereco || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, endereco: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cidade</Label>
                    <Input
                      value={form.cidade || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, cidade: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estado</Label>
                    <Input
                      value={form.estado || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, estado: e.target.value }))
                      }
                      maxLength={2}
                    />
                  </div>
                </div>

                {/* Products & Conditions */}
                <div className="space-y-1.5">
                  <Label>Produtos / Serviços oferecidos</Label>
                  <Textarea
                    value={form.produtos_servicos || ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        produtos_servicos: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Condições de Pagamento</Label>
                    <Input
                      value={form.condicoes_pagamento || ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          condicoes_pagamento: e.target.value,
                        }))
                      }
                      placeholder="Ex: 30/60/90 dias"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prazo de Entrega (dias)</Label>
                    <Input
                      type="number"
                      value={form.prazo_entrega_dias || ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          prazo_entrega_dias: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nota (0 a 5)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      value={form.nota_avaliacao ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          nota_avaliacao: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea
                    value={form.observacoes || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, observacoes: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
              </div>
            </TabsContent>

            {editing && (
              <TabsContent value="precos">
                <SupplierPricesTab fornecedorId={editing.id} />
              </TabsContent>
            )}

            {editing && (
              <TabsContent value="anexos">
                <SupplierAttachmentsTab fornecedorId={editing.id} />
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? "Salvando..."
                : editing
                  ? "Salvar"
                  : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir este fornecedor? Esta ação não pode
            ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirm && deleteMutation.mutate(deleteConfirm)
              }
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
