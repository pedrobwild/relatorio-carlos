import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, X, Check, ArrowRight } from "lucide-react";
import { SendToProjectDialog } from "./SendToProjectDialog";

interface PriceItem {
  id: string;
  fornecedor_id: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;
  data_validade: string | null;
  observacoes: string | null;
}

interface Props {
  fornecedorId: string;
  fornecedorNome?: string;
}

const emptyPrice = (fornecedorId: string): Partial<PriceItem> => ({
  fornecedor_id: fornecedorId,
  descricao: "",
  unidade: "un",
  preco_unitario: 0,
  data_validade: null,
  observacoes: null,
});

export function SupplierPricesTab({
  fornecedorId,
  fornecedorNome = "",
}: Props) {
  const qc = useQueryClient();
  const qk = ["fornecedor_precos", fornecedorId];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PriceItem>>(
    emptyPrice(fornecedorId),
  );
  const [adding, setAdding] = useState(false);
  const [sendItem, setSendItem] = useState<PriceItem | null>(null);

  const { data: prices = [], isLoading } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedor_precos")
        .select("*")
        .eq("fornecedor_id", fornecedorId)
        .order("descricao");
      if (error) throw error;
      return data as PriceItem[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (item: Partial<PriceItem>) => {
      if (editingId) {
        const { error } = await supabase
          .from("fornecedor_precos")
          .update(item as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fornecedor_precos")
          .insert(item as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: editingId ? "Preço atualizado" : "Preço adicionado" });
      cancelEdit();
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fornecedor_precos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: "Preço removido" });
    },
  });

  const startEdit = (p: PriceItem) => {
    setEditingId(p.id);
    setForm({ ...p });
    setAdding(false);
  };

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setForm(emptyPrice(fornecedorId));
  };

  const cancelEdit = () => {
    setAdding(false);
    setEditingId(null);
    setForm(emptyPrice(fornecedorId));
  };

  const handleSave = () => {
    if (!form.descricao?.trim())
      return toast({ title: "Descrição obrigatória", variant: "destructive" });
    if (!form.preco_unitario || form.preco_unitario <= 0)
      return toast({ title: "Preço inválido", variant: "destructive" });
    const payload = { ...form };
    if (!payload.data_validade) delete payload.data_validade;
    if (!payload.observacoes) delete payload.observacoes;
    saveMut.mutate(payload);
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v);

  const renderForm = () => (
    <TableRow>
      <TableCell>
        <Input
          placeholder="Descrição do item"
          value={form.descricao || ""}
          onChange={(e) =>
            setForm((p) => ({ ...p, descricao: e.target.value }))
          }
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell>
        <Input
          placeholder="un"
          value={form.unidade || ""}
          onChange={(e) => setForm((p) => ({ ...p, unidade: e.target.value }))}
          className="h-8 text-sm w-20"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0,00"
          value={form.preco_unitario || ""}
          onChange={(e) =>
            setForm((p) => ({ ...p, preco_unitario: Number(e.target.value) }))
          }
          className="h-8 text-sm w-28"
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={form.data_validade || ""}
          onChange={(e) =>
            setForm((p) => ({ ...p, data_validade: e.target.value || null }))
          }
          className="h-8 text-sm w-36"
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSave}
            disabled={saveMut.isPending}
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={cancelEdit}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Tabela de Preços</Label>
        {!adding && !editingId && (
          <Button
            variant="outline"
            size="sm"
            onClick={startAdd}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-20">Unid.</TableHead>
              <TableHead className="w-28">Preço Unit.</TableHead>
              <TableHead className="w-36">Validade</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {adding && renderForm()}
            {prices.map((p) =>
              editingId === p.id ? (
                renderForm()
              ) : (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.descricao}</TableCell>
                  <TableCell className="text-sm">{p.unidade}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {fmt(p.preco_unitario)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.data_validade
                      ? new Date(
                          p.data_validade + "T12:00:00",
                        ).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary"
                        title="Enviar para Obra"
                        onClick={() => setSendItem(p)}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMut.mutate(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ),
            )}
            {prices.length === 0 && !adding && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground text-sm py-6"
                >
                  Nenhum preço cadastrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {sendItem && (
        <SendToProjectDialog
          open={!!sendItem}
          onOpenChange={(open) => !open && setSendItem(null)}
          priceItem={sendItem}
          fornecedorNome={fornecedorNome}
        />
      )}
    </div>
  );
}
