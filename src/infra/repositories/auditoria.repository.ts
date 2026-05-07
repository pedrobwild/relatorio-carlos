/**
 * Auditoria Repository
 *
 * Handles audit trail data access with filtering and pagination.
 */

import { supabase, getPaginationRange, type PaginationParams } from "./base.repository";
import type { Database } from "@/integrations/supabase/types";

export type AuditoriaRow = Database["public"]["Tables"]["auditoria"]["Row"];
export type AuditoriaAcao = Database["public"]["Enums"]["auditoria_acao"];

export interface AuditoriaWithUser extends AuditoriaRow {
  users_profile?: {
    nome: string | null;
    email: string | null;
  } | null;
}

export interface AuditoriaFilters extends PaginationParams {
  obra_id?: string;
  user_id?: string;
  acao?: AuditoriaAcao;
  entidade?: string;
  entidade_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface AuditoriaListResult {
  data: AuditoriaWithUser[];
  count: number;
  error: Error | null;
}

/**
 * List audit records with filters and pagination
 */
export async function listAudits(
  filters: AuditoriaFilters = {},
): Promise<AuditoriaListResult> {
  const { page = 1, pageSize = 20 } = filters;
  const { from, to } = getPaginationRange({ page, pageSize });

  let query = supabase
    .from("auditoria")
    .select(
      `
      *,
      users_profile:por_user_id (
        nome,
        email
      )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  // Apply filters
  if (filters.obra_id) {
    query = query.eq("obra_id", filters.obra_id);
  }

  if (filters.user_id) {
    query = query.eq("por_user_id", filters.user_id);
  }

  if (filters.acao) {
    query = query.eq("acao", filters.acao);
  }

  if (filters.entidade) {
    query = query.eq("entidade", filters.entidade);
  }

  if (filters.entidade_id) {
    query = query.eq("entidade_id", filters.entidade_id);
  }

  if (filters.date_from) {
    query = query.gte("created_at", filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte("created_at", filters.date_to);
  }

  if (filters.search) {
    // Sanitize search input to prevent SQL injection via ilike patterns
    const sanitized = filters.search.replace(/[%_\\]/g, "");
    if (sanitized.length > 0) {
      query = query.or(
        `entidade.ilike.%${sanitized}%,entidade_id.ilike.%${sanitized}%`,
      );
    }
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching audits:", error);
    return { data: [], count: 0, error };
  }

  return {
    data: (data as AuditoriaWithUser[]) || [],
    count: count || 0,
    error: null,
  };
}

/**
 * Get contextual audit trail for a specific entity
 */
export async function getEntityAuditTrail(
  entidade: string,
  entidade_id: string,
  limit: number = 10,
): Promise<AuditoriaWithUser[]> {
  const { data, error } = await supabase
    .from("auditoria")
    .select(
      `
      *,
      users_profile:por_user_id (
        nome,
        email
      )
    `,
    )
    .eq("entidade", entidade)
    .eq("entidade_id", entidade_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching entity audit trail:", error);
    return [];
  }

  return (data as AuditoriaWithUser[]) || [];
}

/**
 * Get distinct entity types for filter dropdown
 */
export async function getDistinctEntityTypes(): Promise<string[]> {
  // Use a distinct-like approach: fetch all unique entity types
  // Note: Supabase doesn't support DISTINCT directly, so we use a larger limit
  // and deduplicate client-side. This covers all realistic entity type counts.
  const { data, error } = await supabase
    .from("auditoria")
    .select("entidade")
    .limit(5000);

  if (error || !data) return [];

  const uniqueTypes = [...new Set(data.map((d) => d.entidade))];
  return uniqueTypes.sort();
}

/**
 * Export audit data to CSV format
 */
const ACAO_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Remoção",
};

export function formatAuditsForCSV(audits: AuditoriaWithUser[]): string {
  const headers = [
    "Data/Hora",
    "Usuário",
    "Ação",
    "Entidade",
    "ID Entidade",
    "Obra ID",
  ];
  const rows = audits.map((audit) => [
    new Date(audit.created_at).toLocaleString("pt-BR"),
    audit.users_profile?.nome ||
      audit.users_profile?.email ||
      audit.por_user_id ||
      "Sistema",
    ACAO_LABELS[audit.acao] || audit.acao,
    audit.entidade,
    audit.entidade_id,
    audit.obra_id || "-",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  return csvContent;
}
