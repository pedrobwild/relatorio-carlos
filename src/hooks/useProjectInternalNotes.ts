/**
 * Observações internas da obra — hooks TanStack Query (staff-only).
 *
 * O cliente nunca recebe estas notas: a RLS de `project_internal_notes`
 * exige `is_staff()`. Os hooks ainda se desligam (`enabled`) para quem não
 * tem `internal_notes:view`, para não disparar requests inúteis.
 *
 * Erros de mutation não fazem toast aqui: o `mutationCache.onError` global
 * (src/lib/queryClient.ts) já traduz e exibe. Lançamos o erro do repositório
 * cru (PostgrestError + userError) para ele mapear o código certo.
 */
import { useEffect, useId, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/infra/supabase";
import {
  projectInternalNotesRepo,
  type CreateInternalNoteInput,
  type ProjectInternalNote,
  type UpdateInternalNoteInput,
} from "@/infra/repositories";
import { queryKeys } from "@/lib/queryKeys";
import { useCanFeature } from "@/hooks/useCan";

const STALE_TIME = 30_000;

/** Feed de uma obra + atualização em tempo real enquanto a tela está aberta. */
export function useProjectInternalNotes(projectId: string | undefined) {
  const canView = useCanFeature("internal_notes:view");
  const enabled = !!projectId && canView;
  const qc = useQueryClient();
  const instanceId = useId();

  const query = useQuery({
    queryKey: queryKeys.internalNotes.byProject(projectId),
    queryFn: async () => {
      if (!projectId) return [];
      const result = await projectInternalNotesRepo.listByProject(projectId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled,
    staleTime: STALE_TIME,
  });

  useEffect(() => {
    if (!enabled || !projectId) return;
    const channel = supabase
      .channel(`internal-notes-${projectId}-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_internal_notes",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // Recarrega feed e fixadas (Painel/CS) — a ordem e o "fixado"
          // dependem do trigger, então refetch é mais seguro que patch local.
          qc.invalidateQueries({ queryKey: queryKeys.internalNotes.all });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, projectId, instanceId, qc]);

  return query;
}

/**
 * Nota fixada ("status atual") de cada obra, numa única query.
 * Para indicadores em listas (Painel de Obras, CS).
 */
export function usePinnedInternalNotes() {
  const canView = useCanFeature("internal_notes:view");

  const query = useQuery({
    queryKey: queryKeys.internalNotes.pinned(),
    queryFn: async () => {
      const result = await projectInternalNotesRepo.listPinned();
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: canView,
    staleTime: STALE_TIME,
  });

  const byProjectId = useMemo(() => {
    const map = new Map<string, ProjectInternalNote>();
    // Ordenado por updated_at desc: se houver mais de uma, a mais recente vence.
    for (const note of query.data ?? []) {
      if (!map.has(note.project_id)) map.set(note.project_id, note);
    }
    return map;
  }, [query.data]);

  return { byProjectId, isLoading: query.isLoading, error: query.error };
}

function useInvalidateInternalNotes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.internalNotes.all });
}

export function useCreateInternalNote() {
  const invalidate = useInvalidateInternalNotes();
  return useMutation({
    mutationFn: async (input: CreateInternalNoteInput) => {
      const result = await projectInternalNotesRepo.create(input);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Observação interna registrada");
    },
  });
}

export function useUpdateInternalNote() {
  const invalidate = useInvalidateInternalNotes();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateInternalNoteInput;
    }) => {
      const result = await projectInternalNotesRepo.update(id, input);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Observação atualizada");
    },
  });
}

export function useSetInternalNotePinned() {
  const invalidate = useInvalidateInternalNotes();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const result = await projectInternalNotesRepo.setPinned(id, pinned);
      if (result.error) throw result.error;
      return pinned;
    },
    onSuccess: (pinned) => {
      void invalidate();
      toast.success(
        pinned ? "Fixada como status atual da obra" : "Observação desafixada",
      );
    },
  });
}

export function useDeleteInternalNote() {
  const invalidate = useInvalidateInternalNotes();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await projectInternalNotesRepo.softDelete(id);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Observação removida");
    },
  });
}
