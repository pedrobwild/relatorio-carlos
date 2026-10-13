/**
 * useEtapasHoje — etapas do cronograma interno que pedem "Começou?" ou
 * "Terminou?" hoje, e a gravação com um toque (com desfazer).
 *
 * Lê o que o previsto cruza hoje e o que passou do fim sem término real.
 * Grava como o Calendário e o Lookahead: no item interno e, se for etapa de
 * 1º nível ligada ao cliente, também no cronograma do cliente
 * (`updateInternalMirroringClient`). Toda gravação relê Painel, Semana etc.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateInternalScheduleQueries, queryKeys } from "@/lib/queryKeys";
import { internalScheduleRepo } from "@/infra/repositories/internalSchedule.repository";
import { internalScheduleErrorMessage, updateInternalMirroringClient } from "@/hooks/useInternalSchedule";
import { etapasParaConfirmar, type EtapaHojeInput, type ObraEtapasHoje } from "@/lib/etapasHoje";

type Datas = { actual_start?: string | null; actual_end?: string | null };

export function useEtapasHoje(today: string, enabled = true) {
  const qc = useQueryClient();
  const key = queryKeys.internalSchedule.confirmarHoje(today);

  const q = useQuery({
    queryKey: key,
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<EtapaHojeInput[]> => {
      const [now, late] = await Promise.all([
        internalScheduleRepo.listInRange(today, today),
        internalScheduleRepo.listOpenEndingBefore(today),
      ]);
      if (now.error) throw now.error;
      if (late.error) throw late.error;
      const seen = new Set<string>();
      const out: EtapaHojeInput[] = [];
      for (const r of [...now.data, ...late.data]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push({
          id: r.id,
          project_id: r.project_id,
          parent_id: r.parent_id,
          client_activity_id: r.client_activity_id,
          description: r.description,
          planned_start: r.planned_start,
          planned_end: r.planned_end,
          actual_start: r.actual_start,
          actual_end: r.actual_end,
          responsible_user_id: r.responsible_user_id,
          sort_order: r.sort_order,
          project: r.project ? { name: r.project.name, status: r.project.status } : null,
        });
      }
      return out;
    },
  });

  const groups = useMemo<ObraEtapasHoje[]>(() => etapasParaConfirmar(q.data ?? [], today), [q.data, today]);

  const save = useMutation({
    mutationFn: async ({ item, datas }: { item: EtapaHojeInput; datas: Datas }) => {
      await updateInternalMirroringClient(item, datas);
      return item.id;
    },
    // A tela muda na hora; volta ao que era se o banco recusar.
    onMutate: async ({ item, datas }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<EtapaHojeInput[]>(key);
      if (prev) qc.setQueryData<EtapaHojeInput[]>(key, prev.map((x) => (x.id === item.id ? { ...x, ...datas } : x)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(internalScheduleErrorMessage(e) || "Não deu para salvar. Tente de novo.");
    },
    onSettled: () => invalidateInternalScheduleQueries(qc),
  });

  return {
    groups,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
    /** Grava as datas; `undo` devolve as datas anteriores do item. */
    responder: (item: EtapaHojeInput, datas: Datas) => {
      const before: Datas = {};
      if ("actual_start" in datas) before.actual_start = item.actual_start;
      if ("actual_end" in datas) before.actual_end = item.actual_end;
      save.mutate({ item, datas });
      return () => save.mutate({ item: { ...item, ...datas }, datas: before });
    },
    isSaving: save.isPending,
  };
}
