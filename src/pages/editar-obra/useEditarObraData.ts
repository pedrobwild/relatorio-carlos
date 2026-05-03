import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ToastAction } from '@/components/ui/toast';
import type { ToastActionElement } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProjectMembers, type ProjectRole } from '@/hooks/useProjectMembers';
import { invalidateActivityQueries } from '@/lib/queryKeys';
import { shiftActivityDates, type ShiftMode } from '@/lib/shiftActivityDates';
import { recalculateWeeklyActivities } from '@/lib/weeklySchedule';
import { addBusinessDays } from '@/lib/businessDays';
import type { Project, Customer, Activity, Payment, Engineer, AvailableEngineer } from './types';
import type { StudioInfo } from './TabFichaTecnica';

/**
 * Snapshot used to undo the last schedule shift.
 * Stores the activity planned dates BEFORE the shift was applied,
 * plus (optionally) the project planned dates that were persisted alongside.
 */
type ShiftUndoSnapshot = {
  /** 'save' = both project + activity dates were saved; 'recalc-only' = only activities changed. */
  origin: 'save' | 'recalc-only';
  activities: Array<{ id: string; planned_start: string; planned_end: string }>;
  /** Previous persisted project dates — only meaningful when origin === 'save'. */
  projectStart: string | null;
  projectEnd: string | null;
  createdAt: number;
};

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
  // Snapshot of project planned dates as last persisted (used to detect shift on save)
  const persistedProjectDatesRef = useRef<{ start: string | null; end: string | null }>({ start: null, end: null });

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
      persistedProjectDatesRef.current = {
        start: projectData?.planned_start_date ?? null,
        end: projectData?.planned_end_date ?? null,
      };

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

  // Shift dialog state. `mode = 'save'` runs the full save flow (default).
  // `mode = 'recalc-only'` only realigns the schedule without saving project fields.
  const [shiftDialogState, setShiftDialogState] = useState<{
    open: boolean;
    startChanged: boolean;
    endChanged: boolean;
    activityCount: number;
    mode: 'save' | 'recalc-only';
    oldStart: string | null;
    oldEnd: string | null;
    newStart: string | null;
    newEnd: string | null;
  }>({ open: false, startChanged: false, endChanged: false, activityCount: 0, mode: 'save', oldStart: null, oldEnd: null, newStart: null, newEnd: null });

  // Last shift snapshot — enables the "Desfazer" action after a save/recalc that shifted activities.
  const [lastShiftUndo, setLastShiftUndo] = useState<ShiftUndoSnapshot | null>(null);

  /**
   * Reverts the last schedule shift: restores activity planned dates and,
   * when applicable, the project's persisted planned dates.
   */
  const undoLastShift = useCallback(async () => {
    if (!lastShiftUndo) return;
    const snapshot = lastShiftUndo;
    setSaving(true);
    try {
      // Restore activity dates
      const updates = snapshot.activities.map(a =>
        supabase
          .from('project_activities')
          .update({ planned_start: a.planned_start, planned_end: a.planned_end })
          .eq('id', a.id)
      );
      const results = await Promise.all(updates);
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;

      // Restore project dates if the shift came from a save flow
      if (snapshot.origin === 'save' && project) {
        const { error: projError } = await supabase
          .from('projects')
          .update({
            planned_start_date: snapshot.projectStart,
            planned_end_date: snapshot.projectEnd,
          })
          .eq('id', project.id);
        if (projError) throw projError;
        setProject(p => p ? { ...p, planned_start_date: snapshot.projectStart, planned_end_date: snapshot.projectEnd } : p);
        persistedProjectDatesRef.current = { start: snapshot.projectStart, end: snapshot.projectEnd };
      }

      // Restore local activities state
      const restoredMap = new Map(snapshot.activities.map(a => [a.id, a]));
      setActivities(prev => prev.map(a => {
        const r = restoredMap.get(a.id);
        return r ? { ...a, planned_start: r.planned_start, planned_end: r.planned_end } : a;
      }));

      if (projectId) invalidateActivityQueries(projectId);
      setLastShiftUndo(null);
      toast({
        title: 'Sincronização desfeita',
        description: `Datas anteriores restauradas (${snapshot.activities.length} atividade(s)).`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Error undoing shift:', err);
      toast({ title: 'Erro ao desfazer', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [lastShiftUndo, project, projectId, toast]);

  /** Helper that builds the action button to attach to the success toast. */
  const buildUndoAction = useCallback(
    (handler: () => void): ToastActionElement =>
      React.createElement(
        ToastAction,
        { altText: 'Desfazer sincronização', onClick: handler },
        'Desfazer'
      ) as unknown as ToastActionElement,
    []
  );

  const performSave = async (shiftMode: ShiftMode | null) => {
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

      const oldStart = persistedProjectDatesRef.current.start;
      const oldEnd = persistedProjectDatesRef.current.end;
      const newStart = project.planned_start_date || null;
      const newEnd = project.planned_end_date || null;

      let shiftedCount = 0;
      let undoSnapshot: ShiftUndoSnapshot | null = null;
      if (shiftMode && activities.length > 0) {
        // Capture pre-shift snapshot for undo
        const preShiftSnapshot = activities.map(a => ({
          id: a.id,
          planned_start: a.planned_start,
          planned_end: a.planned_end,
        }));
        const { activities: shifted, changedIds } = shiftActivityDates(
          activities,
          oldStart,
          oldEnd,
          newStart,
          newEnd,
          shiftMode,
        );
        if (changedIds.length > 0) {
          const updates = shifted
            .filter(a => changedIds.includes(a.id))
            .map(a =>
              supabase
                .from('project_activities')
                .update({ planned_start: a.planned_start, planned_end: a.planned_end })
                .eq('id', a.id)
            );
          const results = await Promise.all(updates);
          const failed = results.find(r => r.error);
          if (failed?.error) throw failed.error;
          setActivities(shifted);
          shiftedCount = changedIds.length;
          if (projectId) invalidateActivityQueries(projectId);
          // Only snapshot the activities that actually changed (smaller payload, precise revert)
          undoSnapshot = {
            origin: 'save',
            activities: preShiftSnapshot.filter(s => changedIds.includes(s.id)),
            projectStart: oldStart,
            projectEnd: oldEnd,
            createdAt: Date.now(),
          };
        }
      }

      // Update snapshot to reflect newly persisted state
      persistedProjectDatesRef.current = { start: newStart, end: newEnd };

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
      const modeLabel = shiftMode === 'preserve-duration' ? 'duração mantida' : 'proporcional';
      const description = shiftedCount > 0
        ? `Obra atualizada · Status: ${statusLabel} · ${shiftedCount} atividade(s) realinhada(s) (${modeLabel})`
        : `Obra atualizada · Status: ${statusLabel}`;

      if (undoSnapshot) {
        setLastShiftUndo(undoSnapshot);
        const snap = undoSnapshot;
        toast({
          title: 'Salvo!',
          description,
          duration: 12000,
          action: buildUndoAction(() => {
            // Only undo if this snapshot is still the current one
            setLastShiftUndo(current => current === snap ? snap : current);
            void undoLastShift();
          }),
        });
      } else {
        toast({ title: 'Salvo!', description });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Error saving:', err);
      toast({ title: 'Erro ao salvar', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveProject = async () => {
    if (!project) return;

    const oldStart = persistedProjectDatesRef.current.start;
    const oldEnd = persistedProjectDatesRef.current.end;
    const newStart = project.planned_start_date || null;
    const newEnd = project.planned_end_date || null;

    // Validation: end date must not be before start date
    if (newStart && newEnd && newEnd < newStart) {
      toast({
        title: 'Datas inválidas',
        description: 'A data de término prevista não pode ser anterior à data de início prevista. Corrija antes de salvar.',
        variant: 'destructive',
      });
      return;
    }

    const startChanged = !!newStart && newStart !== oldStart;
    const endChanged = !!newEnd && newEnd !== oldEnd;
    const datesChanged = startChanged || endChanged;

    // If planned project dates changed and there are activities, ask the user how to recalc
    if (datesChanged && activities.length > 0) {
      setShiftDialogState({
        open: true,
        startChanged,
        endChanged,
        activityCount: activities.length,
        mode: 'save',
        oldStart,
        oldEnd,
        newStart,
        newEnd,
      });
      return;
    }

    await performSave(null);
  };

  /**
   * Force a schedule recalculation without saving other project fields.
   * Uses current schedule bounds as "old" and the project's planned dates as "new".
   */
  const recalculateSchedule = () => {
    if (!project || activities.length === 0) return;
    const valid = activities.filter(a => a.planned_start && a.planned_end);
    if (valid.length === 0) {
      toast({ title: 'Cronograma vazio', description: 'Não há atividades para recalcular.' });
      return;
    }
    const newStart = project.planned_start_date || null;
    const newEnd = project.planned_end_date || null;
    if (!newStart && !newEnd) {
      toast({
        title: 'Datas do projeto não definidas',
        description: 'Defina o início ou término previsto antes de recalcular.',
        variant: 'destructive',
      });
      return;
    }
    const starts = valid.map(a => new Date(a.planned_start).getTime());
    const ends = valid.map(a => new Date(a.planned_end).getTime());
    const scheduleStart = new Date(Math.min(...starts)).toISOString().slice(0, 10);
    const scheduleEnd = new Date(Math.max(...ends)).toISOString().slice(0, 10);
    const startChanged = !!newStart && newStart !== scheduleStart;
    const endChanged = !!newEnd && newEnd !== scheduleEnd;
    if (!startChanged && !endChanged) {
      toast({ title: 'Já sincronizado', description: 'O cronograma já está alinhado com as datas do projeto.' });
      return;
    }
    setShiftDialogState({
      open: true,
      startChanged,
      endChanged,
      activityCount: valid.length,
      mode: 'recalc-only',
      oldStart: scheduleStart,
      oldEnd: scheduleEnd,
      newStart,
      newEnd,
    });
  };

  const performRecalcOnly = async (shiftMode: ShiftMode) => {
    if (!project || activities.length === 0) return;
    const valid = activities.filter(a => a.planned_start && a.planned_end);
    if (valid.length === 0) return;
    const starts = valid.map(a => new Date(a.planned_start).getTime());
    const ends = valid.map(a => new Date(a.planned_end).getTime());
    const scheduleStart = new Date(Math.min(...starts)).toISOString().slice(0, 10);
    const scheduleEnd = new Date(Math.max(...ends)).toISOString().slice(0, 10);
    const newStart = project.planned_start_date || null;
    const newEnd = project.planned_end_date || null;

    setSaving(true);
    try {
      // Capture pre-shift snapshot for undo
      const preShiftSnapshot = activities.map(a => ({
        id: a.id,
        planned_start: a.planned_start,
        planned_end: a.planned_end,
      }));
      const { activities: shifted, changedIds } = shiftActivityDates(
        activities,
        scheduleStart,
        scheduleEnd,
        newStart,
        newEnd,
        shiftMode,
      );
      if (changedIds.length === 0) {
        toast({ title: 'Nada a recalcular', description: 'Nenhuma atividade precisou ser ajustada.' });
        return;
      }
      const updates = shifted
        .filter(a => changedIds.includes(a.id))
        .map(a =>
          supabase
            .from('project_activities')
            .update({ planned_start: a.planned_start, planned_end: a.planned_end })
            .eq('id', a.id)
        );
      const results = await Promise.all(updates);
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
      setActivities(shifted);
      if (projectId) invalidateActivityQueries(projectId);

      const undoSnapshot: ShiftUndoSnapshot = {
        origin: 'recalc-only',
        activities: preShiftSnapshot.filter(s => changedIds.includes(s.id)),
        projectStart: null,
        projectEnd: null,
        createdAt: Date.now(),
      };
      setLastShiftUndo(undoSnapshot);

      const modeLabel = shiftMode === 'preserve-duration' ? 'duração mantida' : 'proporcional';
      toast({
        title: 'Cronograma recalculado',
        description: `${changedIds.length} atividade(s) realinhada(s) (${modeLabel}).`,
        duration: 12000,
        action: buildUndoAction(() => { void undoLastShift(); }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Error recalculating:', err);
      toast({ title: 'Erro ao recalcular', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleShiftDialogConfirm = async (mode: ShiftMode | null) => {
    const dialogMode = shiftDialogState.mode;
    setShiftDialogState(s => ({ ...s, open: false }));
    if (mode === null) return;
    if (dialogMode === 'recalc-only') {
      await performRecalcOnly(mode);
    } else {
      await performSave(mode);
    }
  };

  const setShiftDialogOpen = (open: boolean) => {
    setShiftDialogState(s => ({ ...s, open }));
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
      if (projectId) invalidateActivityQueries(projectId);
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
      if (projectId) invalidateActivityQueries(projectId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      toast({ title: 'Erro ao atualizar', description: message, variant: 'destructive' });
    }
  }, [toast, projectId]);

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
      if (projectId) invalidateActivityQueries(projectId);
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

      if (projectId) invalidateActivityQueries(projectId);
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
    recalculateSchedule,
    addActivity,
    updateActivity: smartUpdateActivity,
    deleteActivity,
    reorderActivities,
    addPayment,
    updatePayment,
    togglePaymentPaid,
    deletePayment,
    refetchAll: fetchAllData,
    handleAddMember,
    handleRemoveMember,
    handleUpdateRole,
    // Shift dialog
    shiftDialogState,
    setShiftDialogOpen,
    handleShiftDialogConfirm,
    // Undo last shift
    canUndoShift: lastShiftUndo !== null,
    undoLastShift,
  };
}
