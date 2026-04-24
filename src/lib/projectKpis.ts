/**
 * Funções puras para derivar KPIs consolidados de uma obra.
 *
 * Por que existir:
 *   Antes, cada página (Painel, Portal Cliente, cards) recalculava
 *   "dias atrasados", "status derivado", "próxima etapa" de formas sutilmente
 *   diferentes. Este módulo é a fonte única para esses cálculos —
 *   consumido por `useProjectKPIs` e pode ser testado isoladamente.
 *
 *   As funções NÃO conhecem React ou Supabase: recebem dados já carregados
 *   e devolvem métricas. Isso permite chamá-las em server-side rendering,
 *   relatórios PDF, e-mails etc. sem mudanças.
 */

import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import {
  ETAPA_OPTIONS,
  type PainelEtapa,
  type PainelStatus,
} from '@/hooks/usePainelObras';

/** Retorna a data de "hoje" no fuso local, normalizada para YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/**
 * Parte "temporal" do status exibido no painel.
 *
 * Regra (derivada, não persiste no banco):
 *   - Se a entrega oficial já passou e a entrega real não foi preenchida,
 *     o status visual é `Atrasado`, independentemente do `painel_status`.
 *   - Caso contrário, mantém o `painel_status` armazenado.
 *
 * A etapa `Finalizada` **não** isenta o atraso enquanto não houver
 * entrega real — isso força o registro da data para fechar a obra.
 */
export function deriveDisplayStatus(input: {
  status: PainelStatus | null;
  entregaOficial: string | null;
  entregaReal: string | null;
  now?: Date;
}): PainelStatus | null {
  const { status, entregaOficial, entregaReal } = input;
  if (!entregaOficial || entregaReal) return status;
  const hoje = todayIso(input.now);
  return entregaOficial < hoje ? 'Atrasado' : status;
}

/**
 * Dias de atraso em relação à entrega oficial.
 * - Positivo: obra atrasada.
 * - Zero: no prazo.
 * - Retorna 0 quando já existe entrega real ou quando não há prazo.
 */
export function computeDaysOverdue(input: {
  entregaOficial: string | null;
  entregaReal: string | null;
  now?: Date;
}): number {
  const { entregaOficial, entregaReal } = input;
  if (!entregaOficial || entregaReal) return 0;
  const diff = differenceInCalendarDays(
    input.now ?? new Date(),
    parseISO(entregaOficial),
  );
  return diff > 0 ? diff : 0;
}

/**
 * KPI de custo: previsto vs. realizado (pago).
 *
 * - `planned`  = `projects.contract_value` (valor contratual cheio).
 * - `paid`     = soma de `project_payments.amount` onde `paid_at IS NOT NULL`.
 * - `percent`  = `paid / planned * 100` (arredondado), 0 quando planned ausente.
 */
export interface CostKPIs {
  planned: number | null;
  paid: number;
  remaining: number | null;
  percentPaid: number;
}

export function computeCostKPIs(input: {
  contractValue: number | null | undefined;
  payments: ReadonlyArray<{ amount: number | null; paid_at: string | null }>;
}): CostKPIs {
  const planned =
    typeof input.contractValue === 'number' && !Number.isNaN(input.contractValue)
      ? input.contractValue
      : null;
  const paid = (input.payments ?? []).reduce((sum, p) => {
    if (!p.paid_at) return sum;
    return sum + (typeof p.amount === 'number' ? p.amount : 0);
  }, 0);
  const remaining =
    planned != null ? Math.max(0, planned - paid) : null;
  const percentPaid =
    planned && planned > 0 ? Math.min(100, Math.round((paid / planned) * 100)) : 0;
  return { planned, paid, remaining, percentPaid };
}

/**
 * Etapa atual e próxima, usando a ordem canônica em `ETAPA_OPTIONS`.
 *
 * Heurística:
 *   - Se `painelEtapa` é uma das etapas conhecidas, ela é a "atual".
 *   - A "próxima" é o elemento seguinte na lista, ou `null` se já
 *     estiver em `Finalizada`.
 *   - Para obras sem painel preenchido, retorna atual `null` e próxima
 *     `Medição` (primeira etapa do ciclo).
 *
 * Observação: `Vistoria reprovada` é tratada como "estado paralelo" —
 * a próxima etapa continua sendo `Finalizada`, não volta para Vistoria,
 * porque a decisão de reentrar em vistoria é explícita e manual.
 */
export interface StageKPIs {
  current: PainelEtapa | null;
  next: PainelEtapa | null;
  /** Índice (0-based) da etapa atual dentro de ETAPA_OPTIONS, ou null. */
  currentIndex: number | null;
  /** Total de etapas na jornada canônica. */
  totalStages: number;
}

export function computeStageKPIs(painelEtapa: PainelEtapa | null): StageKPIs {
  const total = ETAPA_OPTIONS.length;
  if (!painelEtapa) {
    return {
      current: null,
      next: ETAPA_OPTIONS[0] ?? null,
      currentIndex: null,
      totalStages: total,
    };
  }
  const idx = ETAPA_OPTIONS.indexOf(painelEtapa);
  if (idx === -1) {
    return { current: painelEtapa, next: null, currentIndex: null, totalStages: total };
  }
  // "Vistoria reprovada" não aponta de volta para Vistoria: a próxima é
  // Finalizada (saída natural após correção + nova vistoria aprovada).
  if (painelEtapa === 'Vistoria reprovada') {
    return { current: painelEtapa, next: 'Finalizada', currentIndex: idx, totalStages: total };
  }
  const next = ETAPA_OPTIONS[idx + 1] ?? null;
  return { current: painelEtapa, next, currentIndex: idx, totalStages: total };
}

/**
 * Normaliza o percentual de progresso vindo do summary.
 * - Arredonda para inteiro.
 * - Clampa em [0, 100].
 * - Retorna `null` quando a fonte não tiver valor.
 */
export function normalizeProgress(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Math.round(Math.min(100, Math.max(0, Number(value))));
}
