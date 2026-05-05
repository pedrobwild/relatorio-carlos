/**
 * Temporal status utilities.
 * Adds human-readable time context to project status labels.
 */

import { differenceInDays } from "date-fns";

/**
 * Format a duration in a human-readable way (pt-BR).
 */
function formatDuration(days: number): string {
  if (days <= 0) return "hoje";
  if (days === 1) return "1 dia";
  if (days < 7) return `${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 semana";
  if (days < 30) return `${weeks} semanas`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 mês";
  return `${months} meses`;
}

/**
 * Get a status label enriched with temporal context.
 * e.g. "Em andamento há 3 semanas", "Pausada há 5 dias"
 */
export function getTemporalStatusLabel(
  status: string,
  statusChangedAt?: string | null,
  createdAt?: string | null,
): string {
  const baseLabels: Record<string, string> = {
    active: "Em andamento",
    completed: "Concluída",
    paused: "Pausada",
    cancelled: "Cancelada",
  };

  const label = baseLabels[status] ?? status;
  const refDate = statusChangedAt || createdAt;

  if (!refDate) return label;

  const days = differenceInDays(new Date(), new Date(refDate));
  if (days < 1) return label;

  const duration = formatDuration(days);

  switch (status) {
    case "active":
      return `Em andamento há ${duration}`;
    case "paused":
      return `Pausada há ${duration}`;
    case "completed":
      return `Concluída há ${duration}`;
    case "cancelled":
      return `Cancelada há ${duration}`;
    default:
      return label;
  }
}
