/**
 * Material da atividade (Semana) ligado à compra (Compras).
 *
 * Com compra vinculada, a situação do material ("Pendente / Comprado / Na
 * obra") vem da compra — quem decide é o BANCO
 * (`ops_material_status_from_purchase`, migration
 * 20261012140000_ops_materials_purchase_link.sql). Esta é a cópia da mesma
 * tabela no app, só para mostrar/explicar na tela; o teste
 * `__tests__/opsMaterialPurchase.test.ts` trava as duas iguais — mudou lá,
 * mude aqui.
 *
 * Também ficam aqui as regras da linha da compra na gaveta da atividade:
 * rótulo da situação (o mesmo das telas de Compras), "Previsto para dd/mm" /
 * "Entregue em dd/mm", e os avisos de atraso e de compra cancelada.
 */
import type { OpsMaterialStatus } from "@/infra/repositories/ops.repository";
import { parseISODate } from "@/lib/hojeDia";
import type { CreatePurchaseInput } from "@/infra/repositories/purchases.repository";
import { emptyPurchase, statusConfig } from "@/pages/compras/types";

/** Locais de entrega em que "Entregue" ainda NÃO é "na obra". */
const NOT_ON_SITE_LOCATIONS: ReadonlySet<string> = new Set(["estoque", "escritorio"]);

/**
 * Situação do material a partir da situação e do local de entrega da compra.
 * Espelho exato de `public.ops_material_status_from_purchase(status, local)`.
 */
export function opsMaterialStatusFromPurchase(
  status: string | null | undefined,
  deliveryLocation?: string | null,
): OpsMaterialStatus {
  switch (status) {
    case "sent_to_site":
      return "na_obra";
    case "delivered":
      return deliveryLocation != null && NOT_ON_SITE_LOCATIONS.has(deliveryLocation) ? "comprado" : "na_obra";
    case "purchased":
    case "ordered":
    case "in_transit":
      return "comprado";
    default:
      return "pendente";
  }
}

/**
 * Rótulos que só existem fora de `statusConfig` (Compras). "Atrasado" é o
 * que o Calendário de Compras mostra para `delayed`.
 */
const EXTRA_PURCHASE_STATUS_LABEL: Readonly<Record<string, string>> = {
  delayed: "Atrasado",
};

/** Situação da compra com o mesmo texto das telas de Compras. */
export function purchaseStatusLabel(status: string | null | undefined): string {
  if (!status) return "Sem situação";
  const cfg = (statusConfig as Record<string, { label: string } | undefined>)[status];
  return cfg?.label ?? EXTRA_PURCHASE_STATUS_LABEL[status] ?? status;
}

/** O resumo da compra que a gaveta da atividade precisa. */
export interface PurchaseLineInput {
  status: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
}

/** dd/mm de uma data yyyy-mm-dd (aceita também timestamp; usa só a data). */
export function shortDayMonth(iso: string): string {
  const d = parseISODate(iso.slice(0, 10));
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const isDone = (status: string | null) => status === "delivered" || status === "sent_to_site";

/** "Entregue em dd/mm" · "Previsto para dd/mm" · null (sem data). */
export function purchaseDeliveryText(p: PurchaseLineInput): string | null {
  if (p.actual_delivery_date) return `Entregue em ${shortDayMonth(p.actual_delivery_date)}`;
  if (p.status === "cancelled") return null;
  if (p.expected_delivery_date) return `Previsto para ${shortDayMonth(p.expected_delivery_date)}`;
  return null;
}

export function isPurchaseCancelled(p: Pick<PurchaseLineInput, "status">): boolean {
  return p.status === "cancelled";
}

/**
 * A compra chega DEPOIS do dia em que o material é necessário: previsão de
 * entrega > `needed_by`. Só vale enquanto não chegou e não foi cancelada
 * (cancelada tem aviso próprio). Comparação de datas yyyy-mm-dd como texto —
 * sem `new Date`, sem fuso.
 */
export function isPurchaseLate(p: PurchaseLineInput, neededBy: string | null | undefined): boolean {
  if (!neededBy || !p.expected_delivery_date) return false;
  if (p.actual_delivery_date || isDone(p.status) || isPurchaseCancelled(p)) return false;
  return p.expected_delivery_date.slice(0, 10) > neededBy.slice(0, 10);
}

/** O necessário do material para virar solicitação de compra. */
export interface MaterialForPurchaseRequest {
  description: string;
  quantity: number | null;
  unit: string | null;
}

/**
 * Solicitação de compra a partir do material ("Pedir compra"), com os mesmos
 * padrões de uma solicitação nova na tela Compras (`emptyPurchase`): produto,
 * prazo de 7 dias, quantidade 1 e unidade "un" quando o material não diz. A
 * situação fica a padrão do banco ("Pendente"), como no formulário de Compras.
 * `activity_id` da compra aponta para o cronograma do CLIENTE
 * (`project_activities`): é a atividade do cliente de onde veio o item do
 * cronograma interno em que a atividade da Semana está pendurada
 * (`v_ops_activities.stage_client_activity_id`). Item só interno → null.
 * `requiredBy` é a "Data Necessária na Obra" da compra = `needed_by` do
 * material (ou a data que o gestor informar, se o material não tiver).
 */
export function buildPurchaseRequestFromMaterial(
  material: MaterialForPurchaseRequest,
  ctx: {
    projectId: string;
    /** Atividade do cronograma do cliente da etapa (nunca o id do item interno). */
    clientActivityId: string | null | undefined;
    activityTitle?: string | null;
    requiredBy: string;
  },
): CreatePurchaseInput {
  const qty = material.quantity != null && material.quantity > 0 ? material.quantity : 1;
  return {
    project_id: ctx.projectId,
    activity_id: ctx.clientActivityId ?? null,
    item_name: material.description.trim(),
    quantity: qty,
    unit: material.unit?.trim() || "un",
    required_by_date: ctx.requiredBy,
    lead_time_days: emptyPurchase.lead_time_days ?? 7,
    purchase_type: emptyPurchase.purchase_type ?? "produto",
    notes: ctx.activityTitle?.trim() ? `Pedido pela Semana · atividade "${ctx.activityTitle.trim()}"` : "Pedido pela Semana",
  };
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Busca do seletor "Vincular a uma compra": por item e fornecedor, sem
 * diferenciar acento nem maiúscula. Todas as palavras precisam aparecer.
 */
export function filterPurchasesByText<
  T extends { item_name: string; supplier_name?: string | null; fornecedor?: { nome: string } | null },
>(purchases: ReadonlyArray<T>, query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...purchases];
  return purchases.filter((p) => {
    const hay = fold([p.item_name, p.fornecedor?.nome, p.supplier_name].filter(Boolean).join(" "));
    return words.every((w) => hay.includes(w));
  });
}

/** Nome do fornecedor: o do cadastro ou, sem cadastro, o texto livre da compra. */
export function purchaseSupplierName(p: { supplier_name?: string | null; fornecedor?: { nome: string } | null }): string | null {
  return p.fornecedor?.nome?.trim() || p.supplier_name?.trim() || null;
}
