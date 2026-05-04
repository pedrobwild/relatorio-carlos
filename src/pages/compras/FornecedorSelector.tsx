import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QuickCreateFornecedor } from "./QuickCreateFornecedor";

interface Props {
  fornecedorId: string | undefined;
  onFornecedorChange: (id: string, nome: string) => void;
  startDate: string;
  endDate: string;
  currentPurchaseId?: string; // exclude current purchase from conflict check
}

interface Conflict {
  project_name: string;
  start_date: string;
  end_date: string;
  item_name: string;
}

export function FornecedorSelector({
  fornecedorId,
  onFornecedorChange,
  startDate,
  endDate,
  currentPurchaseId,
}: Props) {
  // Fetch prestador-type fornecedores (include rascunhos so quick-created appears immediately)
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-prestadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome, status")
        .eq("supplier_type", "prestador")
        .in("status", ["ativo", "rascunho"])
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Check for scheduling conflicts when a fornecedor and dates are selected
  const { data: conflicts = [] } = useQuery({
    queryKey: ["fornecedor-conflicts", fornecedorId, startDate, endDate],
    queryFn: async () => {
      if (!fornecedorId || !startDate || !endDate) return [];
      let query = supabase
        .from("project_purchases")
        .select(
          "id, item_name, start_date, end_date, project_id, projects!inner(name)",
        )
        .eq("fornecedor_id", fornecedorId)
        .eq("purchase_type", "prestador")
        .neq("status", "cancelled")
        .not("start_date", "is", null)
        .not("end_date", "is", null)
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      if (currentPurchaseId) {
        query = query.neq("id", currentPurchaseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        project_name: d.projects?.name || "Projeto",
        start_date: d.start_date,
        end_date: d.end_date,
        item_name: d.item_name,
      })) as Conflict[];
    },
    enabled: !!fornecedorId && !!startDate && !!endDate,
  });

  const fmtDate = (d: string) => {
    try {
      return format(parseISO(d), "dd/MM", { locale: ptBR });
    } catch {
      return d;
    }
  };

  return (
    <div className="col-span-2 space-y-1.5">
      <Label>Prestador (Cadastro) *</Label>
      <div className="flex gap-2 items-start">
        <Select
          value={fornecedorId || ""}
          onValueChange={(id) => {
            const f = fornecedores.find((f) => f.id === id);
            onFornecedorChange(id, f?.nome || "");
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecione um prestador cadastrado" />
          </SelectTrigger>
          <SelectContent>
            {fornecedores.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <span className="flex items-center gap-1.5">
                  {f.nome}
                  {f.status === "rascunho" && (
                    <span className="text-[9px] uppercase tracking-wide text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 px-1 py-0.5 rounded">
                      rascunho
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <QuickCreateFornecedor
          supplierType="prestador"
          onCreated={(id, nome) => onFornecedorChange(id, nome)}
          invalidateKeys={[["fornecedores-prestadores"]]}
        />
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--warning))]">
            <AlertTriangle className="h-3.5 w-3.5" />
            Conflito de agenda ({conflicts.length})
          </div>
          {conflicts.map((c, i) => (
            <p key={i} className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {c.project_name}
              </span>
              {" — "}
              {c.item_name} ({fmtDate(c.start_date)} – {fmtDate(c.end_date)})
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
