/**
 * usePainelObras — CRUD para a tabela `painel_obras` (visão executiva de obras).
 * Usa TanStack Query com optimistic updates para edição inline ágil.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PainelEtapa =
  | 'Medição'
  | 'Executivo'
  | 'Emissão RRT'
  | 'Condomínio'
  | 'Planejamento'
  | 'Mobilização';

export type PainelStatus = 'Em dia' | 'Atrasado' | 'Paralisada';

export type PainelRelacionamento = 'Normal' | 'Atrito' | 'Insatisfeito' | 'Crítico';

export interface PainelObra {
  id: string;
  nome: string | null;
  prazo: string | null;
  inicio_oficial: string | null;
  entrega_oficial: string | null;
  etapa: PainelEtapa | null;
  inicio_etapa: string | null;
  previsao_avanco: string | null;
  status: PainelStatus | null;
  inicio_real: string | null;
  entrega_real: string | null;
  relacionamento: PainelRelacionamento | null;
  ultima_atualizacao: string;
  created_at: string;
}

export const ETAPA_OPTIONS: PainelEtapa[] = [
  'Medição',
  'Executivo',
  'Emissão RRT',
  'Condomínio',
  'Planejamento',
  'Mobilização',
];

export const STATUS_OPTIONS: PainelStatus[] = ['Em dia', 'Atrasado', 'Paralisada'];

export const RELACIONAMENTO_OPTIONS: PainelRelacionamento[] = [
  'Normal',
  'Atrito',
  'Insatisfeito',
  'Crítico',
];

const QUERY_KEY = ['painel-obras'] as const;

export function usePainelObras() {
  const qc = useQueryClient();

  const { data: obras = [], isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('painel_obras' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PainelObra[];
    },
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<PainelObra>) => {
      const { data, error } = await supabase
        .from('painel_obras' as any)
        .insert(input as any)
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as PainelObra;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Obra adicionada');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao adicionar obra'),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PainelObra> }) => {
      const { error } = await supabase
        .from('painel_obras' as any)
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;
      return { id, patch };
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<PainelObra[]>(QUERY_KEY);
      if (prev) {
        qc.setQueryData<PainelObra[]>(
          QUERY_KEY,
          prev.map((o) =>
            o.id === id ? { ...o, ...patch, ultima_atualizacao: new Date().toISOString() } : o,
          ),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error('Erro ao salvar alteração');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('painel_obras' as any).delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Obra removida');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao remover obra'),
  });

  return {
    obras,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    createObra: (input: Partial<PainelObra>) => create.mutateAsync(input),
    updateObra: (id: string, patch: Partial<PainelObra>) =>
      update.mutateAsync({ id, patch }),
    removeObra: (id: string) => remove.mutateAsync(id),
    isCreating: create.isPending,
    isUpdating: update.isPending,
  };
}
