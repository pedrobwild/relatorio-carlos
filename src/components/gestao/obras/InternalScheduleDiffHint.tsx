/**
 * "N diferenças com o cliente" na gaveta do Painel: só quando a equipe já
 * editou o cronograma interno (enquanto acompanha o cliente, as datas são as
 * dele). Conta itens ligados ao cliente com datas previstas diferentes.
 */
import { useMemo } from "react";
import { useInternalSchedule, useInternalScheduleState } from "@/hooks/useInternalSchedule";
import { countClientDifferences, type ClientDatesLike } from "@/lib/internalSchedule";

export function InternalScheduleDiffHint({ projectId }: { projectId: string }) {
  const stateQ = useInternalScheduleState(projectId);
  const customized = !!stateQ.data?.customized_at;
  const { items, clientActivities, clientLoaded } = useInternalSchedule(projectId, { enabled: customized });
  const n = useMemo(
    () => countClientDifferences(items, new Map<string, ClientDatesLike>(clientActivities.map((a) => [a.id, a]))),
    [items, clientActivities],
  );
  if (!customized || !clientLoaded || n === 0) return null;
  return (
    <span className="block text-xs font-medium" data-testid="drawer-internal-diffs">
      {n} {n === 1 ? "diferença" : "diferenças"} com o cliente
    </span>
  );
}
