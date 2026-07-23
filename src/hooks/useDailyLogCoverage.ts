/**
 * useDailyLogCoverage — cobertura de RDO por obra × dia (staff-only).
 *
 * Consulta project_daily_logs no período informado, filtrando pelas obras
 * repassadas. Retorna um Set com chave `${projectId}__${YYYY-MM-DD}` para
 * lookup O(1) na grade da página /gestao/diario.
 *
 * RLS já restringe leitura ao staff; nenhuma superfície de cliente consome
 * este hook.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface DailyLogCoverage {
  /** Chave `${projectId}__${YYYY-MM-DD}`. */
  filled: Set<string>;
  /** Timestamp da última atualização por (projeto, data). */
  updatedAt: Map<string, string>;
}

const STALE = 60_000;

export function useDailyLogCoverage(
  projectIds: string[] | undefined,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: queryKeys.diario.coverage(projectIds, startDate, endDate),
    enabled: !!projectIds && projectIds.length > 0,
    staleTime: STALE,
    queryFn: async (): Promise<DailyLogCoverage> => {
      const ids = projectIds ?? [];
      if (ids.length === 0) {
        return { filled: new Set(), updatedAt: new Map() };
      }
      const { data, error } = await supabase
        .from("project_daily_logs")
        .select("project_id, log_date, updated_at")
        .in("project_id", ids)
        .gte("log_date", startDate)
        .lte("log_date", endDate);
      if (error) throw error;
      const filled = new Set<string>();
      const updatedAt = new Map<string, string>();
      for (const row of data ?? []) {
        const key = `${row.project_id}__${row.log_date}`;
        filled.add(key);
        if (row.updated_at) updatedAt.set(key, row.updated_at);
      }
      return { filled, updatedAt };
    },
  });
}

/**
 * Constrói uma sequência de datas ISO (YYYY-MM-DD) em ordem crescente
 * entre `start` e `end` (inclusive). Trabalha em horário local para
 * evitar deslocamento por UTC.
 */
export function eachDateInclusive(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
