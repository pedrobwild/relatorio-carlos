/**
 * Auditoria de relatórios semanais (staff-only).
 *
 * Cada salvamento de relatório gera uma versão em `weekly_report_versions`.
 * Aqui lemos essas versões de forma consolidada (todas as obras) para
 * diagnosticar rapidamente "apagões": quem salvou, quando, e o que foi
 * enviado (texto, fotos, atividades).
 *
 * Leitura via RPCs SECURITY DEFINER (`get_weekly_report_audit` e
 * `get_weekly_report_audit_payload`), que aplicam guard `is_staff`.
 */

import { executeQuery, executeListQuery, supabase } from "./base.repository";
import type { WeeklyReportData } from "@/types/weeklyReport";

export interface WeeklyReportAuditEntry {
  version_id: string;
  report_id: string;
  project_id: string;
  project_name: string;
  week_number: number;
  version: number;
  restored_from_version: number | null;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
  author_email: string | null;
  gallery_count: number;
  summary_chars: number;
  activities_count: number;
  risks_count: number;
  payload_bytes: number;
  is_empty: boolean;
  total_count: number;
}

export interface WeeklyReportAuditFilters {
  projectId?: string;
  weekNumber?: number;
  search?: string;
  onlyEmpty?: boolean;
  limit?: number;
  offset?: number;
}

export async function listAudit(filters: WeeklyReportAuditFilters = {}) {
  return executeListQuery<WeeklyReportAuditEntry>(async () => {
    const { data, error } = await supabase.rpc("get_weekly_report_audit", {
      p_project_id: filters.projectId ?? undefined,
      p_week_number: filters.weekNumber ?? undefined,
      p_search: filters.search?.trim() || undefined,
      p_only_empty: filters.onlyEmpty ?? false,
      p_limit: filters.limit ?? 50,
      p_offset: filters.offset ?? 0,
    });
    return {
      data: (data as unknown as WeeklyReportAuditEntry[]) ?? [],
      error,
    };
  });
}

export async function getAuditPayload(versionId: string) {
  return executeQuery<WeeklyReportData | null>(async () => {
    const { data, error } = await supabase.rpc(
      "get_weekly_report_audit_payload",
      { p_version_id: versionId },
    );
    return {
      data: (data as unknown as WeeklyReportData) ?? null,
      error,
    };
  });
}
