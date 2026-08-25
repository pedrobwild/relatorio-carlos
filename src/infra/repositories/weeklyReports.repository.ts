/**
 * Weekly Reports Repository
 *
 * Salvamento versionado dos relatórios semanais.
 *
 * O salvamento usa a RPC `save_weekly_report`, que aplica controle de
 * concorrência otimista: quem salva envia o `updated_at` da versão que
 * carregou. Se o registro no servidor mudou nesse meio tempo, a gravação é
 * recusada (conflito) em vez de sobrescrever o trabalho de outra pessoa
 * (last-write-wins).
 *
 * Cada gravação gera automaticamente uma entrada em `weekly_report_versions`
 * (texto + fotos completos), permitindo restaurar versões anteriores.
 */

import { executeQuery, executeListQuery, supabase } from "./base.repository";
import type { Json } from "@/integrations/supabase/types";
import type { WeeklyReportData } from "@/types/weeklyReport";

export const WEEKLY_REPORT_CONFLICT = "WEEKLY_REPORT_CONFLICT";

export interface WeeklyReportRow {
  id: string;
  project_id: string;
  week_number: number;
  week_start: string;
  week_end: string;
  available_at: string | null;
  data: Json;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface WeeklyReportVersion {
  id: string;
  report_id: string;
  project_id: string;
  week_number: number;
  version: number;
  data: WeeklyReportData;
  restored_from_version: number | null;
  created_by: string | null;
  created_at: string;
}

/** True quando o erro veio do controle de concorrência da RPC. */
export function isConflictError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { message?: string; code?: string };
  return (
    e.code === "40001" || (e.message ?? "").includes(WEEKLY_REPORT_CONFLICT)
  );
}

interface SaveWeeklyReportInput {
  projectId: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  data: WeeklyReportData;
  /** `updated_at` da versão carregada pelo editor. null = criação. */
  expectedUpdatedAt: string | null;
}

export async function saveWeeklyReport(input: SaveWeeklyReportInput) {
  return executeQuery<WeeklyReportRow>(async () => {
    const { data, error } = await supabase.rpc("save_weekly_report", {
      p_project_id: input.projectId,
      p_week_number: input.weekNumber,
      p_week_start: input.weekStart,
      p_week_end: input.weekEnd,
      p_data: input.data as unknown as Json,
      p_expected_updated_at: input.expectedUpdatedAt,
    });
    return {
      data: (data as unknown as WeeklyReportRow) ?? null,
      error,
    };
  });
}

export async function listVersions(
  projectId: string,
  weekNumber: number,
  limit = 30,
) {
  return executeListQuery<WeeklyReportVersion>(async () => {
    const { data, error } = await supabase
      .from("weekly_report_versions")
      .select("*")
      .eq("project_id", projectId)
      .eq("week_number", weekNumber)
      .order("version", { ascending: false })
      .limit(limit);
    return {
      data: (data as unknown as WeeklyReportVersion[]) ?? [],
      error,
    };
  });
}

export async function restoreVersion(versionId: string) {
  return executeQuery<WeeklyReportRow>(async () => {
    const { data, error } = await supabase.rpc(
      "restore_weekly_report_version",
      { p_version_id: versionId },
    );
    return {
      data: (data as unknown as WeeklyReportRow) ?? null,
      error,
    };
  });
}
