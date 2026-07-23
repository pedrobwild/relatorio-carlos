/**
 * useInternalWeeklyReports — Onda F (staff-only).
 *
 * Lista e geração sob demanda de relatórios executivos internos. Não impacta
 * o fluxo de weekly_reports do cliente (tabela separada, rota separada).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { internalWeeklyReportsRepo } from "@/infra/repositories/internalWeeklyReports.repository";
import { invokeFunction } from "@/infra/edgeFunctions";

const KEY = ["internal-weekly-reports"] as const;

export function useInternalWeeklyReports(filters?: {
  projectId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...KEY, "list", filters ?? null],
    queryFn: async () => {
      const res = await internalWeeklyReportsRepo.list(filters);
      if (res.error) throw res.error;
      return res.data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useInternalWeeklyReport(projectId?: string, weekStart?: string) {
  return useQuery({
    queryKey: [...KEY, "detail", projectId, weekStart],
    enabled: !!projectId && !!weekStart,
    queryFn: async () => {
      const res = await internalWeeklyReportsRepo.getByProjectAndWeek(
        projectId as string,
        weekStart as string,
      );
      if (res.error) throw res.error;
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useGenerateInternalWeeklyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; weekStart?: string }) => {
      const res = await invokeFunction<{ ok: boolean; report: unknown }>(
        "generate-internal-weekly-report",
        input,
      );
      return res;
    },
    onSuccess: () => {
      toast.success("Relatório interno gerado");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Falha ao gerar relatório";
      toast.error(msg);
    },
  });
}

export function useDeleteInternalWeeklyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await internalWeeklyReportsRepo.softDelete(id);
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      toast.success("Relatório removido");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Falha ao remover";
      toast.error(msg);
    },
  });
}

/** Segunda-feira 00:00 UTC da semana informada (ou da semana atual). */
export function getISOWeekStart(from: Date = new Date()): string {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const dow = d.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
