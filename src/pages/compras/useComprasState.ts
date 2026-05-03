import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, differenceInDays, parseISO, subDays } from 'date-fns';
import { useProjectPurchases, type ProjectPurchase, type PurchaseInput, type PurchaseStatus, type PurchaseType } from '@/hooks/useProjectPurchases';
import { useProjectActivities } from '@/hooks/useProjectActivities';
import { supabase } from '@/integrations/supabase/client';
import { emptyPurchase } from './types';
import type { PaymentInstallment } from './PaymentScheduleSection';
import { useDialogDraft } from '@/hooks/useDialogDraft';
import { toast } from 'sonner';

export function useComprasState(purchaseTypeFilter?: PurchaseType) {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    purchases, isLoading, addPurchase, updatePurchase, deletePurchase, updateStatus,
    pendingPurchases, orderedPurchases, deliveredPurchases, overduePurchases,
    totalEstimatedCost, alertThresholds, getDaysUntilDeadline,
  } = useProjectPurchases(projectId, true);
  const { activities } = useProjectActivities(projectId);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterActivity, setFilterActivity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<ProjectPurchase | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PurchaseInput>>(emptyPurchase);
  const [paymentInstallments, setPaymentInstallments] = useState<PaymentInstallment[]>([]);

  // Autosave draft for new purchases (per project + type). Editing existing purchases
  // is not drafted — those are full server-backed records.
  const draftKey = `compras-${projectId || 'no-project'}-${purchaseTypeFilter || 'all'}`;
  const draftEnabled = isDialogOpen && !editingPurchase;
  const { restored: draftRestored, clearDraft, lastSavedAt: draftLastSavedAt } = useDialogDraft<{
    formData: Partial<PurchaseInput>;
    paymentInstallments: PaymentInstallment[];
  }>({
    key: draftKey,
    enabled: draftEnabled,
    values: { formData, paymentInstallments },
    isDirty: ({ formData: f }) =>
      !!(f.item_name?.trim() || f.description?.trim() || f.supplier_name?.trim() || f.notes?.trim() || f.estimated_cost),
    onRestore: (draft) => {
      if (draft.formData) {
        setFormData((prev) => ({ ...prev, ...draft.formData }));
      }
      if (draft.paymentInstallments && Array.isArray(draft.paymentInstallments)) {
        setPaymentInstallments(draft.paymentInstallments);
      }
    },
  });

  useEffect(() => {
    if (draftRestored) {
      toast.info('Rascunho restaurado', {
        description: 'Recuperamos os dados que você havia preenchido.',
        duration: 4000,
      });
    }
  }, [draftRestored]);

  const handleCategoryFilterChange = (value: string) => {
    setFilterCategory(value);
    // Reset subcategory when category changes
    setFilterSubcategory('all');
  };

  const clearAllFilters = () => {
    setFilterStatus('all');
    setFilterActivity('all');
    setFilterCategory('all');
    setFilterSubcategory('all');
  };

  /**
   * Filtering strategy:
   * - filterCategory / filterSubcategory operate on the purchase's `category` field,
   *   which stores the item subcategory (e.g., "Eletrodomésticos", "Marcenaria").
   * - We infer the supplier_type from the category value using the taxonomy.
   * - This avoids needing a JOIN to fornecedores for basic filtering.
   */
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // Filter by purchase type if specified
      if (purchaseTypeFilter && (p.purchase_type || 'produto') !== purchaseTypeFilter) return false;
      
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterActivity !== 'all' && p.activity_id !== filterActivity) return false;
      
      // Category filter: now matches purchase_type ('produto' | 'prestador')
      if (filterCategory !== 'all') {
        if ((p.purchase_type || 'produto') !== filterCategory) return false;
      }
      
      // Subcategory filter: exact match on purchase category
      if (filterSubcategory !== 'all') {
        if (p.category !== filterSubcategory) return false;
      }
      
      return true;
    });
  }, [purchases, purchaseTypeFilter, filterStatus, filterActivity, filterCategory, filterSubcategory]);

  const hasActiveFilters = filterStatus !== 'all' || filterActivity !== 'all' || filterCategory !== 'all' || filterSubcategory !== 'all';

  const handleOpenDialog = async (purchase?: ProjectPurchase) => {
    if (purchase) {
      setEditingPurchase(purchase);
      setFormData({
        activity_id: purchase.activity_id,
        fornecedor_id: purchase.fornecedor_id || undefined,
        item_name: purchase.item_name,
        description: purchase.description || '',
        quantity: purchase.quantity,
        unit: purchase.unit,
        estimated_cost: purchase.estimated_cost || undefined,
        actual_cost: purchase.actual_cost || undefined,
        category: purchase.category || undefined,
        supplier_name: purchase.supplier_name || '',
        supplier_contact: purchase.supplier_contact || '',
        lead_time_days: purchase.lead_time_days,
        required_by_date: purchase.required_by_date,
        order_date: purchase.order_date || undefined,
        expected_delivery_date: purchase.expected_delivery_date || undefined,
        invoice_number: purchase.invoice_number || '',
        notes: purchase.notes || '',
        purchase_type: purchase.purchase_type || 'produto',
        delivery_address: purchase.delivery_address || '',
        start_date: purchase.start_date || undefined,
        end_date: purchase.end_date || undefined,
      });
      // Load existing payment installments
      if (purchase.purchase_type === 'prestador') {
        const { data } = await supabase
          .from('purchase_payment_schedule')
          .select('*')
          .eq('purchase_id', purchase.id)
          .order('installment_number');
        setPaymentInstallments((data || []).map(d => ({
          id: d.id,
          installment_number: d.installment_number,
          description: d.description,
          percentage: Number(d.percentage) || 0,
          amount: Number(d.amount) || 0,
          due_date: d.due_date || '',
        })));
      } else {
        setPaymentInstallments([]);
      }
    } else {
      setEditingPurchase(null);
      setFormData({
        ...emptyPurchase,
        ...(purchaseTypeFilter ? { purchase_type: purchaseTypeFilter } : {}),
      });
      setPaymentInstallments([]);
    }
    setIsDialogOpen(true);
  };

  const handleActivityChange = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
      const leadTime = formData.lead_time_days || 7;
      const activityStart = parseISO(activity.planned_start);
      const requiredDate = subDays(activityStart, leadTime);
      setFormData(prev => ({ ...prev, activity_id: activityId, required_by_date: format(requiredDate, 'yyyy-MM-dd') }));
    } else {
      setFormData(prev => ({ ...prev, activity_id: undefined }));
    }
  };

  const handleLeadTimeChange = (leadTime: number) => {
    setFormData(prev => {
      if (prev.activity_id) {
        const activity = activities.find(a => a.id === prev.activity_id);
        if (activity) {
          const activityStart = parseISO(activity.planned_start);
          const requiredDate = subDays(activityStart, leadTime);
          return { ...prev, lead_time_days: leadTime, required_by_date: format(requiredDate, 'yyyy-MM-dd') };
        }
      }
      return { ...prev, lead_time_days: leadTime };
    });
  };

  const handleSubmit = async () => {
    if (!projectId || !formData.item_name || !formData.required_by_date) return;
    const input: PurchaseInput = {
      project_id: projectId,
      activity_id: formData.activity_id || null,
      fornecedor_id: formData.fornecedor_id || null,
      item_name: formData.item_name,
      description: formData.description || null,
      quantity: formData.quantity || 1,
      unit: formData.unit || 'un',
      estimated_cost: formData.estimated_cost || null,
      actual_cost: formData.actual_cost || null,
      category: formData.category || null,
      supplier_name: formData.supplier_name || null,
      supplier_contact: formData.supplier_contact || null,
      lead_time_days: formData.lead_time_days || 7,
      required_by_date: formData.required_by_date,
      order_date: formData.order_date || null,
      expected_delivery_date: formData.expected_delivery_date || null,
      invoice_number: formData.invoice_number || null,
      notes: formData.notes || null,
      purchase_type: formData.purchase_type || 'produto',
      delivery_address: formData.delivery_address || null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    };
    try {
      let purchaseId: string;
      if (editingPurchase) {
        await updatePurchase.mutateAsync({ id: editingPurchase.id, ...input });
        purchaseId = editingPurchase.id;
      } else {
        const result = await addPurchase.mutateAsync(input);
        purchaseId = result.id;
      }
      // Save payment installments for prestadores
      if (input.purchase_type === 'prestador' && paymentInstallments.length > 0) {
        // Delete existing installments
        await supabase.from('purchase_payment_schedule').delete().eq('purchase_id', purchaseId);
        // Insert new ones
        const rows = paymentInstallments.map((inst, i) => ({
          purchase_id: purchaseId,
          installment_number: i + 1,
          description: inst.description,
          percentage: inst.percentage,
          amount: inst.amount,
          due_date: inst.due_date || null,
        }));
        await supabase.from('purchase_payment_schedule').insert(rows);
      } else if (input.purchase_type === 'prestador' && paymentInstallments.length === 0 && editingPurchase) {
        await supabase.from('purchase_payment_schedule').delete().eq('purchase_id', editingPurchase.id);
      }
      // Successful save → clear any persisted draft
      clearDraft();
      setIsDialogOpen(false);
    } catch {
      // Error toast already handled by mutation onError
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePurchase.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // Error toast already handled by mutation onError
    }
  };

  const handleStatusChange = async (id: string, newStatus: PurchaseStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status: newStatus });
    } catch {
      // Error toast already handled by mutation onError
    }
  };

  const handleUpdateActualCost = async (id: string, cost: number | null) => {
    try { await updatePurchase.mutateAsync({ id, actual_cost: cost }); } catch { /* handled */ }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    try { await updatePurchase.mutateAsync({ id, notes: notes || null }); } catch { /* handled */ }
  };

  const handleUpdateField = async (id: string, field: string, value: string | null) => {
    let updateValue: string | number | null = value;
    
    // Parse numeric fields
    if (field === 'estimated_cost' || field === 'actual_cost' || field === 'quantity' || field === 'shipping_cost') {
      updateValue = value ? parseFloat(value) : null;
      if (typeof updateValue === 'number' && isNaN(updateValue)) updateValue = null;
    }
    
    // Ensure UUID fields get null instead of empty string
    if (field === 'activity_id' || field === 'fornecedor_id') {
      updateValue = value && value.trim() ? value : null;
    }
    
    // Ensure date fields get null instead of empty string
    if (['required_by_date', 'planned_purchase_date', 'order_date', 'expected_delivery_date', 'actual_delivery_date', 'start_date', 'end_date', 'stock_entry_date', 'stock_exit_date', 'payment_due_date'].includes(field)) {
      updateValue = value && value.trim() ? value : null;
    }
    
    try { await updatePurchase.mutateAsync({ id, [field]: updateValue }); } catch { /* handled */ }
  };

  const getActivityName = (activityId: string | null) => {
    if (!activityId) return '—';
    const activity = activities.find(a => a.id === activityId);
    return activity?.description || '—';
  };

  const getDaysUntilRequired = (requiredDate: string, status: PurchaseStatus) => {
    if (status === 'delivered' || status === 'cancelled') return null;
    return differenceInDays(parseISO(requiredDate), new Date());
  };

  return {
    projectId,
    isLoading,
    filteredPurchases,
    activities,
    pendingPurchases,
    orderedPurchases,
    deliveredPurchases,
    overduePurchases,
    totalEstimatedCost,
    alertThresholds,
    getDaysUntilDeadline,
    filterStatus, setFilterStatus,
    filterActivity, setFilterActivity,
    filterCategory, handleCategoryFilterChange,
    filterSubcategory, setFilterSubcategory,
    hasActiveFilters,
    clearAllFilters,
    isDialogOpen, setIsDialogOpen,
    editingPurchase,
    deleteId, setDeleteId,
    formData, setFormData,
    paymentInstallments, setPaymentInstallments,
    handleOpenDialog,
    handleActivityChange,
    handleLeadTimeChange,
    handleSubmit,
    handleDelete,
    handleStatusChange,
    handleUpdateActualCost,
    handleUpdateNotes,
    handleUpdateField,
    getActivityName,
    getDaysUntilRequired,
    addPurchase,
    updatePurchase,
    draftLastSavedAt,
  };
}
