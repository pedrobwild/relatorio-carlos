import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';

export type StockCategory =
  | 'revestimento'
  | 'hidraulica'
  | 'eletrica'
  | 'pintura'
  | 'estrutural'
  | 'esquadrias'
  | 'louca_metal'
  | 'iluminacao'
  | 'ferragens'
  | 'consumiveis'
  | 'outros';

export type StockStatus = 'sem_estoque' | 'comprar' | 'ok';

export interface StockItem {
  id: string;
  project_id: string;
  code: string | null;
  name: string;
  description: string | null;
  category: StockCategory;
  unit: string;
  minimum_stock: number;
  unit_cost: number | null;
  default_location: string | null;
  supplier_name: string | null;
  supplier_contact: string | null;
  lead_time_days: number;
  fornecedor_id: string | null;
  notes: string | null;
  is_archived: boolean;
  current_stock: number;
  total_in: number;
  total_out: number;
  total_loss: number;
  total_surplus: number;
  status: StockStatus;
  stock_value: number;
  loss_value: number;
  created_at: string;
  updated_at: string;
}

export interface StockItemInput {
  project_id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  category: StockCategory;
  unit: string;
  minimum_stock: number;
  unit_cost?: number | null;
  default_location?: string | null;
  supplier_name?: string | null;
  supplier_contact?: string | null;
  lead_time_days?: number;
  notes?: string | null;
}

/**
 * Lista todos os itens de estoque do projeto, com saldo + status já calculados
 * pela view `stock_items_with_balance`.
 */
export function useStockItems(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: queryKeys.stock.items(projectId),
    queryFn: async () => {
      if (!projectId) return [];
      // O cast `any` é necessário até os types do Supabase serem regerados
      // após a migration. Após `npm run supabase:gen-types`, isto fica tipado.
      const { data, error } = await (supabase as any)
        .from('stock_items_with_balance')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_archived', false)
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as StockItem[];
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const createItem = useMutation({
    mutationFn: async (input: StockItemInput) => {
      if (!user) throw new Error('Usuário não autenticado');
      const payload = {
        ...input,
        lead_time_days: input.lead_time_days ?? 0,
        created_by: user.id,
      };
      const { data, error } = await (supabase as any)
        .from('stock_items')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.items(projectId) });
      toast.success('Item cadastrado');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cadastrar item: ${err.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StockItemInput> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('stock_items')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.items(projectId) });
      toast.success('Item atualizado');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar item: ${err.message}`);
    },
  });

  const archiveItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('stock_items')
        .update({ is_archived: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.items(projectId) });
      toast.success('Item arquivado');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao arquivar: ${err.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('stock_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.items(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.movements(projectId) });
      toast.success('Item excluído');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir: ${err.message}`);
    },
  });

  return {
    items,
    isLoading,
    error,
    createItem,
    updateItem,
    archiveItem,
    deleteItem,
  };
}

export const STOCK_CATEGORY_LABELS: Record<StockCategory, string> = {
  revestimento: 'Revestimento',
  hidraulica: 'Hidráulica',
  eletrica: 'Elétrica',
  pintura: 'Pintura',
  estrutural: 'Estrutural',
  esquadrias: 'Esquadrias',
  louca_metal: 'Louças e Metais',
  iluminacao: 'Iluminação',
  ferragens: 'Ferragens',
  consumiveis: 'Consumíveis',
  outros: 'Outros',
};

export const STOCK_CATEGORIES: StockCategory[] = [
  'revestimento',
  'hidraulica',
  'eletrica',
  'pintura',
  'estrutural',
  'esquadrias',
  'louca_metal',
  'iluminacao',
  'ferragens',
  'consumiveis',
  'outros',
];

export const STOCK_UNITS = ['un', 'm²', 'm³', 'm', 'kg', 'L', 'pç', 'lata', 'saco', 'cx', 'rolo', 'par'];
