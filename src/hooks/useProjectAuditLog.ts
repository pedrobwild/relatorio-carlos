/**
 * useProjectAuditLog — leitura da trilha de auditoria de uma obra.
 *
 * Consulta a tabela `audit_logs` filtrando por `project_id`. RLS no banco
 * garante que apenas staff e usuários com acesso à obra recebam linhas.
 *
 * Tipagem é deliberadamente ampla (`unknown` em old/new) porque a tabela
 * armazena snapshots heterogêneos de várias entidades. A UI consumidora
 * sabe interpretar conforme `table_name`.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

/** Tabelas que possuem trigger de auditoria (mantém em sincronia com a migration). */
export type AuditTableName =
  | 'projects'
  | 'project_documents'
  | 'project_payments'
  | 'project_daily_logs'
  | 'obra_tasks'
  | 'journey_stage_records'
  | 'stage_dates'
  | 'formalizations';

export interface AuditLogEntry {
  id: string;
  table_name: AuditTableName | string;
  record_id: string;
  project_id: string | null;
  action: AuditAction;
  changed_columns: string[] | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by: string | null;
  changed_by_email: string | null;
  created_at: string;
}

interface UseProjectAuditLogOptions {
  /** Limite de registros a buscar. Default 200 — paginação fica para v2. */
  limit?: number;
  /** Filtra por uma tabela específica (opcional). */
  tableName?: AuditTableName;
}

export function useProjectAuditLog(
  projectId: string | undefined,
  options: UseProjectAuditLogOptions = {},
) {
  const { limit = 200, tableName } = options;

  return useQuery({
    queryKey: ['project-audit-log', projectId, { limit, tableName }],
    enabled: !!projectId,
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (!projectId) return [];

      let query = supabase
        // Tabela ainda não está no types.ts gerado — cast pontual aceitável.
        .from('audit_logs' as never)
        .select(
          'id, table_name, record_id, project_id, action, changed_columns, old_values, new_values, changed_by, changed_by_email, created_at',
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (tableName) {
        query = query.eq('table_name', tableName);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AuditLogEntry[];
    },
    staleTime: 30_000,
  });
}
