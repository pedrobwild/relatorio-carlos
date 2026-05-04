import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

interface PriceItem {
  id: string;
  fornecedor_id: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceItem: PriceItem;
  fornecedorNome: string;
}

export function SendToProjectDialog({
  open,
  onOpenChange,
  priceItem,
  fornecedorNome,
}: Props) {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const requiredByDate = new Date(Date.now() + 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [requiredBy, setRequiredBy] = useState(requiredByDate);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("project_purchases").insert({
        project_id: projectId,
        fornecedor_id: priceItem.fornecedor_id,
        item_name: priceItem.descricao,
        unit: priceItem.unidade,
        quantity,
        estimated_cost: priceItem.preco_unitario * quantity,
        supplier_name: fornecedorNome,
        required_by_date: requiredBy,
        lead_time_days: 7,
        notes: notes || null,
        status: "pending",
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedor-purchases"] });
      toast({ title: "Item enviado para a obra com sucesso" });
      onOpenChange(false);
      setProjectId("");
      setQuantity(1);
      setNotes("");
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const estimatedTotal = priceItem.preco_unitario * quantity;
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Enviar para Obra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Item info */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-medium">{priceItem.descricao}</p>
            <p className="text-xs text-muted-foreground">
              {fmt(priceItem.preco_unitario)} / {priceItem.unidade} ·{" "}
              {fornecedorNome}
            </p>
          </div>

          {/* Project select */}
          <div className="space-y-1.5">
            <Label>Obra de destino *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a obra" />
              </SelectTrigger>
              <SelectContent position="popper">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Number(e.target.value)))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Necessário até</Label>
              <Input
                type="date"
                value={requiredBy}
                onChange={(e) => setRequiredBy(e.target.value)}
              />
            </div>
          </div>

          {/* Estimated total */}
          <div className="rounded-lg border bg-primary/5 p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Custo estimado
            </span>
            <span className="text-lg font-semibold text-primary">
              {fmt(estimatedTotal)}
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => sendMut.mutate()}
            disabled={!projectId || sendMut.isPending}
            className="gap-1.5"
          >
            <ArrowRight className="h-4 w-4" />
            {sendMut.isPending ? "Enviando..." : "Enviar para Obra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
