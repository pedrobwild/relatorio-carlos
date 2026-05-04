/**
 * purchaseRisk — risco de prazo de uma compra.
 *
 * Compara `today + supplier.lead_time_days` com `required_by_date` e retorna
 * tone/mensagem prontos para badge ou tooltip.
 *
 * Heurística (em dias úteis simplificados — corridos):
 *   - já entregue / sem data exigida → on_track
 *   - chegada estimada antes do prazo, com folga > LEAD_BUFFER_DAYS → on_track
 *   - chegada estimada antes do prazo, folga ≤ LEAD_BUFFER_DAYS → at_risk
 *   - chegada estimada após o prazo → late
 */

import { differenceInCalendarDays, addDays, format } from "date-fns";
import type { StatusTone } from "@/components/ui-premium";
import { parseLocalDate, getTodayLocal } from "./activityStatus";

export type LeadTimeRiskLevel = "on_track" | "at_risk" | "late" | "unknown";

export interface PurchaseLike {
  required_by_date?: string | null;
  status?: string | null;
}

export interface SupplierLike {
  lead_time_days?: number | null;
}

export interface LeadTimeRisk {
  level: LeadTimeRiskLevel;
  tone: StatusTone;
  label: string;
  message: string;
  /** Last day on which the order should be placed to arrive on time. */
  orderByDate: Date | null;
  /** Slack in calendar days between estimated arrival and required date. */
  slackDays: number | null;
}

/** Considered "delivered" — risk is not actionable anymore. */
const TERMINAL_STATUSES = new Set(["delivered", "sent_to_site", "cancelled"]);

/** Buffer in days below which we flag at_risk even though arrival ≤ required. */
const LEAD_BUFFER_DAYS = 2;

const TONE: Record<LeadTimeRiskLevel, StatusTone> = {
  on_track: "success",
  at_risk: "warning",
  late: "danger",
  unknown: "muted",
};

const LABEL: Record<LeadTimeRiskLevel, string> = {
  on_track: "No prazo",
  at_risk: "Prazo apertado",
  late: "Vai atrasar",
  unknown: "Sem prazo",
};

function unknown(message = "Sem prazo informado"): LeadTimeRisk {
  return {
    level: "unknown",
    tone: TONE.unknown,
    label: LABEL.unknown,
    message,
    orderByDate: null,
    slackDays: null,
  };
}

/**
 * Compute lead-time risk for a purchase.
 *
 * @param purchase  purchase with `required_by_date` and (optional) `status`
 * @param supplier  supplier with `lead_time_days`
 * @param now       reference date (default: today, local)
 */
export function getLeadTimeRisk(
  purchase: PurchaseLike,
  supplier: SupplierLike | null | undefined,
  now?: Date,
): LeadTimeRisk {
  const today = now ?? getTodayLocal();

  if (purchase.status && TERMINAL_STATUSES.has(purchase.status)) {
    return {
      level: "on_track",
      tone: TONE.on_track,
      label: LABEL.on_track,
      message: "Compra concluída",
      orderByDate: null,
      slackDays: null,
    };
  }

  if (!purchase.required_by_date) {
    return unknown();
  }

  if (
    !supplier ||
    supplier.lead_time_days === null ||
    supplier.lead_time_days === undefined
  ) {
    return unknown("Lead-time do fornecedor não informado");
  }

  const required = parseLocalDate(purchase.required_by_date);
  const lead = Number(supplier.lead_time_days);

  if (!Number.isFinite(lead) || lead < 0) {
    return unknown("Lead-time do fornecedor não informado");
  }

  const estimatedArrival = addDays(today, lead);
  const slackDays = differenceInCalendarDays(required, estimatedArrival);
  const orderByDate = addDays(required, -lead);

  if (slackDays < 0) {
    return {
      level: "late",
      tone: TONE.late,
      label: LABEL.late,
      message: `Chegada estimada ${Math.abs(slackDays)} dia(s) após o prazo. Pedir até ${format(orderByDate, "dd/MM")} (já vencido).`,
      orderByDate,
      slackDays,
    };
  }

  if (slackDays <= LEAD_BUFFER_DAYS) {
    return {
      level: "at_risk",
      tone: TONE.at_risk,
      label: LABEL.at_risk,
      message: `Comprar até ${format(orderByDate, "dd/MM")} para chegar a tempo (folga ${slackDays} dia(s)).`,
      orderByDate,
      slackDays,
    };
  }

  return {
    level: "on_track",
    tone: TONE.on_track,
    label: LABEL.on_track,
    message: `Folga de ${slackDays} dia(s) — pedir até ${format(orderByDate, "dd/MM")}.`,
    orderByDate,
    slackDays,
  };
}
