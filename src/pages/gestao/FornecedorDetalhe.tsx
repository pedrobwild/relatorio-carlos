import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupplierTaxonomyFields } from "@/components/fornecedores/SupplierTaxonomyFields";
import { normalizeSupplierTaxonomy } from "@/components/fornecedores/supplierTaxonomy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Star,
  Phone,
  Mail,
  MapPin,
  Globe,
  Clock,
  CreditCard,
  Save,
  X,
  RefreshCw,
  Building2,
} from "lucide-react";
import { invokeFunction } from "@/infra/edgeFunctions";
import { trackAmplitude } from "@/lib/amplitude";
import { SupplierPricesTab } from "@/components/fornecedores/SupplierPricesTab";
import { SupplierAttachmentsTab } from "@/components/fornecedores/SupplierAttachmentsTab";
import { SupplierPurchaseHistoryTab } from "@/components/fornecedores/SupplierPurchaseHistoryTab";
import { PageSkeleton, EmptyState } from "@/components/ui-premium";
import {
  SUPPLIER_TYPE_LABELS,
  type SupplierType,
} from "@/constants/supplierCategories";
import { useDialogDraft } from "@/hooks/useDialogDraft";
import { AutosaveIndicator } from "@/components/ui/AutosaveIndicator";
import { toast as sonnerToast } from "sonner";

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

export default function FornecedorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>({});

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["fornecedor", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (supplier && !editing) {
      setForm({
        ...supplier,
        ...normalizeSupplierTaxonomy(
          supplier.supplier_type,
          supplier.supplier_subcategory,
        ),
      });
    }
  }, [supplier, editing]);

  // Autosave the in-progress edits to localStorage so the user doesn't lose data
  // if the tab is closed/refreshed mid-edit. Only active while in edit mode.
  const {
    restored: draftRestored,
    clearDraft,
    lastSavedAt: draftLastSavedAt,
  } = useDialogDraft<Partial<Supplier>>({
    key: `fornecedor-edit-${id || "new"}`,
    enabled: editing,
    values: form,
    isDirty: () => editing, // any edit-mode value is worth persisting
    onRestore: (draft) => {
      setForm((prev) => ({ ...prev, ...draft }));
    },
  });

  useEffect(() => {
    if (draftRestored) {
      sonnerToast.info("Rascunho restaurado", {
        description:
          "Recuperamos as edições que você havia feito neste fornecedor.",
        duration: 4000,
      });
    }
  }, [draftRestored]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      const { error } = await supabase
        .from("fornecedores")
        .update(data as any)
        .eq("id", id!);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["fornecedor", id] });
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({ title: "Fornecedor atualizado" });
      trackAmplitude("Supplier Saved", {
        mode: "update",
        supplier_id: id ?? null,
        supplier_type: data?.supplier_type ?? null,
        supplier_subcategory: data?.supplier_subcategory ?? null,
      });
      clearDraft();
      setEditing(false);
    },
    onError: (err: Error) =>
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("fornecedores")
        .delete()
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({ title: "Fornecedor removido" });
      navigate("/gestao/fornecedores");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeFunction<{
        success: boolean;
        target_id: string;
      }>("sync-suppliers-outbound", { supplier_id: id });
      if (error)
        throw new Error(
          typeof error === "string" ? error : "Erro na sincronização",
        );
      return data;
    },
    onSuccess: () => {
      toast({ title: "Fornecedor sincronizado com Envision" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao sincronizar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const startEdit = () => {
    if (supplier) {
      setForm({
        ...supplier,
        ...normalizeSupplierTaxonomy(
          supplier.supplier_type,
          supplier.supplier_subcategory,
        ),
      });
    }
    setEditing(true);
  };

  const cancelEdit = () => {
    if (supplier) {
      setForm({
        ...supplier,
        ...normalizeSupplierTaxonomy(
          supplier.supplier_type,
          supplier.supplier_subcategory,
        ),
      });
    }
    clearDraft();
    setEditing(false);
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
    delete (payload as any).id;
    delete (payload as any).created_at;
    if (
      payload.prazo_entrega_dias === undefined ||
      payload.prazo_entrega_dias === null
    )
      delete payload.prazo_entrega_dias;
    if (payload.nota_avaliacao === undefined || payload.nota_avaliacao === null)
      delete payload.nota_avaliacao;
    saveMutation.mutate(payload);
  };

  const renderStars = (rating: number | null) => {
    if (!rating)
      return (
        <span className="text-muted-foreground text-sm">Sem avaliação</span>
      );
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
        <span className="ml-1.5 text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <PageSkeleton metrics={false} content="cards" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Building2}
          title="Fornecedor não encontrado"
          description="O cadastro solicitado não existe ou foi removido."
          action={{
            label: "Voltar para fornecedores",
            onClick: () => navigate("/gestao/fornecedores"),
            icon: ArrowLeft,
            variant: "outline",
          }}
          size="md"
        />
      </div>
    );
  }

  const InfoItem = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: any;
    label: string;
    value: string | null | undefined;
  }) => {
    return (
      <div className="flex items-start gap-2.5">
        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={`text-sm ${!value ? "text-muted-foreground/50 italic" : ""}`}
          >
            {value || "Não informado"}
          </p>
        </div>
      </div>
    );
  };

  const s = editing ? form : supplier;

  const normalizedSupplierTaxonomy = normalizeSupplierTaxonomy(
    supplier.supplier_type,
    supplier.supplier_subcategory,
  );

  /** Best available category display */
  const categoryDisplay =
    normalizedSupplierTaxonomy.supplier_type &&
    normalizedSupplierTaxonomy.supplier_subcategory
      ? `${SUPPLIER_TYPE_LABELS[normalizedSupplierTaxonomy.supplier_type as SupplierType] || normalizedSupplierTaxonomy.supplier_type} › ${normalizedSupplierTaxonomy.supplier_subcategory}`
      : LEGACY_CATEGORY_LABELS[supplier.categoria] || supplier.categoria;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/gestao/fornecedores")}
          className="mt-0.5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={form.nome || ""}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              className="text-2xl font-bold h-auto py-1 px-2"
              placeholder="Nome do fornecedor"
            />
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {supplier.nome}
              </h1>
              <Badge
                variant={supplier.status === "ativo" ? "default" : "secondary"}
              >
                {supplier.status === "ativo" ? "Ativo" : "Inativo"}
              </Badge>
              <Badge variant="secondary">{categoryDisplay}</Badge>
            </div>
          )}
          {!editing && supplier.razao_social && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {supplier.razao_social}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <AutosaveIndicator
                lastSavedAt={draftLastSavedAt}
                className="hidden sm:inline-flex mr-2"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={cancelEdit}
              >
                <X className="h-4 w-4" /> Cancelar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSave}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4" />{" "}
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
                />
                {syncMutation.isPending ? "Sincronizando..." : "Sync Envision"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={startEdit}
              >
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Razão Social</Label>
                    <Input
                      value={form.razao_social || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, razao_social: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CNPJ/CPF</Label>
                    <Input
                      value={form.cnpj_cpf || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, cnpj_cpf: e.target.value }))
                      }
                    />
                  </div>
                  {/* New taxonomy selects */}
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
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                  <div className="space-y-1.5">
                    <Label>Endereço</Label>
                    <Input
                      value={form.endereco || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, endereco: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Razão Social
                    </p>
                    <p
                      className={`text-sm ${!supplier.razao_social ? "text-muted-foreground/50 italic" : ""}`}
                    >
                      {supplier.razao_social || "Não informado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CNPJ/CPF</p>
                    <p
                      className={`text-sm font-mono ${!supplier.cnpj_cpf ? "text-muted-foreground/50 italic" : ""}`}
                    >
                      {supplier.cnpj_cpf || "Não informado"}
                    </p>
                  </div>
                  <InfoItem
                    icon={Phone}
                    label="Telefone"
                    value={supplier.telefone}
                  />
                  <InfoItem icon={Mail} label="Email" value={supplier.email} />
                  <InfoItem icon={Globe} label="Site" value={supplier.site} />
                  <InfoItem
                    icon={MapPin}
                    label="Endereço"
                    value={supplier.endereco}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem
                      icon={MapPin}
                      label="Cidade"
                      value={supplier.cidade}
                    />
                    <InfoItem
                      icon={MapPin}
                      label="Estado"
                      value={supplier.estado}
                    />
                  </div>
                  <InfoItem icon={MapPin} label="CEP" value={supplier.cep} />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados Comerciais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
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
                    <Label>Produtos / Serviços</Label>
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
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Avaliação</p>
                    <div className="mt-1">
                      {renderStars(supplier.nota_avaliacao)}
                    </div>
                  </div>
                  <InfoItem
                    icon={Clock}
                    label="Prazo de Entrega"
                    value={
                      supplier.prazo_entrega_dias
                        ? `${supplier.prazo_entrega_dias} dias`
                        : null
                    }
                  />
                  <InfoItem
                    icon={CreditCard}
                    label="Condições de Pagamento"
                    value={supplier.condicoes_pagamento}
                  />
                  {supplier.produtos_servicos && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Produtos / Serviços
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {supplier.produtos_servicos}
                      </p>
                    </div>
                  )}
                  {supplier.observacoes && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Observações
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {supplier.observacoes}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="precos">
                <TabsList className="mb-4">
                  <TabsTrigger value="precos">Tabela de Preços</TabsTrigger>
                  <TabsTrigger value="anexos">Anexos</TabsTrigger>
                </TabsList>
                <TabsContent value="precos">
                  <SupplierPricesTab
                    fornecedorId={supplier.id}
                    fornecedorNome={supplier.nome}
                  />
                </TabsContent>
                <TabsContent value="anexos">
                  <SupplierAttachmentsTab fornecedorId={supplier.id} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Compras</CardTitle>
            </CardHeader>
            <CardContent>
              <SupplierPurchaseHistoryTab fornecedorId={supplier.id} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir este fornecedor? Esta ação não pode
            ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
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
