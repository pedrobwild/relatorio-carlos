/**
 * Hooks das menções em observações internas (pendências entre a equipe).
 * Só equipe: o banco não devolve nada disso ao cliente, e as consultas nem
 * são feitas sem a permissão `internal_notes:view`.
 */
import { useEffect, useId, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/infra/supabase";
import {
  internalNoteMentionsRepo,
  type InternalNoteMention,
  type OpenInternalNoteMention,
} from "@/infra/repositories/internalNoteMentions.repository";
import { useAuth } from "@/hooks/useAuth";
import { useCanFeature } from "@/hooks/useCan";
import { mapError } from "@/lib/errorMapping";
import { agruparMencoes } from "@/lib/mencoes";
import { queryKeys } from "@/lib/queryKeys";

const STALE_TIME = 30_000;

const unwrap = <T,>(res: { data: T | null; error: unknown }): T => {
  if (res.error) throw res.error;
  return res.data as T;
};

/** Menções da obra, agrupadas por observação (para o card da obra). */
export function useProjectNoteMentions(projectId: string | undefined) {
  const canView = useCanFeature("internal_notes:view");
  const enabled = !!projectId && canView;
  const qc = useQueryClient();
  const instanceId = useId();

  const query = useQuery({
    queryKey: queryKeys.internalNoteMentions.byProject(projectId),
    queryFn: async () => unwrap(await internalNoteMentionsRepo.listByProject(projectId as string)),
    enabled,
    staleTime: STALE_TIME,
  });

  useEffect(() => {
    if (!enabled || !projectId) return;
    const channel = supabase
      .channel(`internal-note-mentions-${projectId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_internal_note_mentions", filter: `project_id=eq.${projectId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.internalNoteMentions.all });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, projectId, instanceId, qc]);

  const byNote = useMemo(() => {
    const map = new Map<string, InternalNoteMention[]>();
    for (const m of query.data ?? []) {
      const list = map.get(m.note_id);
      if (list) list.push(m);
      else map.set(m.note_id, [m]);
    }
    return map;
  }, [query.data]);

  return { byNote, isLoading: query.isLoading };
}

/**
 * Pendências de quem está logado: o que marcaram com ele, o que ele pediu e
 * ainda está aberto, e o que está atrasado nas obras em que é o responsável.
 */
export function useMinhasMencoes() {
  const { user } = useAuth();
  const canView = useCanFeature("internal_notes:view");
  const enabled = !!user?.id && canView;

  const query = useQuery({
    queryKey: queryKeys.internalNoteMentions.open(),
    queryFn: async () => unwrap(await internalNoteMentionsRepo.listOpen()),
    enabled,
    staleTime: STALE_TIME,
    refetchInterval: 2 * 60_000,
  });

  const grupos = useMemo(
    () => agruparMencoes<OpenInternalNoteMention>(query.data ?? [], user?.id, new Date()),
    // Recalcula a cada leitura (o atraso depende da hora).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, query.dataUpdatedAt, user?.id],
  );

  return { ...grupos, enabled, isLoading: enabled && query.isLoading, isError: query.isError, refetch: query.refetch };
}

function useInvalidateMentions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.internalNoteMentions.all });
}

/** Marca pessoas da equipe em uma observação (quem escreveu a observação). */
export function useSetNoteMentions() {
  const invalidate = useInvalidateMentions();
  return useMutation({
    mutationFn: async ({ noteId, userIds }: { noteId: string; userIds: string[] }) =>
      unwrap(await internalNoteMentionsRepo.setMentions(noteId, userIds)),
    onSuccess: (avisados) => {
      void invalidate();
      if (avisados > 0) toast.success(avisados === 1 ? "1 pessoa avisada" : `${avisados} pessoas avisadas`);
    },
    onError: (e) => {
      toast.error("A observação foi registrada, mas não deu para marcar as pessoas.", {
        description: mapError(e).userMessage,
      });
    },
  });
}

/** Resolve uma pendência (só quem foi marcado), com resposta opcional. */
export function useResolveMention() {
  const invalidate = useInvalidateMentions();
  return useMutation({
    mutationFn: async ({ mentionId, resposta }: { mentionId: string; resposta: string | null }) =>
      unwrap(await internalNoteMentionsRepo.resolve(mentionId, resposta)),
    onSuccess: () => {
      void invalidate();
      toast.success("Pendência resolvida");
    },
    onError: (e) => {
      toast.error("Não deu para resolver a pendência.", { description: mapError(e).userMessage });
    },
  });
}
