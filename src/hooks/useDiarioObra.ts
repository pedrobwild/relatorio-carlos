/**
 * Hooks do Diário de obra — ver `diarioObra.repository.ts` e
 * `src/lib/diarioObra/regras.ts`.
 *
 * As listas (obras, etapas, equipe, itens) ficam no cache persistido das
 * consultas, então a tela abre sem sinal com o que foi visto por último.
 */
import { useMemo, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { diarioObraRepo, type DiarioRelatoRow } from "@/infra/repositories/diarioObra.repository";
import { getDiarioOutbox } from "@/lib/offline/diarioSync";
import type { DiarioPendente } from "@/lib/offline/diarioOutbox";
import type { EtapaCronograma } from "@/lib/diarioObra/regras";

const unwrap = <T,>(res: { data: T | null; error: unknown }): T => {
  if (res.error) throw res.error;
  return res.data as T;
};

export function useDiarioObras() {
  return useQuery({
    queryKey: queryKeys.diarioObra.obras(),
    queryFn: async () => unwrap(await diarioObraRepo.listObras()),
    staleTime: 5 * 60_000,
  });
}

/**
 * Etapas do cronograma interno no nível em que se trabalha: etapa com
 * micro-etapas não aparece (relata-se cada micro-etapa), como no Hoje e em
 * "Atualizar etapas".
 */
export function useDiarioEtapas(projectId: string | null) {
  const q = useQuery({
    queryKey: queryKeys.diarioObra.etapas(projectId),
    enabled: !!projectId,
    queryFn: async () => unwrap(await diarioObraRepo.listEtapas(projectId as string)),
  });
  const etapas = useMemo<EtapaCronograma[]>(() => {
    const rows = q.data ?? [];
    const comFilhas = new Set(rows.flatMap((r) => (r.parent_id ? [r.parent_id] : [])));
    return rows
      .filter((r) => !comFilhas.has(r.id))
      .map((r) => ({
        id: r.id,
        description: r.description,
        plannedStart: r.planned_start,
        plannedEnd: r.planned_end,
        actualEnd: r.actual_end,
        sortOrder: r.sort_order,
      }));
  }, [q.data]);
  return { etapas, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

/** Último relato de cada etapa da obra (o cartão "relatório cadastrado"). */
export function useDiarioRelatos(projectId: string | null) {
  const q = useQuery({
    queryKey: queryKeys.diarioObra.relatos(projectId),
    enabled: !!projectId,
    queryFn: async () => unwrap(await diarioObraRepo.listRelatos(projectId as string)),
  });
  const porEtapa = useMemo(() => {
    const map = new Map<string, DiarioRelatoRow>();
    // Já vêm do mais recente para o mais antigo: o primeiro de cada etapa vale.
    for (const r of q.data ?? []) if (r.item_id && !map.has(r.item_id)) map.set(r.item_id, r);
    return map;
  }, [q.data]);
  return { porEtapa, isLoading: q.isLoading };
}

export function useDiarioEquipe(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.diarioObra.equipe(projectId),
    enabled: !!projectId,
    queryFn: async () => unwrap(await diarioObraRepo.listEquipe(projectId as string)),
    staleTime: 10 * 60_000,
  });
}

export function useDiarioItensMaterial(projectId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.diarioObra.itensMaterial(projectId),
    enabled: enabled && !!projectId,
    queryFn: async () => unwrap(await diarioObraRepo.listItensMaterial(projectId as string)),
    staleTime: 10 * 60_000,
  });
}

export function useDiarioFornecedores(termo: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.diarioObra.fornecedores(termo.trim().toLowerCase()),
    enabled,
    queryFn: async () => unwrap(await diarioObraRepo.buscarFornecedores(termo)),
    staleTime: 10 * 60_000,
  });
}

/** URLs das fotos de etapa (bucket do relatório semanal). */
export function useDiarioFotos(paths: readonly string[]) {
  return useQuery({
    queryKey: queryKeys.diarioObra.fotos(paths),
    enabled: paths.length > 0,
    queryFn: async () => unwrap(await diarioObraRepo.urlsDasFotos([...paths])),
    staleTime: 30 * 60_000,
  });
}

export function useSalvarTextoCliente(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etapaId, texto }: { etapaId: string; texto: string }) =>
      unwrap(await diarioObraRepo.salvarTextoCliente(etapaId, texto)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.diarioObra.relatos(projectId) });
      void qc.invalidateQueries({ queryKey: queryKeys.weeklyReports.all });
    },
  });
}

const subscribe = (cb: () => void) => getDiarioOutbox().subscribe(cb);
const snapshot = () => getDiarioOutbox().getSnapshot();
const EMPTY: readonly DiarioPendente[] = [];

/** Relatos deste usuário ainda no aparelho: aguardando sinal ou recusados. */
export function useDiarioFila(userId: string | null | undefined) {
  const todos = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return useMemo(() => {
    const meus = todos.filter((i) => i.userId === userId);
    return { aguardando: meus.filter((i) => !i.failed), recusados: meus.filter((i) => i.failed) };
  }, [todos, userId]);
}
