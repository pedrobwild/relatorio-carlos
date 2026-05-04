/**
 * useNonWorkingDays — leitura e escrita de dias não úteis customizados
 * (feriados específicos da obra ou folgas) registrados em
 * `project_non_working_days`.
 *
 * Escopo:
 *   - project_id: null → entrada global (vale para todas as obras)
 *   - project_id: uuid → entrada específica de uma obra
 *
 * O hook combina ambas as listas (globais + da obra alvo, quando informada),
 * expondo helpers utilitários para verificação e formatação.
 *
 * Apenas Admin/Engineer podem criar/remover (RLS reforça server-side).
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export interface NonWorkingDay {
  id: string;
  project_id: string | null;
  day: string; // YYYY-MM-DD
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface NewNonWorkingDay {
  project_id: string | null;
  day: string; // YYYY-MM-DD
  reason?: string | null;
}

const QUERY_KEY = ["non-working-days"] as const;

async function fetchNonWorkingDays(): Promise<NonWorkingDay[]> {
  const { data, error } = await supabase
    .from("project_non_working_days")
    .select("id, project_id, day, reason, created_at, created_by")
    .order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []) as NonWorkingDay[];
}

export function useNonWorkingDays(projectId?: string | null) {
  const queryClient = useQueryClient();

  const { data: all = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchNonWorkingDays,
    staleTime: 60_000,
  });

  /** Conjunto efetivo (globais + da obra atual quando informada). */
  const effective = useMemo(() => {
    if (!projectId) return all;
    return all.filter(
      (d) => d.project_id === null || d.project_id === projectId,
    );
  }, [all, projectId]);

  /** Set de YYYY-MM-DD para checagem O(1). */
  const dateSet = useMemo(
    () => new Set(effective.map((d) => d.day)),
    [effective],
  );

  const isNonWorking = (date: Date): boolean =>
    dateSet.has(format(date, "yyyy-MM-dd"));
  const reasonFor = (date: Date): string | null => {
    const key = format(date, "yyyy-MM-dd");
    return effective.find((d) => d.day === key)?.reason ?? null;
  };

  const create = useMutation({
    mutationFn: async (input: NewNonWorkingDay) => {
      const { data, error } = await supabase
        .from("project_non_working_days")
        .insert({
          project_id: input.project_id,
          day: input.day,
          reason: input.reason ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as NonWorkingDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Dia não útil registrado");
    },
    onError: (err: any) => {
      const msg = err?.message ?? "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error(
          "Esta data já está marcada como não útil para o escopo selecionado",
        );
      } else {
        toast.error("Não foi possível registrar o dia não útil");
      }
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_non_working_days")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Dia não útil removido");
    },
    onError: () => toast.error("Erro ao remover dia não útil"),
  });

  return {
    /** Todos os dias não úteis cadastrados (globais + por obra). */
    all,
    /** Lista efetiva para o projectId (ou todos quando nenhum projectId for passado). */
    effective,
    dateSet,
    isNonWorking,
    reasonFor,
    isLoading,
    create: (input: NewNonWorkingDay) => create.mutateAsync(input),
    isCreating: create.isPending,
    remove: (id: string) => remove.mutateAsync(id),
    isRemoving: remove.isPending,
  };
}
