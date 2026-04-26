/**
 * Purchase lead-time risk — compares "today + supplier.lead_time_days" with
 * the purchase's `required_by_date` to surface compras that won't arrive in
 * time if ordered now.
 *
 * Returns a tone + short message that the table/Kanban can render as a badge
 * or tooltip directly.
 */
import { differenceInCalendarDays, addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { StatusTone } from '@/components/ui-premium';
import { parseLocalDate, getTodayLocal } from './activityStatus';

export type LeadTimeRiskLevel = 'on_track' | 'tight' | 'late' | 'unknown';

export interface PurchaseLike {
  required_by_date?: string | null;
  lead_time_days?: number | null;
  actual_delivery_date?: string | null;
  status?: string | null;
}

export interface SupplierLike {
  lead_time_days?: number | null;
}

export interface LeadTimeRiskInfo {
  level: LeadTimeRiskLevel;
  tone: StatusTone;
  label: string;
  message: string;
  /** Latest date the order can be placed and still arrive on time. */
  orderByDate: Date | null;
  /**
   * Days between today and `orderByDate`.
   * Negative = already late; 0 = order today; positive = days of slack.
   */
  daysOfSlack: number | null;
}

/**
 * Resolve the effective lead time used for the calculation.
 *
 * Supplier wins when present (more reliable than what was typed into the
 * purchase by the user); otherwise we fall back to the purchase row.
 */
function resolveLeadTimeDays(
  purchase: PurchaseLike,
  supplier?: SupplierLike | null,
): number | null {
  const fromSupplier = supplier?.lead_time_days;
  if (typeof fromSupplier === 'number' && Number.isFinite(fromSupplier) && fromSupplier >= 0) {
    return fromSupplier;
  }
  const fromPurchase = purchase.lead_time_days;
  if (typeof fromPurchase === 'number' && Number.isFinite(fromPurchase) && fromPurchase >= 0) {
    return fromPurchase;
  }
  return null;
}

const TERMINAL_STATUSES = new Set([
  'delivered',
  'sent_to_site',
  'cancelled',
]);

export function getLeadTimeRisk(
  purchase: PurchaseLike,
  supplier?: SupplierLike | null,
  now: Date = getTodayLocal(),
): LeadTimeRiskInfo {
  // Already delivered/cancelled → no risk to flag.
  if (purchase.status && TERMINAL_STATUSES.has(purchase.status)) {
    return {
      level: 'on_track',
      tone: 'success',
      label: 'No prazo',
      message: 'Compra finalizada — sem risco de prazo.',
      orderByDate: null,
      daysOfSlack: null,
    };
  }

  if (!purchase.required_by_date) {
    return {
      level: 'unknown',
      tone: 'muted',
      label: 'Sem data',
      message: 'Defina a data necessária para calcular o risco de prazo.',
      orderByDate: null,
      daysOfSlack: null,
    };
  }

  const leadTimeDays = resolveLeadTimeDays(purchase, supplier);
  if (leadTimeDays === null) {
    return {
      level: 'unknown',
      tone: 'muted',
      label: 'Sem lead-time',
      message: 'Defina o lead-time do fornecedor para calcular o risco.',
      orderByDate: null,
      daysOfSlack: null,
    };
  }

  const requiredBy = parseLocalDate(purchase.required_by_date);
  const orderByDate = addDays(requiredBy, -leadTimeDays);
  const daysOfSlack = differenceInCalendarDays(orderByDate, now);
  const formattedOrderBy = format(orderByDate, "dd/MM", { locale: ptBR });

  if (daysOfSlack < 0) {
    return {
      level: 'late',
      tone: 'danger',
      label: 'Atrasada',
      message: `Pedido deveria ter saído em ${formattedOrderBy}. Não chega a tempo.`,
      orderByDate,
      daysOfSlack,
    };
  }

  if (daysOfSlack <= 2) {
    return {
      level: 'tight',
      tone: 'warning',
      label: 'Apertado',
      message: `Comprar até ${formattedOrderBy} para chegar a tempo.`,
      orderByDate,
      daysOfSlack,
    };
  }

  return {
    level: 'on_track',
    tone: 'success',
    label: 'No prazo',
    message: `Comprar até ${formattedOrderBy} para chegar a tempo.`,
    orderByDate,
    daysOfSlack,
  };
}
