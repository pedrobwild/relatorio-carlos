import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';

export type StockMovementType = 'entrada' | 'saida' | 'perda' | 'sobra' | 'ajuste';

export interface StockMovement {
  id: string;
  project_id: string;
  stock_item_id: string;
  movement_type: StockMovementType;
  movement_date: string;
  quantity: number;
  signed_quantity: number;
  unit_cost: number | null;
  ambient: string | null;
  responsible: string | null;
  document_ref: string | null;
  cause: string | null;
  preventive_action: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // joined
  stock_item?: { id: string; name: string; code: string | null; unit: string };
}

export interface StockMovementInput {
  project_id: string;
  stock_item_id: string;
  movement_type: StockMovementType;
  movement_date: string;
  quantity: number;
  unit_cost?: number | null;
  ambient?: string | null;
  responsible?: string | null;
  document_ref?: string | null;
  cause?: string | null;
  preventive_action?: string | null;
  notes?: string | null;
}

export function useStockMovements(projectId: string | undefined, itemId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: movements = [], isLoading, error } = useQuery({
    queryKey: queryKeys.stock.movements(projectId, itemId),
    queryFn: async () => {
      if (!projectId) return [];
      let q = (supabase as any)
        .from('stock_movements')
        .select('*, stock_item:stock_items(id, name, code, unit)')
        .eq('project_id', projectId)
        .order('movement_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (itemId) q = q.eq('stock_item_id', itemId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as StockMovement[];
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });

  const createMovement = useMutation({
    mutationFn: async (input: StockMovementInput) => {
      if (!user) throw new Error('Usuário não autenticado');
      const { data, error } = await (supabase as any)
        .from('stock_movements')
        .insert({ ...input, created_by: user.id })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
      toast.success('Movimentação registrada');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar movimentação: ${err.message}`);
    },
  });

  const deleteMovement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('stock_movements')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
      toast.success('Movimentação excluída');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir: ${err.message}`);
    },
  });

  return { movements, isLoading, error, createMovement, deleteMovement };
}

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  perda: 'Perda',
  sobra: 'Sobra',
  ajuste: 'Ajuste',
};

/** Sinal visual (positivo / negativo) para a UI */
export function movementSign(type: StockMovementType): '+' | '-' | '±' {
  if (type === 'entrada' || type === 'sobra') return '+';
  if (type === 'saida' || type === 'perda') return '-';
  return '±';
}
