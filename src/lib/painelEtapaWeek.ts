/**
 * Helpers de cálculo do rótulo "Execução - S{N}" do Painel de Obras.
 *
 * S1 corresponde aos primeiros 7 dias corridos a partir de `inicio_etapa`
 * (com fallback para `inicio_oficial`). S2 começa no 8º dia, e assim por
 * diante. Datas anteriores ao início são clampadas em S1.
 */
import { parseISO } from 'date-fns';
import type { PainelEtapa } from '@/hooks/usePainelObras';

export interface EtapaWeekInput {
  etapa: PainelEtapa | null;
  inicio_etapa: string | null;
  inicio_oficial: string | null;
}

/**
 * Número da semana de execução (S{N}). Retorna `null` quando não é etapa
 * de Execução, faltam datas ou a data é inválida.
 *
 * `now` é injetável para testes — default é `new Date()`.
 */
export function getEtapaWeek(obra: EtapaWeekInput, now: Date = new Date()): number | null {
  if (obra.etapa !== 'Execução') return null;
  const startIso = obra.inicio_etapa ?? obra.inicio_oficial;
  if (!startIso) return null;
  const start = parseISO(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((todayMid.getTime() - startMid.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/**
 * Rótulo exibido na coluna Etapa. Para Execução, anexa "- S{N}". Para outras
 * etapas, devolve o nome puro. `null` quando a obra não tem etapa.
 */
export function formatEtapaLabel(obra: EtapaWeekInput, now: Date = new Date()): string | null {
  if (!obra.etapa) return null;
  const week = getEtapaWeek(obra, now);
  if (week == null) return obra.etapa;
  return `Execução - S${week}`;
}
