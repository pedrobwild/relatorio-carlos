/**
 * Hook do módulo de Marcenaria
 * -----------------------------------------------------------
 * Gerencia itens de marcenaria de uma obra — armários, painéis,
 * móveis sob medida. Cada item tem status, valores e um
 * mini-cronograma com datas planejadas vs reais para as 4
 * etapas do processo: aprovação, produção, entrega e instalação.
 *
 * RLS da tabela `marcenaria_items`:
 *   - SELECT: project_members ∪ project_customers ∪ is_staff
 *   - INSERT/UPDATE/DELETE: apenas is_staff
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const MARCENARIA_STATUS = [
  "orcamento",
  "aprovado",
  "producao",
  "entregue",
  "instalado",
] as const;

export type MarcenariaStatus = (typeof MARCENARIA_STATUS)[number];

export const MARCENARIA_STATUS_LABELS: Record<MarcenariaStatus, string> = {
  orcamento: "Orçamento",
  aprovado: "Aprovado",
  producao: "Produção",
  entregue: "Entregue",
  instalado: "Instalado",
};

export interface MarcenariaItem {
  id: string;
  project_id: string;
  name: string;
  supplier: string | null;
  status: MarcenariaStatus;
  valor_orcado: number | null;
  valor_aprovado: number | null;
  observacoes: string | null;
  planned_approval_date: string | null;
  actual_approval_date: string | null;
  planned_production_start: string | null;
  actual_production_start: string | null;
  planned_delivery_date: string | null;
  actual_delivery_date: string | null;
  planned_installation_date: string | null;
  actual_installation_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type MarcenariaItemInput = Partial<
  Omit<MarcenariaItem, "id" | "created_at" | "updated_at" | "created_by">
> & {
  name: string;
  project_id: string;
};

export type MarcenariaItemUpdate = Partial<
  Omit<MarcenariaItem, "id" | "project_id" | "created_at" | "updated_at" | "created_by">
>;

const TABLE = "marcenaria_items";

export function marcenariaKey(projectId: string | undefined) {
  return ["marcenaria-items", projectId] as const;
}

export function useMarcenaria(projectId: string | undefined) {
  const qc = useQueryClient();
  const queryKey = marcenariaKey(projectId);

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<MarcenariaItem[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        // Tipos ainda não regenerados; cast defensivo para evitar erro de typing.
        .from(TABLE as never)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as MarcenariaItem[];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: MarcenariaItemInput): Promise<MarcenariaItem> => {
      const { data, error } = await supabase
        .from(TABLE as never)
        .insert(payload as never)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as MarcenariaItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Item de marcenaria criado");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erro ao criar item";
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: MarcenariaItemUpdate;
    }): Promise<MarcenariaItem> => {
      const { data, error } = await supabase
        .from(TABLE as never)
        .update(patch as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as MarcenariaItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Item atualizado");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erro ao atualizar item";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(TABLE as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Item removido");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erro ao remover item";
      toast.error(message);
    },
  });

  return {
    items,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
