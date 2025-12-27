import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type PurchaseStatus = 'pending' | 'ordered' | 'in_transit' | 'delivered' | 'cancelled';

export interface ProjectPurchase {
  id: string;
  project_id: string;
  activity_id: string | null;
  item_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  estimated_cost: number | null;
  supplier_name: string | null;
  supplier_contact: string | null;
  lead_time_days: number;
  required_by_date: string;
  order_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  invoice_number: string | null;
  status: PurchaseStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseInput {
  project_id: string;
  activity_id?: string | null;
  item_name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  estimated_cost?: number | null;
  supplier_name?: string | null;
  supplier_contact?: string | null;
  lead_time_days: number;
  required_by_date: string;
  order_date?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  invoice_number?: string | null;
  status?: PurchaseStatus;
  notes?: string | null;
}

export function useProjectPurchases(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: purchases = [], isLoading, error } = useQuery({
    queryKey: ['project-purchases', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_purchases')
        .select('*')
        .eq('project_id', projectId)
        .order('required_by_date', { ascending: true });

      if (error) throw error;
      return data as ProjectPurchase[];
    },
    enabled: !!projectId,
  });

  const addPurchase = useMutation({
    mutationFn: async (input: PurchaseInput) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('project_purchases')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-purchases', projectId] });
      toast.success('Item de compra adicionado');
    },
    onError: (error) => {
      console.error('Error adding purchase:', error);
      toast.error('Erro ao adicionar item de compra');
    },
  });

  const updatePurchase = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjectPurchase> & { id: string }) => {
      const { data, error } = await supabase
        .from('project_purchases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-purchases', projectId] });
      toast.success('Item de compra atualizado');
    },
    onError: (error) => {
      console.error('Error updating purchase:', error);
      toast.error('Erro ao atualizar item de compra');
    },
  });

  const deletePurchase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_purchases')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-purchases', projectId] });
      toast.success('Item de compra removido');
    },
    onError: (error) => {
      console.error('Error deleting purchase:', error);
      toast.error('Erro ao remover item de compra');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, additionalData }: { 
      id: string; 
      status: PurchaseStatus;
      additionalData?: Partial<ProjectPurchase>;
    }) => {
      const updates: Partial<ProjectPurchase> = { status, ...additionalData };
      
      // Auto-fill dates based on status
      if (status === 'ordered' && !additionalData?.order_date) {
        updates.order_date = new Date().toISOString().split('T')[0];
      }
      if (status === 'delivered' && !additionalData?.actual_delivery_date) {
        updates.actual_delivery_date = new Date().toISOString().split('T')[0];
      }

      const { data, error } = await supabase
        .from('project_purchases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-purchases', projectId] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    },
  });

  // Computed values
  const pendingPurchases = purchases.filter(p => p.status === 'pending');
  const orderedPurchases = purchases.filter(p => p.status === 'ordered' || p.status === 'in_transit');
  const deliveredPurchases = purchases.filter(p => p.status === 'delivered');
  
  const overduePurchases = purchases.filter(p => {
    if (p.status === 'delivered' || p.status === 'cancelled') return false;
    const requiredDate = new Date(p.required_by_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return requiredDate < today;
  });

  const totalEstimatedCost = purchases
    .filter(p => p.status !== 'cancelled')
    .reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  return {
    purchases,
    isLoading,
    error,
    addPurchase,
    updatePurchase,
    deletePurchase,
    updateStatus,
    pendingPurchases,
    orderedPurchases,
    deliveredPurchases,
    overduePurchases,
    totalEstimatedCost,
  };
}
