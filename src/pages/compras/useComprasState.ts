import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { format, differenceInDays, parseISO, subDays } from 'date-fns';
import { useProjectPurchases, ProjectPurchase, PurchaseInput, PurchaseStatus } from '@/hooks/useProjectPurchases';
import { useProjectActivities } from '@/hooks/useProjectActivities';
import { emptyPurchase } from './types';

export function useComprasState() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    purchases, isLoading, addPurchase, updatePurchase, deletePurchase, updateStatus,
    pendingPurchases, orderedPurchases, deliveredPurchases, overduePurchases,
    totalEstimatedCost, alertThresholds, getDaysUntilDeadline,
  } = useProjectPurchases(projectId, true);
  const { activities } = useProjectActivities(projectId);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterActivity, setFilterActivity] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<ProjectPurchase | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PurchaseInput>>(emptyPurchase);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterActivity !== 'all' && p.activity_id !== filterActivity) return false;
      return true;
    });
  }, [purchases, filterStatus, filterActivity]);

  const handleOpenDialog = (purchase?: ProjectPurchase) => {
    if (purchase) {
      setEditingPurchase(purchase);
      setFormData({
        activity_id: purchase.activity_id,
        item_name: purchase.item_name,
        description: purchase.description || '',
        quantity: purchase.quantity,
        unit: purchase.unit,
        estimated_cost: purchase.estimated_cost || undefined,
        supplier_name: purchase.supplier_name || '',
        supplier_contact: purchase.supplier_contact || '',
        lead_time_days: purchase.lead_time_days,
        required_by_date: purchase.required_by_date,
        order_date: purchase.order_date || undefined,
        expected_delivery_date: purchase.expected_delivery_date || undefined,
        invoice_number: purchase.invoice_number || '',
        notes: purchase.notes || '',
      });
    } else {
      setEditingPurchase(null);
      setFormData(emptyPurchase);
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
      item_name: formData.item_name,
      description: formData.description || null,
      quantity: formData.quantity || 1,
      unit: formData.unit || 'un',
      estimated_cost: formData.estimated_cost || null,
      supplier_name: formData.supplier_name || null,
      supplier_contact: formData.supplier_contact || null,
      lead_time_days: formData.lead_time_days || 7,
      required_by_date: formData.required_by_date,
      order_date: formData.order_date || null,
      expected_delivery_date: formData.expected_delivery_date || null,
      invoice_number: formData.invoice_number || null,
      notes: formData.notes || null,
    };
    if (editingPurchase) {
      await updatePurchase.mutateAsync({ id: editingPurchase.id, ...input });
    } else {
      await addPurchase.mutateAsync(input);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deletePurchase.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleStatusChange = async (id: string, newStatus: PurchaseStatus) => {
    await updateStatus.mutateAsync({ id, status: newStatus });
  };

  const handleUpdateActualCost = async (id: string, cost: number | null) => {
    await updatePurchase.mutateAsync({ id, actual_cost: cost });
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    await updatePurchase.mutateAsync({ id, notes: notes || null });
  };

  const handleUpdateField = async (id: string, field: string, value: string | null) => {
    await updatePurchase.mutateAsync({ id, [field]: value });
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
    isDialogOpen, setIsDialogOpen,
    editingPurchase,
    deleteId, setDeleteId,
    formData, setFormData,
    handleOpenDialog,
    handleActivityChange,
    handleLeadTimeChange,
    handleSubmit,
    handleDelete,
    handleStatusChange,
    handleUpdateActualCost,
    handleUpdateNotes,
    getActivityName,
    getDaysUntilRequired,
    addPurchase,
    updatePurchase,
  };
}
