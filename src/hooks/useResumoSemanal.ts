/**
 * useResumoSemanal — dados do "Resumo da semana" (diretoria).
 *
 * Reaproveita as linhas do Painel (`useObrasPainel`: risco, folga, multa,
 * alertas, responsável) e busca só o que o Painel não tem: os dias marcados
 * e os fechamentos das últimas 4 semanas terminadas (mais a semana corrente,
 * para saber quem já planejou). As contas ficam em `lib/resumoSemanal.ts`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { obrasPanelRepo } from "@/infra/repositories/obrasPanel.repository";
import { useObrasPainel } from "@/hooks/useObrasPainel";
import { todayISO } from "@/lib/hojeDia";
import { weekRange } from "@/lib/semanaPlan";
import { mapError } from "@/lib/errorMapping";
import { buildResumo, resumoWeeks, type ResumoSemanal } from "@/lib/resumoSemanal";

const unwrap = <T,>(res: { data: T[] | null; error: unknown }): T[] => {
  if (res.error) throw res.error;
  return res.data ?? [];
};

function friendlyError(error: unknown): string {
  const userMessage = (error as { userError?: { userMessage?: string } } | null)?.userError?.userMessage;
  return userMessage ?? mapError(error).userMessage;
}

export function useResumoSemanal() {
  const today = todayISO();
  const weeks = useMemo(() => resumoWeeks(today), [today]);
  // A semana do Painel é a corrente (segunda a domingo de hoje).
  const currentMonday = weeks.current;
  const week = useMemo(() => weekRange(currentMonday), [currentMonday]);
  const painel = useObrasPainel(week);

  const ids = useMemo(() => painel.rows.map((r) => r.id).sort(), [painel.rows]);
  const enabled = !painel.isLoading && ids.length > 0;

  const assignmentsQ = useQuery({
    queryKey: queryKeys.obrasPanel.resumoAssignments(ids, weeks.from, weeks.to),
    enabled,
    staleTime: 60_000,
    queryFn: async () => unwrap(await obrasPanelRepo.listAssignments(ids, weeks.from, weeks.to)),
  });
  const closingsQ = useQuery({
    queryKey: queryKeys.obrasPanel.resumoClosings(ids, weeks.history[0], weeks.last),
    enabled,
    staleTime: 60_000,
    queryFn: async () => unwrap(await obrasPanelRepo.listClosings(ids, weeks.history[0], weeks.last)),
  });

  // Início da execução de cada obra (real; na falta, o previsto): semanas
  // anteriores a ele não contam na adoção do gestor.
  const startedOn = useMemo(
    () => new Map(painel.rows.map((r) => {
      const o = painel.obraById.get(r.id);
      return [r.id, o?.inicio_real ?? o?.inicio_oficial ?? null] as const;
    })),
    [painel.rows, painel.obraById],
  );

  const resumo = useMemo<ResumoSemanal>(
    () =>
      buildResumo({
        rows: painel.rows,
        assignments: assignmentsQ.data ?? [],
        closings: closingsQ.data ?? [],
        today,
        startedOn,
      }),
    [painel.rows, assignmentsQ.data, closingsQ.data, today, startedOn],
  );

  const historyError = assignmentsQ.error ?? closingsQ.error ?? null;
  const isLoading = painel.isLoading || (enabled && (assignmentsQ.isLoading || closingsQ.isLoading));

  return {
    resumo,
    isLoading,
    /** Erro das obras (sem isso não há resumo nenhum). */
    error: painel.error,
    /** Erro só do planejamento semanal (PPC, motivos e adoção ficam sem dados). */
    historyError: historyError ? friendlyError(historyError) : null,
    refetch: () => {
      painel.refetch();
      void assignmentsQ.refetch();
      void closingsQ.refetch();
    },
  };
}
