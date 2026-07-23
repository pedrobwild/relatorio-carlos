/**
 * useCosts — hooks TanStack para consolidação de custos (Onda B1, staff-only).
 */
import { useQuery } from "@tanstack/react-query";
import { costsRepo } from "@/infra/repositories/costs.repository";
import { queryKeys } from "@/lib/queryKeys";

const STALE = 60_000;

export function useCostSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.custos.summary(projectId),
    queryFn: () => costsRepo.getSummary(projectId as string),
    enabled: Boolean(projectId),
    staleTime: STALE,
  });
}

export function useCostTotals(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.custos.totals(projectId),
    queryFn: () => costsRepo.getTotals(projectId as string),
    enabled: Boolean(projectId),
    staleTime: STALE,
  });
}

export function useCostSCurveWeekly(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.custos.sCurve(projectId),
    queryFn: () => costsRepo.getSCurveWeekly(projectId as string),
    enabled: Boolean(projectId),
    staleTime: STALE,
  });
}
