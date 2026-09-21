import type { ProjectMetrics } from "./types";

/**
 * Percentual exibido no cabeçalho compacto (mobile) da obra.
 *
 * É o avanço REALIZADO (peso das atividades concluídas), a mesma métrica do
 * cabeçalho desktop e do contador "x/y concluídas". A versão anterior usava
 * dias decorridos ÷ dias totais, que passa de 100% em obra atrasada (ex.:
 * "256%") e não representa progresso.
 */
export function getHeaderProgressPct(
  metrics: Pick<ProjectMetrics, "actualProgress">,
): number {
  const value = Number.isFinite(metrics.actualProgress)
    ? Math.round(metrics.actualProgress)
    : 0;
  return Math.max(0, Math.min(100, value));
}
