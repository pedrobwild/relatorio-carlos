import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProjectMembers, type ProjectRole } from '@/hooks/useProjectMembers';
import type { Project, Customer, Activity, Payment, Engineer, AvailableEngineer } from './types';
import type { StudioInfo } from './TabFichaTecnica';

const ALLOWED_ACTIVITY_FIELDS = [
  'description', 'etapa', 'detailed_description',
  'planned_start', 'planned_end', 'actual_start', 'actual_end',
  'weight', 'status', 'progress', 'sort_order',
] as const;

const DEBOUNCE_FIELDS = new Set(['description', 'etapa', 'detailed_description']);
const DEBOUNCE_MS = 600;

export function useEditarObraData(projectId: string | undefined) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { members, addMember, removeMember, updateRole, isAddingMember, isRemovingMember } = useProjectMembers(projectId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [availableEngineers, setAvailableEngineers] = useState<AvailableEngineer[]>([]);
  const [studioInfo, setStudioInfo] = useState<StudioInfo>({
    project_id: projectId || '',
    nome_do_empreendimento: null,
    endereco_completo: null,
    bairro: null,
    cidade: null,
    cep: null,
    complemento: null,
    tamanho_imovel_m2: null,
    tipo_de_locacao: null,
    data_recebimento_chaves: null,
  });

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (projectId) fetchAllData();
  }, [projectId]);

  useEffect(() => {
    if (projectId && !loading) fetchAvailableEngineers();
  }, [members]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId!)
        .single();
      if (projectError) throw projectError;
      setProject(projectData);

      const { data: customerData } = await supabase
        .from('project_customers')
        .select('*')
        .eq('project_id', projectId!)
        .single();
      setCustomer(customerData || null);

      const { data: activitiesData } = await supabase
        .from('project_activities')
        .select('*')
        .eq('project_id', projectId!)
        .order('sort_order', { ascending: true });
      setActivities(activitiesData || []);

      const { data: paymentsData } = await supabase
        .from('project_payments')
        .select('*')
        .eq('project_id', projectId!)
        .order('installment_number', { ascending: true });
      setPayments(paymentsData || []);

      const { data: engineersData } = await supabase
        .from('project_engineers')
        .select('*, profiles:engineer_user_id(display_name, email)')
        .eq('project_id', projectId!);
      setEngineers((engineersData || []).map(e => {
        const profiles = (e as Record<string, unknown>).profiles as { display_name: string | null; email: string | null } | null;
        return {
          ...e,
          display_name: profiles?.display_name ?? undefined,
          email: profiles?.email ?? undefined,
        };
      }));

      // Fetch studio info
      const { data: studioData } = await supabase
        .from('project_studio_info')
        .select('*')
        .eq('project_id', projectId!)
        .maybeSingle();
      if (studioData) {
        setStudioInfo(studioData as StudioInfo);
      } else {
        setStudioInfo({
          project_id: projectId!,
          nome_do_empreendimento: null,
          endereco_completo: null,
          bairro: null,
          cidade: null,
          cep: null,
          complemento: null,
          tamanho_imovel_m2: null,
          tipo_de_locacao: null,
          data_recebimento_chaves: null,
        });
      }

      const { data: staffProfiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, role')
        .in('role', ['admin', 'manager', 'engineer']);
      const assignedUserIds = new Set((engineersData || []).map(e => e.engineer_user_id));
      const memberUserIds = new Set(members.map(m => m.user_id));
      setAvailableEngineers(
        (staffProfiles || []).filter(p => !assignedUserIds.has(p.user_id) && !memberUserIds.has(p.user_id))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Error fetching data:', err);
      toast({ title: 'Erro ao carregar dados', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableEngineers = async () => {
    try {
      const { data: staffProfiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, role')
        .in('role', ['admin', 'manager', 'engineer']);
      const memberUserIds = new Set(members.map(m => m.user_id));
      const engineerUserIds = new Set(engineers.map(e => e.engineer_user_id));
      setAvailableEngineers(
        (staffProfiles || []).filter(p => !memberUserIds.has(p.user_id) && !engineerUserIds.has(p.user_id))
      );
    } catch (err) {
      console.error('Error fetching available engineers:', err);
    }
  };

  // --- Mutations ---

  const handleProjectChange = (field: keyof Project, value: string | number | boolean | null) => {
    if (project) setProject({ ...project, [field]: value });
  };

  const handleCustomerChange = (field: keyof Customer, value: string | null) => {
    if (customer) setCustomer({ ...customer, [field]: value });
  };

  const handleStudioInfoChange = (field: keyof StudioInfo, value: string | number | null) => {
    setStudioInfo(prev => ({ ...prev, [field]: value }));
  };

  const saveProject = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: project.name,
          unit_name: project.unit_name,
          address: project.address,
          bairro: project.bairro || null,
          cep: project.cep || null,
          planned_start_date: project.planned_start_date || null,
          planned_end_date: project.planned_end_date || null,
          actual_start_date: project.actual_start_date,
          actual_end_date: project.actual_end_date,
          contract_value: project.contract_value,
          status: project.status,
          is_project_phase: project.is_project_phase,
          date_briefing_arch: project.date_briefing_arch || null,
          date_approval_3d: project.date_approval_3d || null,
          date_approval_exec: project.date_approval_exec || null,
          date_approval_obra: project.date_approval_obra || null,
          date_official_start: project.date_official_start || null,
          date_official_delivery: project.date_official_delivery || null,
          date_mobilization_start: project.date_mobilization_start || null,
          contract_signing_date: project.contract_signing_date || null,
        })
        .eq('id', project.id);
      if (error) throw error;

      if (customer) {
        const { error: customerError } = await supabase
          .from('project_customers')
          .update({
            customer_name: customer.customer_name,
            customer_email: customer.customer_email,
            customer_phone: customer.customer_phone,
          })
          .eq('id', customer.id);
        if (customerError) throw customerError;
      }

      // Save studio info (upsert)
      const { project_id, ...studioFields } = studioInfo;
      const hasStudioData = Object.values(studioFields).some(v => v !== null && v !== '');
      if (hasStudioData) {
        const { error: studioError } = await supabase
          .from('project_studio_info')
          .upsert({
            project_id: project.id,
            ...studioFields,
          }, { onConflict: 'project_id' });
        if (studioError) throw studioError;
      }

      const statusLabels: Record<string, string> = {
        active: 'Em andamento',
        paused: 'Pausada',
        completed: 'Concluída',
        cancelled: 'Cancelada',
      };
      const statusLabel = statusLabels[project.status] || project.status;
      toast({ title: 'Salvo!', description: `Obra atualizada · Status: ${statusLabel}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Error saving:', err);
      toast({ title: 'Erro ao salvar', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Activities
  const addActivity = async (newActivity: { description: string; planned_start: string; planned_end: string; weight: string; etapa?: string; detailed_description?: string }) => {
    if (!newActivity.description || !newActivity.planned_start || !newActivity.planned_end) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return false;
    }
    try {
      const nextOrder = activities.length > 0 ? Math.max(...activities.map(a => a.sort_order)) + 1 : 1;
      const { data, error } = await supabase
        .from('project_activities')
        .insert([{
          project_id: projectId!,
          description: newActivity.description,
          planned_start: newActivity.planned_start,
          planned_end: newActivity.planned_end,
          weight: parseFloat(newActivity.weight) || 5,
          sort_order: nextOrder,
          created_by: user?.id ?? '',
          etapa: newActivity.etapa?.trim() || null,
          detailed_description: newActivity.detailed_description?.trim() || null,
        }])
        .select()
        .single();
      if (error) throw error;
      setActivities([...activities, data]);
      toast({ title: 'Atividade adicionada!' });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  // BUG-G: Field allowlist validation
  const updateActivity = useCallback(async (id: string, field: string, value: string | number | null) => {
    if (!(ALLOWED_ACTIVITY_FIELDS as readonly string[]).includes(field)) {
      console.error(`[updateActivity] Campo inválido: "${field}"`);
      return;
    }
    try {
      const { error } = await supabase.from('project_activities').update({ [field]: value }).eq('id', id);
      if (error) throw error;
      setActivities(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      toast({ title: 'Erro ao atualizar', description: message, variant: 'destructive' });
    }
  }, [toast]);

  // BUG-B: Debounced version for text fields
  const debouncedUpdateActivity = useCallback(
    (id: string, field: string, value: string | number | null) => {
      // Optimistic local update immediately
      setActivities(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
      
      const key = `${id}_${field}`;
      clearTimeout(debounceTimers.current[key]);
      debounceTimers.current[key] = setTimeout(() => {
        updateActivity(id, field, value);
      }, DEBOUNCE_MS);
    },
    [updateActivity]
  );

  // Smart update: auto-debounce text fields, immediate for others
  const smartUpdateActivity = useCallback(
    async (id: string, field: string, value: string | number | null) => {
      if (DEBOUNCE_FIELDS.has(field)) {
        debouncedUpdateActivity(id, field, value);
      } else {
        await updateActivity(id, field, value);
      }
    },
    [updateActivity, debouncedUpdateActivity]
  );

  const deleteActivity = async (id: string) => {
    try {
      const { error } = await supabase.from('project_activities').delete().eq('id', id);
      if (error) throw error;
      setActivities(activities.filter(a => a.id !== id));
      toast({ title: 'Atividade removida' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      toast({ title: 'Erro ao remover', description: message, variant: 'destructive' });
    }
  };

  const reorderActivities = async (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= activities.length ||
      toIndex >= activities.length
    ) {
      return;
    }

    const reordered = [...activities];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const normalized = reordered.map((activity, index) => ({
      ...activity,
      sort_order: index + 1,
    }));

    const previousActivities = activities;
    setActivities(normalized);

    try {
      const orderedIds = normalized.map(a => a.id);
      const { error: rpcError } = await supabase.rpc('reorder_project_activities', {
        p_project_id: projectId!,
        p_ordered_ids: orderedIds,
      });

      if (rpcError) {
        // Fallback: caminho antigo, um update por atividade
        const updates = normalized.map((activity) =>
          supabase
            .from('project_activities')
            .update({ sort_order: activity.sort_order })
            .eq('id', activity.id)
        );
        const results = await Promise.all(updates);
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      }

      toast({ title: 'Ordem das atividades atualizada' });
    } catch (err: unknown) {
      setActivities(previousActivities);
      const message = err instanceof Error ? err.message : 'Erro';
      toast({ title: 'Erro ao reordenar', description: message, variant: 'destructive' });
    }
  };

  // Payments
  const addPayment = async (newPayment: { description: string; amount: string; due_date: string; dueDatePending: boolean; payment_method: string }) => {
    if (!newPayment.description || !newPayment.amount) {
      toast({ title: 'Preencha descrição e valor', variant: 'destructive' });
      return false;
    }
    if (!newPayment.dueDatePending && !newPayment.due_date) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return false;
    }
    try {
      const nextInstallment = payments.length > 0 ? Math.max(...payments.map(p => p.installment_number)) + 1 : 1;
      const { data, error } = await supabase
        .from('project_payments')
        .insert({
          project_id: projectId!,
          installment_number: nextInstallment,
          description: newPayment.description,
          amount: parseFloat(newPayment.amount),
          due_date: newPayment.dueDatePending ? null : newPayment.due_date,
          payment_method: newPayment.payment_method || null,
        })
        .select()
        .single();
      if (error) throw error;
      setPayments([...payments, data]);
      toast({ title: 'Parcela adicionada!' });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    }
  };

  const updatePayment = async (id: string, field: string, value: string | number | null) => {
    try {
      const { error } = await supabase.from('project_payments').update({ [field]: value }).eq('id', id);
      if (error) throw error;
      setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      toast({ title: 'Erro ao atualizar', description: message, variant: 'destructive' });
    }
  };

  const togglePaymentPaid = async (payment: Payment) => {
    try {
      const newPaidAt = payment.paid_at ? null : new Date().toISOString();
      const { error } = await supabase.from('project_payments').update({ paid_at: newPaidAt }).eq('id', payment.id);
      if (error) throw error;
      setPayments(payments.map(p => p.id === payment.id ? { ...p, paid_at: newPaidAt } : p));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const deletePayment = async (id: string) => {
    try {
      const { error } = await supabase.from('project_payments').delete().eq('id', id);
      if (error) throw error;
      setPayments(payments.filter(p => p.id !== id));
      toast({ title: 'Parcela removida' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      toast({ title: 'Erro ao remover', description: message, variant: 'destructive' });
    }
  };

  // Team
  const handleAddMember = async (selectedEngineer: string, role: ProjectRole = 'engineer') => {
    if (!selectedEngineer || !projectId) return;
    try {
      await addMember({ projectId, userId: selectedEngineer, role });
      await fetchAvailableEngineers();
    } catch (err) {
      console.error('Error adding member:', err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember({ memberId });
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: ProjectRole) => {
    try {
      await updateRole({ memberId, role: newRole });
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  return {
    loading,
    saving,
    project,
    customer,
    studioInfo,
    activities,
    payments,
    engineers,
    availableEngineers,
    members,
    isAddingMember,
    isRemovingMember,
    setCustomer,
    handleProjectChange,
    handleCustomerChange,
    handleStudioInfoChange,
    saveProject,
    addActivity,
    updateActivity: smartUpdateActivity,
    deleteActivity,
    reorderActivities,
    addPayment,
    updatePayment,
    togglePaymentPaid,
    deletePayment,
    handleAddMember,
    handleRemoveMember,
    handleUpdateRole,
  };
}
