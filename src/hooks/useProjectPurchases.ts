import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useMemo, useEffect } from 'react';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_TIMING } from '@/lib/queryClient';

export type PurchaseStatus = 'pending' | 'awaiting_approval' | 'approved' | 'purchased' | 'ordered' | 'in_transit' | 'delivered' | 'sent_to_site' | 'cancelled';
export type PurchaseType = 'produto' | 'prestador';

export interface ProjectPurchase {
  id: string;
  project_id: string;
  activity_id: string | null;
  fornecedor_id: string | null;
  orcamento_item_id: string | null;
  item_name: string;
  brand: string | null;
  description: string | null;
  quantity: number;
  unit: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  category: string | null;
  planned_purchase_date: string | null;
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
  start_date: string | null;
  end_date: string | null;
  contract_file_path: string | null;
  purchase_type: PurchaseType;
  delivery_address: string | null;
  delivery_location: string | null;
  stock_entry_date: string | null;
  stock_exit_date: string | null;
  shipping_cost: number | null;
  invoice_file_path: string | null;
  payment_due_date: string | null;
  payment_method: string | null;
  pix_key: string | null;
  boleto_file_path: string | null;
  boleto_code: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseInput {
  project_id: string;
  activity_id?: string | null;
  fornecedor_id?: string | null;
  item_name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  category?: string | null;
  planned_purchase_date?: string | null;
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
  start_date?: string | null;
  end_date?: string | null;
  contract_file_path?: string | null;
  purchase_type?: PurchaseType;
  delivery_address?: string | null;
}



export type UrgencyLevel = 'overdue' | 'critical' | 'warning' | 'approaching' | 'normal';

export interface AlertThresholds {
  overdue: ProjectPurchase[];
  critical: ProjectPurchase[];
  warning: ProjectPurchase[];
  approaching: ProjectPurchase[];
}

export function useProjectPurchases(projectId: string | undefined, showAlerts = false) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: purchases = [], isLoading, error, isError } = useQuery({
    queryKey: queryKeys.purchases.list(projectId),
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
    staleTime: QUERY_TIMING.purchases.staleTime,
    gcTime: QUERY_TIMING.purchases.gcTime,
  });

  // Calculate today's date at midnight for consistent comparisons
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Calculate alert thresholds
  const alertThresholds: AlertThresholds = useMemo(() => {
    const pendingPurchases = purchases.filter(p => 
      p.status === 'pending' || p.status === 'ordered' || p.status === 'in_transit'
    );
    
    const overdue = pendingPurchases.filter(p => {
      const requiredDate = new Date(p.required_by_date + 'T00:00:00');
      return requiredDate < today;
    });

    const critical = pendingPurchases.filter(p => {
      const requiredDate = new Date(p.required_by_date + 'T00:00:00');
      const daysUntil = Math.ceil((requiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 3;
    });

    const warning = pendingPurchases.filter(p => {
      const requiredDate = new Date(p.required_by_date + 'T00:00:00');
      const daysUntil = Math.ceil((requiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil > 3 && daysUntil <= 7;
    });

    const approaching = pendingPurchases.filter(p => {
      const requiredDate = new Date(p.required_by_date + 'T00:00:00');
      const daysUntil = Math.ceil((requiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil > 7 && daysUntil <= 14;
    });

    return { overdue, critical, warning, approaching };
  }, [purchases, today]);

  // Show toast alerts when enabled
  useEffect(() => {
    if (!showAlerts || isLoading || purchases.length === 0) return;

    const { overdue, critical, warning } = alertThresholds;

    if (overdue.length > 0) {
      toast.error(`${overdue.length} item(s) com prazo de compra vencido!`, {
        description: overdue.map(p => p.item_name).slice(0, 3).join(", ") + (overdue.length > 3 ? "..." : ""),
        duration: 8000,
      });
    }

    if (critical.length > 0) {
      toast.warning(`${critical.length} item(s) com prazo crítico (≤3 dias)`, {
        description: critical.map(p => p.item_name).slice(0, 3).join(", ") + (critical.length > 3 ? "..." : ""),
        duration: 6000,
      });
    }

    if (warning.length > 0) {
      toast.info(`${warning.length} item(s) com prazo próximo (≤7 dias)`, {
        description: warning.map(p => p.item_name).slice(0, 3).join(", ") + (warning.length > 3 ? "..." : ""),
        duration: 5000,
      });
    }
  }, [showAlerts, isLoading, purchases.length, alertThresholds]);

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
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.list(projectId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.list(projectId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.list(projectId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.list(projectId) });
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
    const requiredDate = new Date(p.required_by_date + 'T00:00:00');
    return requiredDate < today;
  });

  const totalEstimatedCost = purchases
    .filter(p => p.status !== 'cancelled')
    .reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  // Helper function to get urgency level for a purchase
  const getUrgencyLevel = (purchase: ProjectPurchase): UrgencyLevel => {
    if (purchase.status === 'delivered' || purchase.status === 'cancelled') return 'normal';
    
    const requiredDate = new Date(purchase.required_by_date + 'T00:00:00');
    const daysUntil = Math.ceil((requiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 3) return 'critical';
    if (daysUntil <= 7) return 'warning';
    if (daysUntil <= 14) return 'approaching';
    return 'normal';
  };

  const getDaysUntilDeadline = (purchase: ProjectPurchase): number => {
    const requiredDate = new Date(purchase.required_by_date + 'T00:00:00');
    return Math.ceil((requiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return {
    purchases,
    isLoading,
    error,
    isError,
    addPurchase,
    updatePurchase,
    deletePurchase,
    updateStatus,
    pendingPurchases,
    orderedPurchases,
    deliveredPurchases,
    overduePurchases,
    totalEstimatedCost,
    alertThresholds,
    getUrgencyLevel,
    getDaysUntilDeadline,
  };
}
