import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StageDate {
  id: string;
  project_id: string;
  stage_key: string;
  date_type: 'meeting' | 'deadline' | 'start_planned' | 'end_planned' | 'milestone';
  title: string;
  customer_proposed_at: string | null;
  bwild_confirmed_at: string | null;
  customer_proposed_by: string | null;
  bwild_confirmed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StageDateEvent {
  id: string;
  stage_date_id: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

async function callStageDates(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('stage-dates', {
    body,
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined,
  });
  if (res.error) throw new Error(res.error.message || 'Erro ao processar datas');
  if (!res.data?.success) throw new Error(res.data?.error?.message || 'Erro desconhecido');
  return res.data.data;
}

export function useStageDates(projectId: string, stageKey?: string) {
  return useQuery<StageDate[]>({
    queryKey: ['stage-dates', projectId, stageKey],
    queryFn: () => callStageDates({ action: 'list', project_id: projectId, stage_key: stageKey }),
    enabled: !!projectId,
  });
}

export function useStageDateEvents(stageDateId: string | null) {
  return useQuery<StageDateEvent[]>({
    queryKey: ['stage-date-events', stageDateId],
    queryFn: () => callStageDates({ action: 'list_events', stage_date_id: stageDateId }),
    enabled: !!stageDateId,
  });
}

export function useCreateStageDate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      stage_key: string;
      date_type: StageDate['date_type'];
      title: string;
      customer_proposed_at?: string;
      notes?: string;
    }) => callStageDates({ action: 'create', project_id: projectId, ...params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stage-dates', projectId] });
      toast.success('Data criada');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useProposeStageDate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { stage_date_id: string; datetime: string; notes?: string }) =>
      callStageDates({ action: 'propose', ...params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stage-dates', projectId] });
      toast.success('Proposta de data enviada');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useConfirmStageDate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { stage_date_id: string; datetime: string; notes?: string; customer_proposed_at?: string }) =>
      callStageDates({ action: 'confirm', ...params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stage-dates', projectId] });
      toast.success('Data confirmada');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
