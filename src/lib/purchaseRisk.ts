/**
 * Avaliação de risco de prazo de compras.
 *
 * Compara `today + lead_time_days` com `required_by_date` da compra para
 * determinar se ainda há folga, se está no limite ou se já estourou o prazo.
 *
 * Resultado é tipado como `{ tone, message }` para alimentar
 * `<StatusBadge tone={tone}>` direto na tabela / kanban de Compras.
 */
import { differenceInCalendarDays } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, getTodayLocal } from './activityStatus';
import type { StatusTone } from '@/components/ui-premium';
import type { PurchaseStatus } from '@/hooks/useProjectPurchases';

export type LeadTimeRisk = 'safe' | 'approaching' | 'critical' | 'overdue' | 'closed';

export interface LeadTimeRiskInfo {
  risk: LeadTimeRisk;
  tone: StatusTone;
  /** Mensagem curta para tooltip / texto de badge */
  message: string;
  /** Última data em que a compra ainda chegaria a tempo (today + lead_time = required) */
  orderByDate: Date | null;
  /** Dias entre hoje e `required_by_date` (positivo = futuro, negativo = passou) */
  daysUntilRequired: number;
  /** Dias de folga após considerar lead time (positivo = sobra, negativo = vai atrasar) */
  slackDays: number;
}

interface PurchaseLike {
  status: PurchaseStatus;
  lead_time_days: number;
  required_by_date: string;
}

interface SupplierLike {
  /** Override do lead time vindo do fornecedor (em dias) */
  lead_time_days?: number | null;
}

/**
 * Status que indicam que a compra já saiu do funil de risco — não há mais
 * decisão de "comprar a tempo" a tomar.
 */
const CLOSED_STATUSES: ReadonlySet<PurchaseStatus> = new Set([
  'delivered',
  'sent_to_site',
  'cancelled',
]);

function formatBR(date: Date): string {
  return format(date, "dd/MM", { locale: ptBR });
}

/**
 * Avalia o risco de lead time de uma compra.
 *
 * Regras:
 *  - Status terminal (entregue / enviado / cancelado) → `closed` neutral.
 *  - `required_by_date` já passou → `overdue` danger.
 *  - Folga negativa (today + lead > required) → `critical` danger.
 *  - Folga ≤ 3 dias → `approaching` warning.
 *  - Caso contrário → `safe` success.
 *
 * @param purchase - Compra com `lead_time_days` e `required_by_date`
 * @param supplier - Opcional. Se trouxer `lead_time_days`, sobrescreve o da compra.
 * @param now - Data de referência (default: hoje)
 */
export function getLeadTimeRisk(
  purchase: PurchaseLike,
  supplier?: SupplierLike | null,
  now?: Date,
): LeadTimeRiskInfo {
  const today = now ?? getTodayLocal();
  const required = parseLocalDate(purchase.required_by_date);
  const daysUntilRequired = differenceInCalendarDays(required, today);

  if (CLOSED_STATUSES.has(purchase.status)) {
    return {
      risk: 'closed',
      tone: 'muted',
      message: 'Compra encerrada — risco de prazo não se aplica',
      orderByDate: null,
      daysUntilRequired,
      slackDays: daysUntilRequired,
    };
  }

  const leadTime = Math.max(
    0,
    supplier?.lead_time_days ?? purchase.lead_time_days ?? 0,
  );

  // Última data em que ainda dá tempo de comprar e receber até `required`.
  const orderByDate = new Date(required);
  orderByDate.setDate(orderByDate.getDate() - leadTime);

  const slackDays = differenceInCalendarDays(orderByDate, today);

  if (daysUntilRequired < 0) {
    return {
      risk: 'overdue',
      tone: 'danger',
      message: `Prazo final venceu há ${Math.abs(daysUntilRequired)} dia(s)`,
      orderByDate,
      daysUntilRequired,
      slackDays,
    };
  }

  if (slackDays < 0) {
    return {
      risk: 'critical',
      tone: 'danger',
      message: `Lead time estoura o prazo. Deveria ter sido comprado em ${formatBR(orderByDate)}`,
      orderByDate,
      daysUntilRequired,
      slackDays,
    };
  }

  if (slackDays <= 3) {
    return {
      risk: 'approaching',
      tone: 'warning',
      message: `Comprar até ${formatBR(orderByDate)} para chegar a tempo`,
      orderByDate,
      daysUntilRequired,
      slackDays,
    };
  }

  return {
    risk: 'safe',
    tone: 'success',
    message: `Folga de ${slackDays} dia(s) antes do limite (${formatBR(orderByDate)})`,
    orderByDate,
    daysUntilRequired,
    slackDays,
  };
}
