/**
 * Hook for audit trail data
 */

import { useQuery } from "@tanstack/react-query";
import { listAudits, getEntityAuditTrail, getDistinctEntityTypes, type AuditoriaFilters } from "@/infra/repositories/auditoria.repository";
import { QUERY_TIMING } from "@/lib/queryClient";

/**
 * Hook for listing audit records with filters
 */
export function useAudits(filters: AuditoriaFilters = {}) {
  return useQuery({
    queryKey: ["audits", filters],
    queryFn: () => listAudits(filters),
    staleTime: QUERY_TIMING.default.staleTime,
    gcTime: QUERY_TIMING.default.gcTime,
  });
}

/**
 * Hook for contextual audit trail of an entity
 */
export function useEntityAuditTrail(
  entidade: string | undefined,
  entidade_id: string | undefined,
  limit: number = 10,
) {
  return useQuery({
    queryKey: ["entity-audit-trail", entidade, entidade_id, limit],
    queryFn: () => getEntityAuditTrail(entidade!, entidade_id!, limit),
    enabled: !!entidade && !!entidade_id,
    staleTime: QUERY_TIMING.default.staleTime,
    gcTime: QUERY_TIMING.default.gcTime,
  });
}

/**
 * Hook for distinct entity types (for filter dropdown)
 */
export function useEntityTypes() {
  return useQuery({
    queryKey: ["audit-entity-types"],
    queryFn: getDistinctEntityTypes,
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
    gcTime: 30 * 60 * 1000,
  });
}
