/**
 * useCsTicketActions — gestão das ações (sub-tarefas) de um ticket de CS.
 *
 * Cada ticket pode ter N ações com:
 *   - title, description, responsible_user_id, due_date,
 *     status (pendente | em_andamento | concluida | cancelada),
 *     sort_order, completed_at (preenchido pelo trigger).
 *
 * Inclui helpers para sumarizar prazos e progresso (usados na lista e no
 * cabeçalho do ticket): total, concluídas, atrasadas, próximo prazo e
 * tempo médio de conclusão.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ----- types -----
export type CsActionStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export const CS_ACTION_STATUS_OPTIONS: { value: CsActionStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

export interface CsTicketAction {
  id: string;
  ticket_id: string;
  title: string;
  description: string | null;
  responsible_user_id: string | null;
  responsible_name: string | null;
  due_date: string | null;
  status: CsActionStatus;
  sort_order: number;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CsTicketActionInput {
  ticket_id: string;
  title: string;
  description?: string | null;
  responsible_user_id?: string | null;
  due_date?: string | null;
  status?: CsActionStatus;
}

export type CsTicketActionPatch = Partial<
  Omit<CsTicketActionInput, 'ticket_id'> & { sort_order: number }
>;

// ----- query keys -----
export const csActionKeys = {
  all: ['cs-ticket-actions'] as const,
  byTicket: (ticketId: string) => [...csActionKeys.all, 'ticket', ticketId] as const,
  summary: () => [...csActionKeys.all, 'summary'] as const,
};

// ----- list por ticket -----
export function useCsTicketActions(ticketId: string | undefined | null) {
  return useQuery({
    queryKey: ticketId ? csActionKeys.byTicket(ticketId) : ['cs-ticket-actions', 'idle'],
    enabled: !!ticketId,
    queryFn: async (): Promise<CsTicketAction[]> => {
      const { data, error } = await supabase
        .from('cs_ticket_actions')
        .select(
          `
          id, ticket_id, title, description, responsible_user_id,
          due_date, status, sort_order, completed_at, created_by,
          created_at, updated_at,
          responsible:users_profile!cs_ticket_actions_responsible_user_id_fkey ( id, nome )
          `,
        )
        .eq('ticket_id', ticketId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        ticket_id: row.ticket_id,
        title: row.title,
        description: row.description,
        responsible_user_id: row.responsible_user_id,
        responsible_name: row.responsible?.nome ?? null,
        due_date: row.due_date,
        status: row.status,
        sort_order: row.sort_order,
        completed_at: row.completed_at,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) as CsTicketAction[];
    },
    staleTime: 30 * 1000,
  });
}

// ----- summary global (para listagem de tickets) -----
export interface CsTicketActionsSummary {
  total: number;
  done: number;
  open: number;
  overdue: number;
  nextDueDate: string | null; // ISO date
  nextDueTitle: string | null;
}

export function useAllCsActionsSummary() {
  return useQuery({
    queryKey: csActionKeys.summary(),
    queryFn: async (): Promise<Record<string, CsTicketActionsSummary>> => {
      const { data, error } = await supabase
        .from('cs_ticket_actions')
        .select('ticket_id, status, due_date, title');
      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const map: Record<string, CsTicketActionsSummary> = {};
      (data ?? []).forEach((row: any) => {
        const sum = (map[row.ticket_id] ??= {
          total: 0,
          done: 0,
          open: 0,
          overdue: 0,
          nextDueDate: null,
          nextDueTitle: null,
        });
        sum.total += 1;
        const isDone = row.status === 'concluida' || row.status === 'cancelada';
        if (isDone) {
          sum.done += 1;
        } else {
          sum.open += 1;
          if (row.due_date) {
            const due = new Date(row.due_date + 'T00:00:00');
            if (due < today) sum.overdue += 1;
            if (!sum.nextDueDate || row.due_date < sum.nextDueDate) {
              sum.nextDueDate = row.due_date;
              sum.nextDueTitle = row.title;
            }
          }
        }
      });
      return map;
    },
    staleTime: 30 * 1000,
  });
}

// ----- create -----
export function useCreateCsTicketAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CsTicketActionInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Usuário não autenticado.');

      // posiciona ao final
      const { count } = await supabase
        .from('cs_ticket_actions')
        .select('id', { count: 'exact', head: true })
        .eq('ticket_id', input.ticket_id);

      const { data, error } = await supabase
        .from('cs_ticket_actions')
        .insert({
          ticket_id: input.ticket_id,
          title: input.title,
          description: input.description ?? null,
          responsible_user_id: input.responsible_user_id ?? null,
          due_date: input.due_date ?? null,
          status: input.status ?? 'pendente',
          sort_order: count ?? 0,
          created_by: uid,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: csActionKeys.byTicket(vars.ticket_id) });
      qc.invalidateQueries({ queryKey: csActionKeys.summary() });
    },
    onError: (err: any) => {
      toast.error('Erro ao criar ação', { description: err?.message });
    },
  });
}

// ----- update -----
export function useUpdateCsTicketAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ticket_id,
      patch,
    }: {
      id: string;
      ticket_id: string;
      patch: CsTicketActionPatch;
    }) => {
      const { error } = await supabase.from('cs_ticket_actions').update(patch).eq('id', id);
      if (error) throw error;
      return { id, ticket_id };
    },
    onSuccess: ({ ticket_id }) => {
      qc.invalidateQueries({ queryKey: csActionKeys.byTicket(ticket_id) });
      qc.invalidateQueries({ queryKey: csActionKeys.summary() });
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar ação', { description: err?.message });
    },
  });
}

// ----- delete -----
export function useDeleteCsTicketAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ticket_id }: { id: string; ticket_id: string }) => {
      const { error } = await supabase.from('cs_ticket_actions').delete().eq('id', id);
      if (error) throw error;
      return { ticket_id };
    },
    onSuccess: ({ ticket_id }) => {
      qc.invalidateQueries({ queryKey: csActionKeys.byTicket(ticket_id) });
      qc.invalidateQueries({ queryKey: csActionKeys.summary() });
      toast.success('Ação removida.');
    },
    onError: (err: any) => {
      toast.error('Erro ao remover ação', { description: err?.message });
    },
  });
}

// ----- helpers de exibição -----
export function summarizeActions(actions: CsTicketAction[]): CsTicketActionsSummary {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sum: CsTicketActionsSummary = {
    total: actions.length,
    done: 0,
    open: 0,
    overdue: 0,
    nextDueDate: null,
    nextDueTitle: null,
  };
  actions.forEach((a) => {
    const isDone = a.status === 'concluida' || a.status === 'cancelada';
    if (isDone) sum.done += 1;
    else {
      sum.open += 1;
      if (a.due_date) {
        const due = new Date(a.due_date + 'T00:00:00');
        if (due < today) sum.overdue += 1;
        if (!sum.nextDueDate || a.due_date < sum.nextDueDate) {
          sum.nextDueDate = a.due_date;
          sum.nextDueTitle = a.title;
        }
      }
    }
  });
  return sum;
}

/** Tempo médio (ms) entre criação e conclusão das ações concluídas. */
export function avgActionResolutionMs(actions: CsTicketAction[]): number | null {
  const done = actions.filter((a) => a.status === 'concluida' && a.completed_at);
  if (done.length === 0) return null;
  const total = done.reduce(
    (acc, a) =>
      acc + (new Date(a.completed_at!).getTime() - new Date(a.created_at).getTime()),
    0,
  );
  return total / done.length;
}

/** Formata duração (ms) em "Xd Yh" / "Yh Zmin" / "Zmin". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms) || ms < 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (hours < 24) return remMin > 0 ? `${hours}h ${remMin}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}
