import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const schema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Nome obrigatório (mín. 2)")
    .max(120, "Máx. 120 caracteres"),
  telefone: z.string().trim().max(40).optional().or(z.literal("")),
});

interface Props {
  supplierType: "prestadores" | "produtos";
  onCreated: (id: string, nome: string) => void;
  /** Optional initial name (e.g., when user typed in a search box). */
  defaultName?: string;
  /** Query keys to invalidate after creation so selectors refresh. */
  invalidateKeys?: unknown[][];
}

/**
 * Minimal "draft" supplier creation: only nome + telefone.
 * Marks as 'rascunho' status so the supplier list shows a badge to complete later.
 */
export function QuickCreateFornecedor({
  supplierType,
  onCreated,
  defaultName = "",
  invalidateKeys = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(defaultName);
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    const parsed = schema.safeParse({ nome, telefone });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Dados inválidos");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("fornecedores")
        .insert({
          nome: parsed.data.nome,
          telefone: parsed.data.telefone || null,
          supplier_type: supplierType,
          status: "rascunho",
          categoria:
            supplierType === "prestadores" ? "servicos" : "materiais",
        })
        .select("id, nome")
        .single();

      if (error) throw error;
      toast.success("Cadastro rápido salvo. Complete os dados depois.");
      onCreated(data.id, data.nome);
      // Invalidate caches so selectors refresh
      invalidateKeys.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      setNome("");
      setTelefone("");
      setOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 px-2 shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Novo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Cadastro rápido</p>
            <p className="text-xs text-muted-foreground">
              Salva como rascunho. Complete os dados depois em Fornecedores.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-nome" className="text-xs">
              Nome *
            </Label>
            <Input
              id="qc-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={
                supplierType === "prestadores"
                  ? "Ex: João Pintor"
                  : "Ex: Casa do Construtor"
              }
              autoFocus
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-tel" className="text-xs">
              Telefone (opcional)
            </Label>
            <Input
              id="qc-tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-0000"
              maxLength={40}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || !nome.trim()}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Salvar rascunho
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
