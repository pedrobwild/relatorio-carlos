/**
 * Compras geradas a partir do cronograma semanal.
 *
 * Regras (dias corridos para trás a partir de "precisa"):
 * - padrao: precisa = 1º dia útil da semana; limite = precisa − 7; ideal = precisa − 14.
 * - limite (dias N): limite = precisa − N; ideal = limite − 7. Cortina: lembrete
 *   "agendar instalação" em precisa − agendar_instalacao_dias.
 * - marmoraria: precisa = 1º dia útil da atividade − 14 (entrega no fornecedor).
 * - marco: pedido no dia do marco. Marcenaria: entrega = pedido + entrega_dias.
 * - prazo_confirmar: nasce "Prazo a confirmar"; com lead_time confirmado,
 *   limite = precisa − prazo e ideal = limite − 7.
 * Pedido em dia não útil volta ao dia útil anterior; entrega vai ao próximo.
 *
 * Espelho exato de `public.schedule_purchase_dates` (que é quem grava e recalcula).
 */
import { isNonBusinessDay } from "@/lib/businessDays";
import { toLocalISODate } from "@/lib/localDate";
import type { WeeklyPlan } from "./weeklySchedule";

export type PurchaseRuleKind = "padrao" | "limite" | "marmoraria" | "marco";

export interface TemplatePurchase {
  item: string;
  categoria?: string;
  regra?: PurchaseRuleKind;
  dias?: number;
  entrega_dias?: number;
  agendar_instalacao_dias?: number;
  prazo_confirmar?: boolean;
  producao_dias?: string;
  tipo?: "produto" | "prestador";
}

export interface PurchaseRule {
  regra: PurchaseRuleKind;
  dias?: number;
  entrega_dias?: number;
  agendar_instalacao_dias?: number;
  prazo_confirmar?: boolean;
  ref?: "montagem_marcenaria" | "instalacao_box";
}

export interface PurchaseDates {
  precisa: string;
  ideal: string;
  limite: string;
  reminder: string | null;
  expected: string | null;
  alert: string | null;
}

export const PURCHASE_CATEGORIES = [
  "Material elétrico e hidráulico",
  "Ar-condicionado",
  "Esquadrias e fechaduras",
  "Marmoraria",
  "Vidros e box",
  "Revestimentos e piso",
  "Tintas",
  "Marcenaria",
  "Iluminação",
  "Louças, metais e acessórios",
  "Eletrodomésticos",
  "Mobiliário e decoração",
  "Enxoval e utensílios",
  "Serviços e materiais de obra",
] as const;

const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const diffDays = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86400000);
const br = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export function prevBusinessDay(d: Date): Date {
  let c = new Date(d);
  while (isNonBusinessDay(c)) c = addDays(c, -1);
  return c;
}
export function nextBusinessDay(d: Date): Date {
  let c = new Date(d);
  while (isNonBusinessDay(c)) c = addDays(c, 1);
  return c;
}

export function computePurchaseDates(
  rule: PurchaseRule,
  baseIso: string,
  refIso: string | null = null,
  lead: { days: number; confirmed: boolean } | null = null,
): PurchaseDates {
  const base = parse(baseIso);
  const iso = toLocalISODate;
  if (rule.regra === "marco") {
    let expected: Date | null = null;
    let alert: string | null = null;
    const ref = refIso ? parse(refIso) : null;
    if (rule.entrega_dias != null) {
      expected = nextBusinessDay(addDays(base, rule.entrega_dias));
      if (ref && expected >= ref) {
        alert = `Entrega prevista em ${br(expected)} cai no dia da montagem ou depois (${br(ref)}).`;
      }
    } else if (rule.ref === "instalacao_box" && ref && diffDays(ref, base) < 20) {
      alert = `Medição a ${diffDays(ref, base)} dias corridos da instalação do box (mínimo 20).`;
    }
    return {
      precisa: baseIso,
      ideal: baseIso,
      limite: baseIso,
      reminder: null,
      expected: expected ? iso(expected) : null,
      alert,
    };
  }
  let precisa = nextBusinessDay(base);
  if (rule.regra === "marmoraria") precisa = nextBusinessDay(addDays(base, -14));
  const back =
    lead?.confirmed ? lead.days : rule.regra === "limite" ? (rule.dias ?? 7) : 7;
  const rawLimite = addDays(precisa, -back);
  return {
    precisa: iso(precisa),
    limite: iso(prevBusinessDay(rawLimite)),
    ideal: iso(prevBusinessDay(addDays(rawLimite, -7))),
    reminder:
      rule.agendar_instalacao_dias != null
        ? iso(prevBusinessDay(addDays(precisa, -rule.agendar_instalacao_dias)))
        : null,
    expected: null,
    alert: null,
  };
}

export interface PlannedPurchase {
  weekIndex: number;
  refWeekIndex: number | null;
  item_name: string;
  category: string | null;
  purchase_type: "produto" | "prestador";
  delivery_location: "obra" | "fornecedor";
  delivery_address: string | null;
  template_item_key: string;
  notes: string | null;
  rule: PurchaseRule;
  dates: PurchaseDates;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function isTemplatePurchase(p: unknown): p is TemplatePurchase {
  return !!p && typeof p === "object" && typeof (p as TemplatePurchase).item === "string";
}

/** Compras do plano, com as datas já calculadas (uma por item de compra). */
export function buildWeeklyPurchases(plan: WeeklyPlan): PlannedPurchase[] {
  const weekStart = new Map(plan.weeks.map((w) => [w.index, w.firstBusinessDay]));
  const findWeek = (re: RegExp) =>
    plan.items.find((i) => i.kind === "execucao" && re.test(i.description))?.week ?? null;
  const montagemWeek = findWeek(/montagem da marcenaria/i);
  const boxWeek = plan.items.find(
    (i) => i.kind === "execucao" && /\bbox\b/i.test(i.description) && !/medi/i.test(i.description),
  )?.week ?? null;

  const out: PlannedPurchase[] = [];
  for (const it of plan.items) {
    const base = weekStart.get(it.week);
    if (!base || !Array.isArray(it.purchases)) continue;
    for (const p of it.purchases.filter(isTemplatePurchase)) {
      const regra: PurchaseRuleKind = p.regra ?? "padrao";
      const rule: PurchaseRule = { regra };
      if (p.dias != null) rule.dias = p.dias;
      if (p.entrega_dias != null) rule.entrega_dias = p.entrega_dias;
      if (p.agendar_instalacao_dias != null) rule.agendar_instalacao_dias = p.agendar_instalacao_dias;
      if (p.prazo_confirmar) rule.prazo_confirmar = true;
      let refWeekIndex: number | null = null;
      if (regra === "marco" && p.entrega_dias != null) {
        rule.ref = "montagem_marcenaria";
        refWeekIndex = montagemWeek;
      } else if (regra === "marco" && /\bbox\b/i.test(p.item)) {
        rule.ref = "instalacao_box";
        refWeekIndex = boxWeek;
      }
      const refIso = refWeekIndex ? (weekStart.get(refWeekIndex) ?? null) : null;
      const notes: string[] = [];
      if (p.prazo_confirmar) notes.push("Confirmar prazo do fornecedor.");
      if (p.producao_dias) notes.push(`Produção de ${p.producao_dias} dias.`);
      const prestador =
        p.tipo === "prestador" || /descarte|entulho|servi[cç]o/i.test(p.item);
      out.push({
        weekIndex: it.week,
        refWeekIndex,
        item_name: p.item,
        category: p.categoria ?? null,
        purchase_type: prestador ? "prestador" : "produto",
        delivery_location: regra === "marmoraria" ? "fornecedor" : "obra",
        delivery_address: regra === "marmoraria" ? "Marmoraria" : null,
        template_item_key: `s${it.week}:${slug(p.item)}`,
        notes: notes.length ? notes.join(" ") : null,
        rule,
        dates: computePurchaseDates(rule, base, refIso),
      });
    }
  }
  return out;
}

/** Situação do prazo para a tela: amarelo passou do ideal, vermelho passou do limite. */
export function purchaseDeadlineState(
  p: { status: string; planned_purchase_date: string | null; purchase_deadline_date?: string | null },
  today: string = toLocalISODate(new Date()),
): "ok" | "late_ideal" | "late_deadline" {
  if (p.status !== "pending") return "ok";
  if (p.purchase_deadline_date && today > p.purchase_deadline_date) return "late_deadline";
  if (p.planned_purchase_date && today > p.planned_purchase_date) return "late_ideal";
  return "ok";
}
