/**
 * Hooks do Cronograma interno (staff-only) — ver
 * `src/infra/repositories/internalSchedule.repository.ts`.
 *
 * Toda gravação relê o cronograma interno e o que depende dele (Semana,
 * Hoje, Painel, Lookahead, Minha semana) via
 * `invalidateInternalScheduleQueries`. O cronograma do cliente não é tocado.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateActivityQueries, invalidateInternalScheduleQueries, queryKeys } from "@/lib/queryKeys";
import {
  internalScheduleRepo,
  type InternalScheduleInsert,
  type InternalScheduleItemWithRefs,
  type InternalSchedulePatch,
} from "@/infra/repositories/internalSchedule.repository";
import { mapError } from "@/lib/errorMapping";

const unwrap = <T,>(res: { data: T | null; error: unknown }): T => {
  if (res.error) throw res.error;
  return res.data as T;
};

/** Mensagem em português para a tela; nunca o erro cru do Postgres. */
export function internalScheduleErrorMessage(error: unknown): string {
  const userMessage = (error as { userError?: { userMessage?: string } } | null)?.userError?.userMessage;
  return userMessage ?? mapError(error).userMessage;
}

/** Campos que o Calendário e o Lookahead também gravam no cronograma do cliente. */
export type MirrorField = "actual_start" | "actual_end" | "responsible_user_id";

/** O que a ação precisa saber da linha (interna ou do cliente) para os padrões. */
export interface MirrorRow {
  actual_start: string | null;
  actual_end: string | null;
  planned_start: string;
  responsible_user_id: string | null;
}

/**
 * Valor de um campo numa ação: fixo (o que a pessoa escolheu) ou calculado
 * a partir da linha em que vai ser gravado. `undefined` = não gravar o campo.
 */
export type MirrorValue = string | null | ((row: MirrorRow) => string | null | undefined);

/** Só os campos que a pessoa mexeu nesta ação. */
export type MirrorChange = Partial<Record<MirrorField, MirrorValue>>;

export type ClientMirrorPatch = Partial<Pick<InternalSchedulePatch, MirrorField>>;

/** Aplica a ação a uma linha: só os campos tocados, padrões calculados dela. */
export function resolveMirrorChange(change: MirrorChange, row: MirrorRow): ClientMirrorPatch {
  const out: ClientMirrorPatch = {};
  for (const field of ["actual_start", "actual_end", "responsible_user_id"] as const) {
    if (!(field in change)) continue;
    const v = change[field];
    const value = typeof v === "function" ? v(row) : v;
    if (value !== undefined) out[field] = value;
  }
  return out;
}

export const CLIENT_NOT_UPDATED_MESSAGE =
  "Salvo no cronograma interno, mas o cronograma do cliente não foi atualizado. Atualize pelo Cronograma do cliente.";

/**
 * Grava a ação no item interno e, se o item é de primeiro nível e veio de
 * uma atividade do cliente, também na atividade do cliente — é como o
 * Calendário e o Lookahead sempre preencheram o cronograma do cliente.
 *
 * Cada lado recebe só os campos que a pessoa mexeu; os padrões (ex.:
 * "Concluir" usa o início que já existe ou hoje) são calculados da PRÓPRIA
 * linha: do item interno para o interno, e de uma leitura na hora da
 * atividade do cliente para o cliente. Assim o cliente recebe exatamente o
 * que recebia antes, mesmo quando o interno está diferente.
 *
 * Micro-etapa e item só interno gravam só no interno. Falha no interno:
 * lança (nada foi gravado). Falha no cliente: avisa e mantém o interno.
 * Não usar na tela Cronograma interno: lá as datas do cliente não mudam.
 */
export async function updateInternalMirroringClient(
  item: MirrorRow & { id: string; project_id: string; parent_id: string | null; client_activity_id: string | null },
  change: MirrorChange,
): Promise<{ clientUpdated: boolean | null; internalPatch: ClientMirrorPatch }> {
  const internalPatch = resolveMirrorChange(change, item);
  if (Object.keys(internalPatch).length > 0) {
    const res = await internalScheduleRepo.update(item.id, internalPatch);
    if (res.error) throw res.error;
  }
  if (!item.client_activity_id || item.parent_id) return { clientUpdated: null, internalPatch };

  const state = await internalScheduleRepo.getClientActivityState(item.client_activity_id);
  if (state.error || !state.data) {
    toast.error(CLIENT_NOT_UPDATED_MESSAGE);
    return { clientUpdated: false, internalPatch };
  }
  const clientPatch = resolveMirrorChange(change, state.data);
  if (Object.keys(clientPatch).length === 0) return { clientUpdated: true, internalPatch };
  const client = await internalScheduleRepo.mirrorToClientActivity(item.client_activity_id, clientPatch);
  if (client.error) {
    toast.error(CLIENT_NOT_UPDATED_MESSAGE);
    return { clientUpdated: false, internalPatch };
  }
  // Mesmas invalidações do cliente de antes (lista de atividades + Painel).
  invalidateActivityQueries(item.project_id);
  return { clientUpdated: true, internalPatch };
}

/** Acompanha o cliente (customized_at null) ou foi editado pela equipe. */
export function useInternalScheduleState(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.internalSchedule.state(projectId),
    enabled: enabled && !!projectId,
    queryFn: async () => (projectId ? unwrap(await internalScheduleRepo.getState(projectId)) : null),
  });
}

/** Itens do cronograma interno da obra + datas do cliente para comparar. */
export function useInternalSchedule(projectId: string | undefined, opts: { enabled?: boolean } = {}) {
  const on = opts.enabled ?? true;
  const itemsQ = useQuery({
    queryKey: queryKeys.internalSchedule.byProject(projectId),
    enabled: on && !!projectId,
    queryFn: async () => (projectId ? unwrap(await internalScheduleRepo.listByProject(projectId)) : []),
  });
  const clientQ = useQuery({
    queryKey: queryKeys.internalSchedule.clientDates(projectId),
    enabled: on && !!projectId,
    staleTime: 60_000,
    queryFn: async () => (projectId ? unwrap(await internalScheduleRepo.listClientDates(projectId)) : []),
  });
  return {
    items: itemsQ.data ?? [],
    clientActivities: clientQ.data ?? [],
    isLoading: itemsQ.isLoading,
    /** As datas do cliente são complemento: falhar não derruba a tela. */
    clientLoaded: clientQ.isSuccess,
    error: itemsQ.error,
    refetch: itemsQ.refetch,
  };
}

/** Quantas atividades da Semana estão penduradas nestes itens (aviso ao apagar). */
export function useInternalScheduleOpsRefs(itemIds: readonly string[], enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.internalSchedule.opsRefs(itemIds),
    enabled: enabled && itemIds.length > 0,
    staleTime: 0,
    queryFn: async () => unwrap(await internalScheduleRepo.countOpsActivities(itemIds)) ?? 0,
  });
}

export function useInternalScheduleMutations(projectId: string | undefined) {
  const qc = useQueryClient();
  const listKey = queryKeys.internalSchedule.byProject(projectId);
  const onError = (fallback: string) => (error: unknown) => {
    toast.error(internalScheduleErrorMessage(error) || fallback);
  };
  const refresh = () => invalidateInternalScheduleQueries(qc);

  const create = useMutation({
    mutationFn: async (input: Omit<InternalScheduleInsert, "project_id">) => {
      if (!projectId) throw new Error("Obra não carregada");
      return unwrap(await internalScheduleRepo.create({ ...input, project_id: projectId }));
    },
    onError: onError("Não foi possível adicionar o item."),
    onSettled: refresh,
  });

  /** Atualização otimista: a linha muda na hora; em erro, volta. */
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: InternalSchedulePatch }) =>
      unwrap(await internalScheduleRepo.update(id, patch)),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<InternalScheduleItemWithRefs[]>(listKey);
      if (previous) {
        qc.setQueryData<InternalScheduleItemWithRefs[]>(
          listKey,
          previous.map((it) => (it.id === id ? { ...it, ...patch } : it)),
        );
      }
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
      toast.error(internalScheduleErrorMessage(error) || "Não foi possível salvar.");
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await internalScheduleRepo.remove(id)),
    onError: onError("Não foi possível excluir o item."),
    onSettled: refresh,
  });

  const reorder = useMutation({
    mutationFn: async (changes: Array<{ id: string; sort_order: number }>) =>
      unwrap(await internalScheduleRepo.reorder(changes)),
    onMutate: async (changes) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<InternalScheduleItemWithRefs[]>(listKey);
      if (previous) {
        const next = new Map(changes.map((c) => [c.id, c.sort_order]));
        qc.setQueryData<InternalScheduleItemWithRefs[]>(
          listKey,
          previous.map((it) => {
            const order = next.get(it.id);
            return order === undefined ? it : { ...it, sort_order: order };
          }),
        );
      }
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
      toast.error(internalScheduleErrorMessage(error) || "Não foi possível mudar a ordem.");
    },
    onSettled: refresh,
  });

  /** `replace` = apaga o interno e copia de novo do cliente. */
  const copyFromClient = useMutation({
    mutationFn: async (replace: boolean) => {
      if (!projectId) throw new Error("Obra não carregada");
      return unwrap(await internalScheduleRepo.copyFromClient(projectId, replace)) ?? 0;
    },
    onSuccess: (count) => {
      if (count > 0) toast.success(`${count} ${count === 1 ? "item copiado" : "itens copiados"} do cronograma do cliente`);
      else toast.info("O cronograma do cliente está vazio: nada foi copiado.");
    },
    onError: onError("Não foi possível copiar o cronograma do cliente."),
    onSettled: refresh,
  });

  return { create, update, remove, reorder, copyFromClient };
}
