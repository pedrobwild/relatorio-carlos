/**
 * useAtualizarEtapas — etapas do cronograma interno de UMA obra para a tela
 * "Atualizar etapas" (equipe, celular) e a gravação das datas reais.
 *
 * Grava como o Hoje (`useEtapasHoje`): no item interno e, se for etapa de 1º
 * nível ligada ao cliente, também no cronograma do cliente
 * (`updateInternalMirroringClient`). A lista muda na hora e volta se o banco
 * recusar; toda gravação relê Painel, Semana, Hoje etc.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateInternalScheduleQueries, queryKeys } from "@/lib/queryKeys";
import {
  internalScheduleErrorMessage,
  updateInternalMirroringClient,
  useInternalSchedule,
} from "@/hooks/useInternalSchedule";
import type { InternalScheduleItemWithRefs } from "@/infra/repositories/internalSchedule.repository";
import { patchParaDesfazer, type DatasReaisPatch } from "@/lib/datasReais";

export function useAtualizarEtapas(projectId: string | undefined) {
  const qc = useQueryClient();
  const listKey = queryKeys.internalSchedule.byProject(projectId);
  const { items, isLoading, error, refetch } = useInternalSchedule(projectId);

  const save = useMutation({
    mutationFn: async ({ item, patch }: { item: InternalScheduleItemWithRefs; patch: DatasReaisPatch }) => {
      await updateInternalMirroringClient(item, patch);
      return item.id;
    },
    onMutate: async ({ item, patch }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<InternalScheduleItemWithRefs[]>(listKey);
      if (previous) {
        qc.setQueryData<InternalScheduleItemWithRefs[]>(
          listKey,
          previous.map((it) => (it.id === item.id ? { ...it, ...patch } : it)),
        );
      }
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
      toast.error(internalScheduleErrorMessage(e) || "Não deu para salvar. Tente de novo.");
    },
    onSettled: () => invalidateInternalScheduleQueries(qc),
  });

  return {
    items,
    isLoading,
    error,
    refetch,
    isSaving: save.isPending,
    /** Já houve gravação concluída nesta visita (para o "Salvo" do cabeçalho). */
    hasSaved: save.isSuccess,
    /** Grava as datas; devolve o `desfazer`, que repõe as datas anteriores. */
    gravar: (item: InternalScheduleItemWithRefs, patch: DatasReaisPatch) => {
      const antes = patchParaDesfazer(item, patch);
      save.mutate({ item, patch });
      return () => save.mutate({ item: { ...item, ...patch }, patch: antes });
    },
  };
}
