import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Pencil, Trash2, Star, Phone, Mail, MapPin, Globe, Building2, Clock, CreditCard,
} from "lucide-react";
import { SupplierPricesTab } from "@/components/fornecedores/SupplierPricesTab";
import { SupplierAttachmentsTab } from "@/components/fornecedores/SupplierAttachmentsTab";

type SupplierCategory = "materiais" | "mao_de_obra" | "servicos" | "equipamentos" | "outros";

interface Supplier {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  categoria: SupplierCategory;
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

const CATEGORY_LABELS: Record<SupplierCategory, string> = {
  materiais: "Materiais",
  mao_de_obra: "Mão de Obra",
  servicos: "Serviços",
  equipamentos: "Equipamentos",
  outros: "Outros",
};

const CATEGORY_COLORS: Record<SupplierCategory, string> = {
  materiais: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  mao_de_obra: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  servicos: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  equipamentos: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  outros: "bg-muted text-muted-foreground",
};

export default function FornecedorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
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

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      const { error } = await supabase.from("fornecedores").update(data as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedor", id] });
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({ title: "Fornecedor atualizado" });
      setEditOpen(false);
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast({ title: "Fornecedor removido" });
      navigate("/gestao/fornecedores");
    },
  });

  const openEdit = () => {
    if (supplier) setForm({ ...supplier });
    setEditOpen(true);
  };

  const handleSave = () => {
    if (!form.nome?.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    const payload = { ...form };
    delete (payload as any).id;
    delete (payload as any).created_at;
    if (!payload.prazo_entrega_dias) delete payload.prazo_entrega_dias;
    if (!payload.nota_avaliacao) delete payload.nota_avaliacao;
    saveMutation.mutate(payload);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground text-sm">Sem avaliação</span>;
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Fornecedor não encontrado.
        <Button variant="link" onClick={() => navigate("/gestao/fornecedores")}>Voltar</Button>
      </div>
    );
  }

  const InfoItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-2.5">
        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gestao/fornecedores")} className="mt-0.5">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{supplier.nome}</h1>
            <Badge variant={supplier.status === "ativo" ? "default" : "secondary"}>
              {supplier.status === "ativo" ? "Ativo" : "Inativo"}
            </Badge>
            <Badge variant="secondary" className={CATEGORY_COLORS[supplier.categoria]}>
              {CATEGORY_LABELS[supplier.categoria]}
            </Badge>
          </div>
          {supplier.razao_social && (
            <p className="text-sm text-muted-foreground mt-0.5">{supplier.razao_social}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact & ID */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supplier.cnpj_cpf && (
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ/CPF</p>
                  <p className="text-sm font-mono">{supplier.cnpj_cpf}</p>
                </div>
              )}
              <InfoItem icon={Phone} label="Telefone" value={supplier.telefone} />
              <InfoItem icon={Mail} label="Email" value={supplier.email} />
              <InfoItem icon={Globe} label="Site" value={supplier.site} />
              <InfoItem
                icon={MapPin}
                label="Localização"
                value={
                  [supplier.endereco, supplier.cidade, supplier.estado, supplier.cep]
                    .filter(Boolean)
                    .join(", ") || null
                }
              />
            </CardContent>
          </Card>

          {/* Commercial */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados Comerciais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Avaliação</p>
                <div className="mt-1">{renderStars(supplier.nota_avaliacao)}</div>
              </div>
              <InfoItem icon={Clock} label="Prazo de Entrega" value={supplier.prazo_entrega_dias ? `${supplier.prazo_entrega_dias} dias` : null} />
              <InfoItem icon={CreditCard} label="Condições de Pagamento" value={supplier.condicoes_pagamento} />
              {supplier.produtos_servicos && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Produtos / Serviços</p>
                  <p className="text-sm whitespace-pre-wrap">{supplier.produtos_servicos}</p>
                </div>
              )}
              {supplier.observacoes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm whitespace-pre-wrap">{supplier.observacoes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: prices & attachments */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="precos">
                <TabsList className="mb-4">
                  <TabsTrigger value="precos">Tabela de Preços</TabsTrigger>
                  <TabsTrigger value="anexos">Anexos</TabsTrigger>
                </TabsList>
                <TabsContent value="precos">
                  <SupplierPricesTab fornecedorId={supplier.id} />
                </TabsContent>
                <TabsContent value="anexos">
                  <SupplierAttachmentsTab fornecedorId={supplier.id} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => !v && setEditOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.nome || ""} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Razão Social</Label>
                <Input value={form.razao_social || ""} onChange={(e) => setForm((p) => ({ ...p, razao_social: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>CNPJ/CPF</Label>
                <Input value={form.cnpj_cpf || ""} onChange={(e) => setForm((p) => ({ ...p, cnpj_cpf: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.categoria || "outros"} onValueChange={(v) => setForm((p) => ({ ...p, categoria: v as SupplierCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status || "ativo"} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.telefone || ""} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email || ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Site</Label>
                <Input value={form.site || ""} onChange={(e) => setForm((p) => ({ ...p, site: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.endereco || ""} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={form.cidade || ""} onChange={(e) => setForm((p) => ({ ...p, cidade: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Input value={form.estado || ""} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} maxLength={2} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Produtos / Serviços</Label>
              <Textarea value={form.produtos_servicos || ""} onChange={(e) => setForm((p) => ({ ...p, produtos_servicos: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Condições de Pagamento</Label>
                <Input value={form.condicoes_pagamento || ""} onChange={(e) => setForm((p) => ({ ...p, condicoes_pagamento: e.target.value }))} placeholder="Ex: 30/60/90 dias" />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo de Entrega (dias)</Label>
                <Input type="number" value={form.prazo_entrega_dias || ""} onChange={(e) => setForm((p) => ({ ...p, prazo_entrega_dias: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Nota (0 a 5)</Label>
                <Input type="number" min={0} max={5} step={0.5} value={form.nota_avaliacao ?? ""} onChange={(e) => setForm((p) => ({ ...p, nota_avaliacao: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ""} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}